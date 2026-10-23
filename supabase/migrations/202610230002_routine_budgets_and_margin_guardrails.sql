-- Add an explicit per-run Willow Bucks ceiling to routine schedules.
-- Missions carry the ceiling in BRL; debit still happens only after a trusted worker meters actual provider cost.
alter table public.whilo_routines
  add column if not exists max_cost_wb bigint not null default 1000
  check (max_cost_wb between 100 and 100000);
comment on column public.whilo_routines.max_cost_wb is
  'Requested maximum per-run budget in Willow Bucks (1 WB = R$0.01 nominal value). This is a guardrail passed to the mission; usage is charged only by the trusted metering RPC.';

create or replace function public.whilo_bucks_for_provider_cost(p_provider_cost_minor bigint)
returns bigint
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_provider_cost_minor is null or p_provider_cost_minor <= 0 then 0
    else ceil(p_provider_cost_minor::numeric * 10000 / 4000)::bigint
  end
$$;
revoke all on function public.whilo_bucks_for_provider_cost(bigint) from public,anon,authenticated;
grant execute on function public.whilo_bucks_for_provider_cost(bigint) to service_role;
comment on function public.whilo_bucks_for_provider_cost(bigint) is
  'Charges 2.5 WB per cent of verified direct provider cost; direct provider COGS is capped at 40% of nominal WB value, leaving 60% contribution before fees, taxes, infrastructure and support.';

create or replace function public.charge_whilo_usage(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_provider_cost_minor bigint,
  p_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wallet_row public.whilo_credit_wallets%rowtype;
  existing_row public.whilo_credit_ledger%rowtype;
  bill_wb bigint;
  new_balance bigint;
  ledger_id uuid;
  metadata_value jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if p_organization_id is null or p_user_id is null
    or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9:_-]{8,120}$'
    or p_provider_cost_minor is null or p_provider_cost_minor < 0
    or jsonb_typeof(metadata_value) <> 'object' then
    raise exception 'invalid_usage_charge' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=p_user_id
  ) then
    raise exception 'workspace_access_denied' using errcode='42501';
  end if;

  insert into public.whilo_credit_wallets(organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;
  select * into wallet_row
  from public.whilo_credit_wallets
  where organization_id=p_organization_id
  for update;

  select * into existing_row
  from public.whilo_credit_ledger
  where idempotency_key=p_idempotency_key;
  if found then
    if existing_row.organization_id <> p_organization_id or existing_row.kind <> 'usage' then
      raise exception 'usage_idempotency_key_conflict' using errcode='23505';
    end if;
    return jsonb_build_object('charged',false,'duplicate',true,'amount_wb',-existing_row.amount_wb,
      'balance_wb',existing_row.balance_after_wb,'ledger_id',existing_row.id);
  end if;

  -- Zero-cost instrumented events are recorded as a successful no-op, not a debit.
  if p_provider_cost_minor=0 then
    return jsonb_build_object('charged',false,'duplicate',false,'amount_wb',0,'balance_wb',wallet_row.balance_wb,'reason','zero_provider_cost');
  end if;

  bill_wb := public.whilo_bucks_for_provider_cost(p_provider_cost_minor);
  if bill_wb <= 0 then raise exception 'invalid_metered_cost' using errcode='22023'; end if;
  if wallet_row.balance_wb < bill_wb then
    return jsonb_build_object('charged',false,'duplicate',false,'insufficient_balance',true,
      'required_wb',bill_wb,'balance_wb',wallet_row.balance_wb);
  end if;

  new_balance := wallet_row.balance_wb-bill_wb;
  update public.whilo_credit_wallets
  set balance_wb=new_balance,total_spent_wb=total_spent_wb+bill_wb
  where organization_id=p_organization_id;

  insert into public.whilo_credit_ledger(
    organization_id,user_id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,
    idempotency_key,reference,metadata
  ) values (
    p_organization_id,p_user_id,'usage',-bill_wb,new_balance,0,'brl',
    p_idempotency_key,left(coalesce(p_reference,''),240),
    metadata_value||jsonb_build_object('provider_cost_minor',p_provider_cost_minor,'margin_model','provider_cost_cap_40pct')
  ) returning id into ledger_id;

  return jsonb_build_object('charged',true,'duplicate',false,'amount_wb',bill_wb,
    'balance_wb',new_balance,'ledger_id',ledger_id,'provider_cost_minor',p_provider_cost_minor);
end;
$$;
revoke all on function public.charge_whilo_usage(uuid,uuid,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.charge_whilo_usage(uuid,uuid,text,bigint,text,jsonb) to service_role;

create or replace function private.dispatch_due_whilo_routines()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r public.whilo_routines%rowtype;
  v_run_id uuid;
  v_mission_id uuid;
  v_tasks jsonb;
  v_goal text;
  v_created integer := 0;
  v_now timestamptz;
begin
  for r in
    select *
    from public.whilo_routines
    where enabled
      and schedule_kind in ('daily','weekly')
      and next_run_at is not null
      and next_run_at <= clock_timestamp()
    order by next_run_at
    for update skip locked
    limit 50
  loop
    v_now := clock_timestamp();
    v_run_id := null;
    v_mission_id := null;

    -- Never stack scheduled work behind a run still awaiting a decision or worker.
    if exists (
      select 1 from public.whilo_routine_runs rr
      where rr.organization_id=r.organization_id
        and rr.routine_id=r.id
        and rr.status in ('requested','awaiting_approval','queued','running')
    ) then
      update public.whilo_routines
      set next_run_at=private.next_whilo_routine_occurrence(r.schedule_kind,r.schedule_time,r.schedule_days,r.timezone,v_now),
          updated_at=v_now
      where id=r.id and organization_id=r.organization_id;
      continue;
    end if;

    insert into public.whilo_routine_runs(
      organization_id,routine_id,requested_by,trigger_source,status,idempotency_key,result
    ) values (
      r.organization_id,r.id,r.created_by,'schedule','requested',
      'schedule:'||r.id::text||':'||to_char(r.next_run_at at time zone 'UTC','YYYYMMDDHH24MISS'),
      jsonb_build_object('target_kind',r.target_kind,'asset_id',r.asset_id,'target_url',r.target_url,'max_cost_wb',coalesce(r.max_cost_wb,1000),'execution_status','not_started')
    )
    on conflict (organization_id,idempotency_key) do nothing
    returning id into v_run_id;

    update public.whilo_routines
      set last_run_at=v_now,
          next_run_at=private.next_whilo_routine_occurrence(r.schedule_kind,r.schedule_time,r.schedule_days,r.timezone,v_now),
          updated_at=v_now
      where id=r.id and organization_id=r.organization_id;

    if v_run_id is null then
      continue;
    end if;

    begin
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id','routine-step-'||s.ordinality::text,
            'title',left(coalesce(nullif(trim(s.step->>'label'),''), 'Inspect and summarize the configured target'),300),
            'role',case when s.step->>'kind' in ('review','verify') then 'QA Verifier' else 'Workflow Planner' end,
            'dependsOn','[]'::jsonb,
            'toolScopes',jsonb_build_array('read','draft'),
            'maxAttempts',2
          ) order by s.ordinality
        ),
        jsonb_build_array(jsonb_build_object(
          'id','routine-step-1',
          'title','Inspect the configured target and prepare a verifiable report',
          'role','Workflow Planner',
          'dependsOn','[]'::jsonb,
          'toolScopes',jsonb_build_array('read','draft'),
          'maxAttempts',2
        ))
      )
      into v_tasks
      from jsonb_array_elements(r.steps) with ordinality as s(step, ordinality);

      v_goal := left(
        'Routine: '||r.title||E'\n'||
        r.description||E'\nTarget kind: '||r.target_kind||
        case when r.asset_id is not null then E'\nLibrary asset ID: '||r.asset_id::text else '' end||
        case when r.target_url is not null then E'\nTarget URL: '||r.target_url else '' end||
        E'\nMaximum per-run budget: '||coalesce(r.max_cost_wb,1000)::text||' Willow Bucks'||
        E'\nExecution policy: prepare the plan and evidence; do not perform external writes or computer control without explicit approval.',
        4000
      );

      v_mission_id := public.create_mission_bundle(
        r.organization_id,
        r.created_by,
        jsonb_build_object(
          'goal',v_goal,
          'department','Operations',
          'risk',case when r.target_kind='computer' then 'high' when r.target_kind in ('website','api','web_app') then 'medium' else 'low' end,
          'budget',(coalesce(r.max_cost_wb,1000)::numeric / 100),
          'budgetCurrency','BRL',
          'acceptanceCriteria',r.acceptance_criteria
        ),
        v_tasks,
        'routine-run-'||v_run_id::text
      );

      update public.whilo_routine_runs
      set mission_id=v_mission_id,
          status='awaiting_approval',
          result=result||jsonb_build_object('execution_status','not_started','mission_state','awaiting_approval','target_kind',r.target_kind,'asset_id',r.asset_id,'max_cost_wb',coalesce(r.max_cost_wb,1000)),
          updated_at=clock_timestamp()
      where id=v_run_id;
      v_created := v_created+1;
    exception when others then
      update public.whilo_routine_runs
      set status='failed',
          error_code='scheduled_dispatch_failed',
          result=result||jsonb_build_object('execution_status','not_started','dispatch_error_sqlstate',sqlstate),
          finished_at=clock_timestamp(),
          updated_at=clock_timestamp()
      where id=v_run_id;
    end;
  end loop;
  return v_created;
end;
$$;
revoke all on function private.dispatch_due_whilo_routines() from public,anon,authenticated,service_role;

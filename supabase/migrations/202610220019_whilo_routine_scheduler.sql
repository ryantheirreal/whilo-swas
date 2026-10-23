-- Durable, timezone-aware routine scheduling. Runs create approval-gated missions;
-- this dispatcher never executes arbitrary browser or desktop actions itself.
create extension if not exists pg_cron;

create or replace function private.next_whilo_routine_occurrence(
  p_schedule_kind text,
  p_schedule_time text,
  p_schedule_days smallint[],
  p_timezone text,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tz text := coalesce(nullif(p_timezone,''),'UTC');
  v_time time;
  v_local timestamp;
  v_candidate_local timestamp;
  v_candidate timestamptz;
  v_day smallint;
  v_offset integer;
begin
  if p_schedule_kind = 'manual' then return null; end if;
  if p_schedule_kind not in ('daily','weekly') or coalesce(p_schedule_time,'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'invalid_routine_schedule' using errcode='22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name=v_tz) then
    raise exception 'invalid_routine_timezone' using errcode='22023';
  end if;
  if p_schedule_kind='weekly' and coalesce(cardinality(p_schedule_days),0)=0 then
    raise exception 'weekly_schedule_requires_days' using errcode='22023';
  end if;
  v_time := p_schedule_time::time;
  v_local := p_after at time zone v_tz;
  for v_offset in 0..8 loop
    v_candidate_local := date_trunc('day',v_local) + v_offset * interval '1 day' + v_time;
    v_day := extract(dow from v_candidate_local)::smallint;
    if p_schedule_kind='daily' or v_day = any(p_schedule_days) then
      v_candidate := v_candidate_local at time zone v_tz;
      if v_candidate > p_after then return v_candidate; end if;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.next_whilo_routine_occurrence(text,text,smallint[],text,timestamptz) from public,anon,authenticated,service_role;

create or replace function private.set_whilo_routine_next_run()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not new.enabled or new.schedule_kind='manual' then
    new.next_run_at := null;
  elsif tg_op='INSERT'
    or not old.enabled
    or new.schedule_kind is distinct from old.schedule_kind
    or new.schedule_time is distinct from old.schedule_time
    or new.schedule_days is distinct from old.schedule_days
    or new.timezone is distinct from old.timezone then
    new.next_run_at := private.next_whilo_routine_occurrence(new.schedule_kind,new.schedule_time,new.schedule_days,new.timezone,now());
  elsif new.next_run_at is null then
    new.next_run_at := private.next_whilo_routine_occurrence(new.schedule_kind,new.schedule_time,new.schedule_days,new.timezone,now());
  end if;
  return new;
end;
$$;
revoke all on function private.set_whilo_routine_next_run() from public,anon,authenticated,service_role;
drop trigger if exists whilo_routines_schedule_next_run on public.whilo_routines;
create trigger whilo_routines_schedule_next_run
before insert or update on public.whilo_routines
for each row execute function private.set_whilo_routine_next_run();

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
      jsonb_build_object('target_kind',r.target_kind,'asset_id',r.asset_id,'target_url',r.target_url,'execution_status','not_started')
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
          'budget',0,
          'budgetCurrency','BRL',
          'acceptanceCriteria',r.acceptance_criteria
        ),
        v_tasks,
        'routine-run-'||v_run_id::text
      );

      update public.whilo_routine_runs
      set mission_id=v_mission_id,
          status='awaiting_approval',
          result=result||jsonb_build_object('execution_status','not_started','mission_state','awaiting_approval','target_kind',r.target_kind,'asset_id',r.asset_id),
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

do $$
declare
  v_job_id bigint;
begin
  if exists(select 1 from pg_namespace where nspname='cron') then
    select jobid into v_job_id from cron.job where jobname='whilo-routine-dispatch' limit 1;
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  end if;
  perform cron.schedule('whilo-routine-dispatch','*/5 * * * *','select private.dispatch_due_whilo_routines();');
end $$;

comment on function private.dispatch_due_whilo_routines() is
  'Runs due routines at most every five minutes, prevents duplicate overlapping runs, creates a mission awaiting explicit approval, and records that execution has not started.';

-- Reconcile Stripe refunds and disputes against Willow Bucks, including credits already spent.
-- Any unrecovered amount becomes a non-spendable workspace recovery debt; future top-ups repay it first.
alter table public.whilo_credit_wallets
  add column if not exists recovery_debt_wb bigint not null default 0
  check (recovery_debt_wb >= 0);

create table if not exists public.whilo_credit_purchase_state (
  provider_session_id text primary key references public.whilo_credit_ledger(provider_session_id) on delete restrict,
  organization_id uuid not null references public.whilo_credit_wallets(organization_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  pack_id text not null,
  total_credits_wb bigint not null check (total_credits_wb > 0),
  paid_amount_minor bigint not null check (paid_amount_minor > 0),
  total_refunded_minor bigint not null default 0 check (total_refunded_minor >= 0),
  total_reversed_wb bigint not null default 0 check (total_reversed_wb >= 0),
  recovery_debt_wb bigint not null default 0 check (recovery_debt_wb >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_refunded_minor <= paid_amount_minor),
  check (total_reversed_wb <= total_credits_wb)
);
create index if not exists whilo_credit_purchase_state_org_idx
  on public.whilo_credit_purchase_state(organization_id,created_at);
create index if not exists whilo_credit_purchase_state_debt_idx
  on public.whilo_credit_purchase_state(organization_id,created_at)
  where recovery_debt_wb > 0;

create table if not exists public.whilo_credit_reversal_events (
  provider_event_id text primary key,
  provider_session_id text not null references public.whilo_credit_purchase_state(provider_session_id) on delete restrict,
  organization_id uuid not null references public.whilo_credit_wallets(organization_id) on delete cascade,
  reason text not null check (reason in ('refund','dispute_opened','dispute_won')),
  refund_total_minor bigint not null check (refund_total_minor >= 0),
  delta_wb bigint not null default 0,
  debited_wb bigint not null default 0 check (debited_wb >= 0),
  debt_added_wb bigint not null default 0 check (debt_added_wb >= 0),
  debt_cleared_wb bigint not null default 0 check (debt_cleared_wb >= 0),
  event_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(event_metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists whilo_credit_reversal_events_session_idx
  on public.whilo_credit_reversal_events(provider_session_id,created_at desc);

alter table public.whilo_credit_purchase_state enable row level security;
alter table public.whilo_credit_reversal_events enable row level security;
revoke all privileges on public.whilo_credit_purchase_state,public.whilo_credit_reversal_events
  from public,anon,authenticated;
grant all privileges on public.whilo_credit_purchase_state,public.whilo_credit_reversal_events to service_role;

create or replace function public.apply_whilo_credit_purchase(
  p_organization_id uuid,
  p_user_id uuid,
  p_provider_event_id text,
  p_provider_session_id text,
  p_pack_id text,
  p_credit_amount bigint,
  p_paid_amount_minor bigint,
  p_currency text default 'brl',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ledger_id uuid;
  wallet_row public.whilo_credit_wallets%rowtype;
  debt_row record;
  new_balance bigint;
  debt_repaid bigint := 0;
  remaining_repayment bigint := 0;
  chunk bigint := 0;
  currency_value text := lower(coalesce(nullif(p_currency,''),'brl'));
  metadata_value jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if p_organization_id is null or p_user_id is null
    or coalesce(p_provider_event_id,'') = ''
    or coalesce(p_provider_session_id,'') = ''
    or coalesce(p_pack_id,'') = ''
    or p_credit_amount is null or p_credit_amount <= 0
    or p_paid_amount_minor is null or p_paid_amount_minor <= 0
    or currency_value <> 'brl'
    or jsonb_typeof(metadata_value) <> 'object' then
    raise exception 'invalid_credit_purchase' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=p_user_id
  ) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;

  insert into public.whilo_credit_wallets(organization_id)
  values (p_organization_id)
  on conflict (organization_id) do nothing;
  select * into wallet_row
  from public.whilo_credit_wallets
  where organization_id=p_organization_id
  for update;

  insert into public.whilo_credit_ledger(
    organization_id,user_id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,
    pack_id,provider_event_id,provider_session_id,idempotency_key,reference,metadata
  ) values (
    p_organization_id,p_user_id,'topup',p_credit_amount,wallet_row.balance_wb,
    p_paid_amount_minor,currency_value,p_pack_id,p_provider_event_id,p_provider_session_id,
    'stripe-session:'||p_provider_session_id,p_provider_session_id,metadata_value
  )
  on conflict do nothing
  returning id into ledger_id;

  if ledger_id is null then
    return jsonb_build_object('credited',false,'duplicate',true,'balance_wb',wallet_row.balance_wb);
  end if;

  remaining_repayment := least(wallet_row.recovery_debt_wb,p_credit_amount);
  for debt_row in
    select provider_session_id,recovery_debt_wb
    from public.whilo_credit_purchase_state
    where organization_id=p_organization_id and recovery_debt_wb > 0
    order by created_at,provider_session_id
    for update
  loop
    exit when remaining_repayment <= 0;
    chunk := least(remaining_repayment,debt_row.recovery_debt_wb);
    update public.whilo_credit_purchase_state
    set recovery_debt_wb=recovery_debt_wb-chunk,updated_at=now()
    where provider_session_id=debt_row.provider_session_id;
    remaining_repayment := remaining_repayment-chunk;
    debt_repaid := debt_repaid+chunk;
  end loop;

  new_balance := wallet_row.balance_wb + p_credit_amount - debt_repaid;
  update public.whilo_credit_wallets
  set balance_wb=new_balance,
      total_purchased_wb=total_purchased_wb+p_credit_amount,
      recovery_debt_wb=greatest(0,recovery_debt_wb-debt_repaid)
  where organization_id=p_organization_id;

  update public.whilo_credit_ledger
  set balance_after_wb=new_balance,
      metadata=metadata_value||jsonb_build_object('recovery_debt_repaid_wb',debt_repaid)
  where id=ledger_id;

  insert into public.whilo_credit_purchase_state(
    provider_session_id,organization_id,user_id,pack_id,total_credits_wb,paid_amount_minor
  ) values (
    p_provider_session_id,p_organization_id,p_user_id,p_pack_id,p_credit_amount,p_paid_amount_minor
  ) on conflict (provider_session_id) do nothing;

  return jsonb_build_object(
    'credited',true,'duplicate',false,'balance_wb',new_balance,
    'recovery_debt_repaid_wb',debt_repaid,'recovery_debt_wb',greatest(0,wallet_row.recovery_debt_wb-debt_repaid),
    'ledger_id',ledger_id
  );
end;
$$;
revoke all on function public.apply_whilo_credit_purchase(uuid,uuid,text,text,text,bigint,bigint,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.apply_whilo_credit_purchase(uuid,uuid,text,text,text,bigint,bigint,text,jsonb)
  to service_role;

create or replace function public.reverse_whilo_credit_purchase(
  p_organization_id uuid,
  p_user_id uuid,
  p_provider_event_id text,
  p_provider_session_id text,
  p_refund_total_minor bigint,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  purchase_row public.whilo_credit_ledger%rowtype;
  state_row public.whilo_credit_purchase_state%rowtype;
  wallet_row public.whilo_credit_wallets%rowtype;
  prior_event public.whilo_credit_reversal_events%rowtype;
  v_refund_minor bigint;
  v_target_reversed bigint;
  v_delta bigint;
  v_debit bigint := 0;
  v_debt_added bigint := 0;
  v_debt_cleared bigint := 0;
  v_restore_credit bigint := 0;
  v_new_balance bigint;
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if p_organization_id is null or p_user_id is null
    or coalesce(p_provider_event_id,'') = ''
    or coalesce(p_provider_session_id,'') = ''
    or p_refund_total_minor is null or p_refund_total_minor < 0
    or p_reason not in ('refund','dispute_opened','dispute_won')
    or jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'invalid_credit_reversal' using errcode='22023';
  end if;

  select * into prior_event from public.whilo_credit_reversal_events
  where provider_event_id=p_provider_event_id;
  if found then
    return jsonb_build_object('reversed',false,'duplicate',true,'delta_wb',prior_event.delta_wb);
  end if;

  -- Lock order is workspace wallet first, then purchase state, matching the top-up RPC.
  select * into wallet_row from public.whilo_credit_wallets
  where organization_id=p_organization_id for update;
  if not found then raise exception 'credit_wallet_not_found' using errcode='P0002'; end if;

  select * into purchase_row from public.whilo_credit_ledger
  where provider_session_id=p_provider_session_id and organization_id=p_organization_id
    and user_id=p_user_id and kind='topup'
  for update;
  if not found or purchase_row.amount_wb <= 0 or purchase_row.amount_paid_minor <= 0 then
    raise exception 'credit_purchase_not_found' using errcode='P0002';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=p_user_id
  ) then raise exception 'workspace_access_denied' using errcode='42501'; end if;

  insert into public.whilo_credit_purchase_state(
    provider_session_id,organization_id,user_id,pack_id,total_credits_wb,paid_amount_minor
  ) values (
    p_provider_session_id,p_organization_id,p_user_id,coalesce(purchase_row.pack_id,'unknown'),
    purchase_row.amount_wb,purchase_row.amount_paid_minor
  ) on conflict (provider_session_id) do nothing;

  select * into state_row from public.whilo_credit_purchase_state
  where provider_session_id=p_provider_session_id for update;

  if state_row.organization_id <> p_organization_id or state_row.user_id <> p_user_id then
    raise exception 'credit_purchase_owner_mismatch' using errcode='42501';
  end if;

  if p_reason='dispute_opened' then
    v_refund_minor := state_row.paid_amount_minor;
  elsif p_reason='dispute_won' then
    v_refund_minor := least(p_refund_total_minor,state_row.paid_amount_minor);
  else
    v_refund_minor := greatest(state_row.total_refunded_minor,least(p_refund_total_minor,state_row.paid_amount_minor));
  end if;

  v_target_reversed := least(state_row.total_credits_wb,
    ceil(state_row.total_credits_wb::numeric*v_refund_minor/state_row.paid_amount_minor)::bigint);
  if p_reason <> 'dispute_won' then
    v_target_reversed := greatest(state_row.total_reversed_wb,v_target_reversed);
  end if;
  v_delta := v_target_reversed-state_row.total_reversed_wb;

  if v_delta > 0 then
    v_debit := least(wallet_row.balance_wb,v_delta);
    v_debt_added := v_delta-v_debit;
    v_new_balance := wallet_row.balance_wb-v_debit;
    update public.whilo_credit_wallets
    set balance_wb=v_new_balance,recovery_debt_wb=recovery_debt_wb+v_debt_added
    where organization_id=p_organization_id;
    update public.whilo_credit_purchase_state
    set total_refunded_minor=v_refund_minor,total_reversed_wb=v_target_reversed,
        recovery_debt_wb=recovery_debt_wb+v_debt_added,updated_at=now()
    where provider_session_id=p_provider_session_id;
    if v_debit > 0 then
      insert into public.whilo_credit_ledger(
        organization_id,user_id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,
        idempotency_key,reference,metadata
      ) values (
        p_organization_id,p_user_id,'refund',-v_debit,v_new_balance,0,'brl',
        'credit-refund:'||p_provider_event_id,p_provider_session_id,
        v_metadata||jsonb_build_object('reason',p_reason,'delta_wb',v_delta,'debt_added_wb',v_debt_added,
          'refund_total_minor',v_refund_minor)
      );
    end if;
  elsif v_delta < 0 then
    -- A won dispute restores credits that were clawed back; any still-unpaid debt is cleared first.
    v_debt_cleared := least(-v_delta,state_row.recovery_debt_wb);
    v_restore_credit := (-v_delta)-v_debt_cleared;
    v_new_balance := wallet_row.balance_wb+v_restore_credit;
    update public.whilo_credit_wallets
    set balance_wb=v_new_balance,
        recovery_debt_wb=greatest(0,recovery_debt_wb-v_debt_cleared)
    where organization_id=p_organization_id;
    update public.whilo_credit_purchase_state
    set total_refunded_minor=v_refund_minor,total_reversed_wb=v_target_reversed,
        recovery_debt_wb=recovery_debt_wb-v_debt_cleared,updated_at=now()
    where provider_session_id=p_provider_session_id;
    if v_restore_credit > 0 then
      insert into public.whilo_credit_ledger(
        organization_id,user_id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,
        idempotency_key,reference,metadata
      ) values (
        p_organization_id,p_user_id,'adjustment',v_restore_credit,v_new_balance,0,'brl',
        'credit-dispute-won:'||p_provider_event_id,p_provider_session_id,
        v_metadata||jsonb_build_object('reason',p_reason,'restored_wb',v_restore_credit,'debt_cleared_wb',v_debt_cleared)
      );
    end if;
  else
    update public.whilo_credit_purchase_state
    set total_refunded_minor=v_refund_minor,updated_at=now()
    where provider_session_id=p_provider_session_id;
  end if;

  insert into public.whilo_credit_reversal_events(
    provider_event_id,provider_session_id,organization_id,reason,refund_total_minor,
    delta_wb,debited_wb,debt_added_wb,debt_cleared_wb,event_metadata
  ) values (
    p_provider_event_id,p_provider_session_id,p_organization_id,p_reason,v_refund_minor,
    v_delta,v_debit,v_debt_added,v_debt_cleared,v_metadata
  );

  return jsonb_build_object(
    'reversed',v_delta<>0,'duplicate',false,'delta_wb',v_delta,
    'debited_wb',v_debit,'debt_added_wb',v_debt_added,'debt_cleared_wb',v_debt_cleared,
    'balance_wb',v_new_balance
  );
end;
$$;
revoke all on function public.reverse_whilo_credit_purchase(uuid,uuid,text,text,bigint,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.reverse_whilo_credit_purchase(uuid,uuid,text,text,bigint,text,jsonb)
  to service_role;

comment on table public.whilo_credit_purchase_state is
  'State for each purchased credit pack, with cumulative refunds, credits reversed and still-unrecovered clawback debt.';
comment on table public.whilo_credit_reversal_events is
  'Idempotent audit ledger for Stripe refunds and disputes; unique provider event IDs prevent duplicate credit reversals.';
comment on column public.whilo_credit_wallets.recovery_debt_wb is
  'Non-spendable WB debt created when credits have already been consumed before a verified refund/dispute; future top-ups repay it first.';

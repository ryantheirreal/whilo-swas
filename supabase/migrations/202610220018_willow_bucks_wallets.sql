-- Willow Bucks (WB): prepaid, non-transferable platform usage credits. Not money or crypto.
-- Provider usage is only debited by the trusted server/runtime after verified usage metering.
create table if not exists public.whilo_credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance_wb bigint not null default 0 check (balance_wb >= 0),
  total_purchased_wb bigint not null default 0 check (total_purchased_wb >= 0),
  total_spent_wb bigint not null default 0 check (total_spent_wb >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.whilo_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.whilo_credit_wallets(organization_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('topup','usage','refund','adjustment')),
  amount_wb bigint not null check (amount_wb <> 0),
  balance_after_wb bigint not null check (balance_after_wb >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  currency text not null default 'brl' check (currency = lower(currency)),
  pack_id text,
  provider_event_id text unique,
  provider_session_id text unique,
  idempotency_key text not null unique,
  reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists whilo_credit_ledger_org_created_idx
  on public.whilo_credit_ledger(organization_id,created_at desc);
create index if not exists whilo_credit_ledger_org_kind_created_idx
  on public.whilo_credit_ledger(organization_id,kind,created_at desc);

alter table public.whilo_credit_wallets enable row level security;
alter table public.whilo_credit_ledger enable row level security;
revoke all on public.whilo_credit_wallets,public.whilo_credit_ledger from public,anon,authenticated;
grant all privileges on public.whilo_credit_wallets,public.whilo_credit_ledger to service_role;
grant usage,select on all sequences in schema public to service_role;

drop trigger if exists whilo_credit_wallets_updated_at on public.whilo_credit_wallets;
create trigger whilo_credit_wallets_updated_at before update on public.whilo_credit_wallets
for each row execute function public.set_updated_at();

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
  new_balance bigint;
  currency_value text := lower(coalesce(nullif(p_currency,''),'brl'));
begin
  if p_organization_id is null or p_user_id is null
    or coalesce(p_provider_event_id,'') = ''
    or coalesce(p_provider_session_id,'') = ''
    or coalesce(p_pack_id,'') = ''
    or p_credit_amount is null or p_credit_amount <= 0
    or p_paid_amount_minor is null or p_paid_amount_minor <= 0
    or currency_value <> 'brl'
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then
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

  insert into public.whilo_credit_ledger(
    organization_id,user_id,kind,amount_wb,balance_after_wb,amount_paid_minor,currency,
    pack_id,provider_event_id,provider_session_id,idempotency_key,reference,metadata
  ) values (
    p_organization_id,p_user_id,'topup',p_credit_amount,0,p_paid_amount_minor,currency_value,
    p_pack_id,p_provider_event_id,p_provider_session_id,'stripe-session:'||p_provider_session_id,
    p_provider_session_id,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict do nothing
  returning id into ledger_id;

  if ledger_id is null then
    return jsonb_build_object('credited',false,'duplicate',true);
  end if;

  update public.whilo_credit_wallets
  set balance_wb=balance_wb+p_credit_amount,
      total_purchased_wb=total_purchased_wb+p_credit_amount
  where organization_id=p_organization_id
  returning balance_wb into new_balance;

  update public.whilo_credit_ledger set balance_after_wb=new_balance where id=ledger_id;
  return jsonb_build_object('credited',true,'duplicate',false,'balance_wb',new_balance,'ledger_id',ledger_id);
end;
$$;
revoke all on function public.apply_whilo_credit_purchase(uuid,uuid,text,text,text,bigint,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_whilo_credit_purchase(uuid,uuid,text,text,text,bigint,bigint,text,jsonb) to service_role;

-- Price usage credits from verified server-side provider cost. 60% of retail value
-- is the maximum direct provider-cost share; the remaining 40% covers payment fees,
-- taxes, infrastructure and margin. Runtime must use actual verified provider invoices.
create or replace function public.whilo_bucks_for_provider_cost(p_provider_cost_minor bigint)
returns bigint
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_provider_cost_minor is null or p_provider_cost_minor <= 0 then 0
    else ceil(p_provider_cost_minor::numeric * 10000 / 6000)::bigint
  end
$$;
revoke all on function public.whilo_bucks_for_provider_cost(bigint) from public,anon,authenticated;
grant execute on function public.whilo_bucks_for_provider_cost(bigint) to service_role;

comment on table public.whilo_credit_wallets is 'Workspace Willow Bucks wallet; balance changes only through trusted server RPC transactions.';
comment on table public.whilo_credit_ledger is 'Append-only top-up and usage ledger; Stripe sessions/events and idempotency keys prevent double-crediting.';
comment on function public.whilo_bucks_for_provider_cost(bigint) is 'Charges at least 1.6667 WB per cent of verified direct provider cost; direct COGS is capped at 60% of nominal WB value.';

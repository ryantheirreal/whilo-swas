-- Whilo Affiliate Growth: direct referrals, one-level partner override, immutable commissions,
-- rank progression by actual collected sales, and a payout review ledger. Not a recruitment-fee scheme.

create table if not exists public.affiliate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_code text not null unique,
  display_name text not null default 'Whilo Partner' check (length(trim(display_name)) between 2 and 80),
  parent_affiliate_user_id uuid references public.affiliate_profiles(user_id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','blocked')),
  tier text not null default 'Seed' check (tier in ('Seed','Bronze','Silver','Gold','Platinum','Diamond','Apex','Sovereign')),
  terms_version text not null default '2026-10-22',
  terms_accepted_at timestamptz not null default now(),
  stripe_account_id text unique,
  stripe_details_submitted boolean not null default false,
  stripe_transfers_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_affiliate_user_id is null or parent_affiliate_user_id <> user_id)
);
create index if not exists affiliate_profiles_parent_idx on public.affiliate_profiles(parent_affiliate_user_id,status);
create index if not exists affiliate_profiles_tier_idx on public.affiliate_profiles(tier,status);

create table if not exists public.affiliate_referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
  referral_code text not null,
  attribution_source text not null default 'link' check (attribution_source in ('link','creator','campaign','manual')),
  status text not null default 'attributed' check (status in ('attributed','qualified','blocked')),
  created_at timestamptz not null default now(),
  first_paid_at timestamptz,
  first_paid_source text,
  constraint affiliate_no_self_referral check (referred_user_id <> affiliate_user_id)
);
create index if not exists affiliate_referrals_owner_idx on public.affiliate_referrals(affiliate_user_id,created_at desc);
create index if not exists affiliate_referrals_quality_idx on public.affiliate_referrals(affiliate_user_id,status,first_paid_at);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
  direct_affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
  referred_user_id uuid not null references auth.users(id) on delete restrict,
  source_type text not null check (source_type in ('subscription','marketplace')),
  source_id text not null,
  source_amount_minor bigint not null check (source_amount_minor > 0),
  currency text not null default 'brl' check (currency = lower(currency)),
  rate_bps integer not null check (rate_bps between 1 and 2500),
  commission_minor bigint not null check (commission_minor > 0 and commission_minor <= source_amount_minor),
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')),
  available_at timestamptz not null default (now() + interval '30 days'),
  payout_id uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (source_type,source_id,affiliate_user_id),
  check (affiliate_user_id = direct_affiliate_user_id or rate_bps in (200,500)),
  check (rate_bps in (200,500,2000))
);
create index if not exists affiliate_commissions_balance_idx on public.affiliate_commissions(affiliate_user_id,status,available_at,created_at desc);
create index if not exists affiliate_commissions_direct_gmv_idx on public.affiliate_commissions(direct_affiliate_user_id,source_type,created_at desc);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 10000),
  currency text not null default 'brl' check (currency = lower(currency)),
  status text not null default 'requested' check (status in ('requested','processing','paid','failed','cancelled')),
  stripe_transfer_id text unique,
  idempotency_key text not null unique,
  failure_code text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_payouts_queue_idx on public.affiliate_payouts(status,requested_at);

create table if not exists public.affiliate_payout_items (
  payout_id uuid not null references public.affiliate_payouts(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id,commission_id)
);

alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.affiliate_payout_items enable row level security;

revoke all on public.affiliate_profiles,public.affiliate_referrals,public.affiliate_commissions,public.affiliate_payouts,public.affiliate_payout_items from anon,authenticated;
grant all privileges on public.affiliate_profiles,public.affiliate_referrals,public.affiliate_commissions,public.affiliate_payouts,public.affiliate_payout_items to service_role;
grant usage,select on all sequences in schema public to service_role;

drop trigger if exists affiliate_profiles_updated_at on public.affiliate_profiles;
create trigger affiliate_profiles_updated_at before update on public.affiliate_profiles
for each row execute function public.set_updated_at();

create or replace function public.register_whilo_affiliate(p_user_id uuid,p_display_name text default null)
returns table(affiliate_user_id uuid,affiliate_code text,parent_affiliate_user_id uuid,tier text,status text)
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  existing_row public.affiliate_profiles%rowtype;
  parent_id uuid;
  code_value text;
  name_value text;
begin
  select * into existing_row from public.affiliate_profiles where user_id=p_user_id;
  if found then
    return query select existing_row.user_id,existing_row.affiliate_code,existing_row.parent_affiliate_user_id,existing_row.tier,existing_row.status;
    return;
  end if;

  select r.affiliate_user_id into parent_id
  from public.affiliate_referrals r
  where r.referred_user_id=p_user_id and r.status <> 'blocked'
  limit 1;
  if parent_id=p_user_id then parent_id := null; end if;

  name_value := left(coalesce(nullif(trim(p_display_name),''),'Whilo Partner'),80);
  loop
    code_value := 'WH' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    exit when not exists(select 1 from public.affiliate_profiles where affiliate_code=code_value);
  end loop;

  insert into public.affiliate_profiles(user_id,affiliate_code,display_name,parent_affiliate_user_id,status)
  values(p_user_id,code_value,name_value,parent_id,'active')
  returning * into existing_row;
  return query select existing_row.user_id,existing_row.affiliate_code,existing_row.parent_affiliate_user_id,existing_row.tier,existing_row.status;
end;
$$;
revoke all on function public.register_whilo_affiliate(uuid,text) from public,anon,authenticated;
grant execute on function public.register_whilo_affiliate(uuid,text) to service_role;

create or replace function public.claim_whilo_affiliate_referral(p_referred_user_id uuid,p_affiliate_code text,p_source text default 'link')
returns boolean
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  affiliate_row public.affiliate_profiles%rowtype;
begin
  if p_referred_user_id is null or length(trim(coalesce(p_affiliate_code,''))) < 4 then return false; end if;
  select * into affiliate_row from public.affiliate_profiles
  where upper(affiliate_code)=upper(trim(p_affiliate_code)) and status='active'
  limit 1;
  if not found or affiliate_row.user_id=p_referred_user_id then return false; end if;

  insert into public.affiliate_referrals(referred_user_id,affiliate_user_id,referral_code,attribution_source)
  values(p_referred_user_id,affiliate_row.user_id,affiliate_row.affiliate_code,
    case when p_source in ('creator','campaign','manual') then p_source else 'link' end)
  on conflict (referred_user_id) do nothing;
  return exists(select 1 from public.affiliate_referrals r
    where r.referred_user_id=p_referred_user_id and r.affiliate_user_id=affiliate_row.user_id);
end;
$$;
revoke all on function public.claim_whilo_affiliate_referral(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_whilo_affiliate_referral(uuid,text,text) to service_role;

create or replace function public.record_whilo_affiliate_commission(
  p_referred_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_amount_minor bigint,
  p_currency text default 'brl'
)
returns integer
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  referral_row public.affiliate_referrals%rowtype;
  direct_row public.affiliate_profiles%rowtype;
  inserted_count integer := 0;
  direct_rate integer;
  override_rate integer;
  commission_amount bigint;
  bill_currency text;
  now_paid timestamptz := now();
begin
  if p_source_type not in ('subscription','marketplace') or coalesce(p_source_id,'')='' or p_amount_minor is null or p_amount_minor <= 0 then return 0; end if;
  bill_currency := lower(coalesce(nullif(p_currency,''),'brl'));
  if bill_currency <> 'brl' then return 0; end if;

  select * into referral_row from public.affiliate_referrals
  where referred_user_id=p_referred_user_id and status <> 'blocked'
  for update;
  if not found then return 0; end if;
  select * into direct_row from public.affiliate_profiles where user_id=referral_row.affiliate_user_id and status='active';
  if not found then return 0; end if;

  if p_source_type='subscription' then
    if referral_row.first_paid_at is null then
      update public.affiliate_referrals set first_paid_at=now_paid,first_paid_source=p_source_id,status='qualified'
      where referred_user_id=p_referred_user_id;
      referral_row.first_paid_at := now_paid;
    end if;
    if referral_row.first_paid_at + interval '12 months' < now_paid then return 0; end if;
    direct_rate := 2000;
    override_rate := 500;
  else
    update public.affiliate_referrals set status='qualified' where referred_user_id=p_referred_user_id and status='attributed';
    direct_rate := 500;
    override_rate := 200;
  end if;

  commission_amount := floor(p_amount_minor::numeric * direct_rate / 10000)::bigint;
  if commission_amount > 0 then
    insert into public.affiliate_commissions(
      affiliate_user_id,direct_affiliate_user_id,referred_user_id,source_type,source_id,
      source_amount_minor,currency,rate_bps,commission_minor,status,available_at
    ) values (
      referral_row.affiliate_user_id,referral_row.affiliate_user_id,p_referred_user_id,p_source_type,p_source_id,
      p_amount_minor,bill_currency,direct_rate,commission_amount,'pending',now_paid + interval '30 days'
    ) on conflict (source_type,source_id,affiliate_user_id) do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  select * into direct_row from public.affiliate_profiles where user_id=referral_row.affiliate_user_id and status='active';
  if found and direct_row.parent_affiliate_user_id is not null then
    commission_amount := floor(p_amount_minor::numeric * override_rate / 10000)::bigint;
    if commission_amount > 0 then
      insert into public.affiliate_commissions(
        affiliate_user_id,direct_affiliate_user_id,referred_user_id,source_type,source_id,
        source_amount_minor,currency,rate_bps,commission_minor,status,available_at
      ) values (
        direct_row.parent_affiliate_user_id,referral_row.affiliate_user_id,p_referred_user_id,p_source_type,p_source_id,
        p_amount_minor,bill_currency,override_rate,commission_amount,'pending',now_paid + interval '30 days'
      ) on conflict (source_type,source_id,affiliate_user_id) do nothing;
      if found then inserted_count := inserted_count + 1; end if;
    end if;
  end if;
  return inserted_count;
end;
$$;
revoke all on function public.record_whilo_affiliate_commission(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_whilo_affiliate_commission(uuid,text,text,bigint,text) to service_role;

create or replace function public.refresh_whilo_affiliate_tier(p_user_id uuid)
returns text
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  paid_referrals bigint := 0;
  attributed_sales bigint := 0;
  tier_value text := 'Seed';
begin
  select count(*) into paid_referrals from public.affiliate_referrals
  where affiliate_user_id=p_user_id and status='qualified' and first_paid_at is not null;
  select coalesce(sum(c.source_amount_minor),0)::bigint into attributed_sales
  from public.affiliate_commissions c
  where c.affiliate_user_id=p_user_id and c.direct_affiliate_user_id=p_user_id and c.status <> 'reversed';

  tier_value := case
    when paid_referrals >= 1000 and attributed_sales >= 200000000 then 'Sovereign'
    when paid_referrals >= 250 and attributed_sales >= 50000000 then 'Apex'
    when paid_referrals >= 100 and attributed_sales >= 10000000 then 'Diamond'
    when paid_referrals >= 50 and attributed_sales >= 2500000 then 'Platinum'
    when paid_referrals >= 25 and attributed_sales >= 750000 then 'Gold'
    when paid_referrals >= 10 and attributed_sales >= 200000 then 'Silver'
    when paid_referrals >= 3 and attributed_sales >= 50000 then 'Bronze'
    else 'Seed' end;
  update public.affiliate_profiles set tier=tier_value,updated_at=now() where user_id=p_user_id;
  return tier_value;
end;
$$;
revoke all on function public.refresh_whilo_affiliate_tier(uuid) from public,anon,authenticated;
grant execute on function public.refresh_whilo_affiliate_tier(uuid) to service_role;

create or replace function public.request_whilo_affiliate_payout(p_user_id uuid)
returns table(payout_id uuid,amount_minor bigint,status text)
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  total_amount bigint := 0;
  new_payout_id uuid;
  idempotency_value text;
  commission_row record;
begin
  perform 1 from public.affiliate_profiles where user_id=p_user_id and status='active' for update;
  if not found then raise exception 'affiliate_not_active' using errcode='42501'; end if;

  select coalesce(sum(c.commission_minor),0)::bigint into total_amount
  from public.affiliate_commissions c
  where c.affiliate_user_id=p_user_id and c.status='available' and c.available_at <= now()
    and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id)
  for update;
  if total_amount < 10000 then raise exception 'minimum_payout_is_R$100' using errcode='22023'; end if;

  idempotency_value := 'whilo-affiliate-payout-' || replace(gen_random_uuid()::text,'-','');
  insert into public.affiliate_payouts(affiliate_user_id,amount_minor,currency,status,idempotency_key)
  values(p_user_id,total_amount,'brl','requested',idempotency_value)
  returning id into new_payout_id;

  for commission_row in
    select c.id,c.commission_minor from public.affiliate_commissions c
    where c.affiliate_user_id=p_user_id and c.status='available' and c.available_at <= now()
      and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id)
    order by c.available_at,c.created_at
    for update skip locked
  loop
    insert into public.affiliate_payout_items(payout_id,commission_id,amount_minor)
    values(new_payout_id,commission_row.id,commission_row.commission_minor);
  end loop;

  select sum(i.amount_minor)::bigint into total_amount from public.affiliate_payout_items i where i.payout_id=new_payout_id;
  update public.affiliate_payouts set amount_minor=total_amount where id=new_payout_id;
  return query select new_payout_id,total_amount,'requested'::text;
end;
$$;
revoke all on function public.request_whilo_affiliate_payout(uuid) from public,anon,authenticated;
grant execute on function public.request_whilo_affiliate_payout(uuid) to service_role;

create or replace function public.prevent_affiliate_commission_economic_mutation()
returns trigger language plpgsql set search_path = pg_catalog,public as $$
begin
  if row(new.affiliate_user_id,new.direct_affiliate_user_id,new.referred_user_id,new.source_type,new.source_id,new.source_amount_minor,new.currency,new.rate_bps,new.commission_minor,new.available_at)
     is distinct from
     row(old.affiliate_user_id,old.direct_affiliate_user_id,old.referred_user_id,old.source_type,old.source_id,old.source_amount_minor,old.currency,old.rate_bps,old.commission_minor,old.available_at) then
    raise exception 'Affiliate commission economics are immutable' using errcode='22000';
  end if;
  return new;
end;
$$;
create trigger affiliate_commissions_snapshot_immutable before update on public.affiliate_commissions
for each row execute function public.prevent_affiliate_commission_economic_mutation();
revoke all on function public.prevent_affiliate_commission_economic_mutation() from public,anon,authenticated;

comment on table public.affiliate_profiles is 'Affiliates earn only on eligible collected Whilo sales. One upline override is paid on direct affiliate sales; no compensation is paid for recruitment itself.';
comment on table public.affiliate_commissions is 'Immutable commission liability ledger, held for 30 days before availability. Subscription 20% direct + 5% single upline for the first 12 months; marketplace 5% direct + 2% single upline from Whilo platform commission.';
comment on table public.affiliate_payouts is 'Payout request ledger. Execution remains server-side and requires verified Stripe Connect account state and sufficient platform balance.';

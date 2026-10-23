-- Affiliate ledger v2: qualify marketplace referrals, reverse refunds/disputes,
-- and net previously paid commissions against future payouts.

create table if not exists public.affiliate_adjustments (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.affiliate_profiles(user_id) on delete restrict,
  source_type text not null check (source_type in ('subscription','marketplace')),
  source_id text not null,
  reason text not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'open' check (status in ('open','applied','void')),
  payout_id uuid references public.affiliate_payouts(id) on delete restrict,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (affiliate_user_id,source_type,source_id,reason)
);
create index if not exists affiliate_adjustments_open_idx
  on public.affiliate_adjustments(affiliate_user_id,status,created_at);
alter table public.affiliate_adjustments enable row level security;
revoke all on public.affiliate_adjustments from anon,authenticated;
grant all privileges on public.affiliate_adjustments to service_role;

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
    update public.affiliate_referrals set status='qualified',first_paid_at=coalesce(first_paid_at,now_paid),first_paid_source=coalesce(first_paid_source,p_source_id) where referred_user_id=p_referred_user_id and status <> 'blocked';
    referral_row.first_paid_at := coalesce(referral_row.first_paid_at,now_paid);
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

create or replace function public.reverse_whilo_affiliate_source(
  p_source_type text,
  p_source_id text,
  p_reason text default 'refund_or_dispute'
)
returns integer
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  commission_row record;
  reversed_count integer := 0;
  reason_value text := left(coalesce(nullif(trim(p_reason),''),'refund_or_dispute'),80);
begin
  if p_source_type not in ('subscription','marketplace') or coalesce(p_source_id,'')='' then return 0; end if;
  for commission_row in
    select * from public.affiliate_commissions
    where source_type=p_source_type and source_id=p_source_id and status <> 'reversed'
    for update
  loop
    if commission_row.status='paid' then
      insert into public.affiliate_adjustments(
        affiliate_user_id,source_type,source_id,reason,amount_minor,status
      ) values(
        commission_row.affiliate_user_id,p_source_type,p_source_id,reason_value,commission_row.commission_minor,'open'
      ) on conflict (affiliate_user_id,source_type,source_id,reason) do nothing;
    end if;
    if commission_row.payout_id is not null then
      update public.affiliate_payouts set status='failed',failure_code='ledger_reversed_before_transfer'
      where id=commission_row.payout_id and status in ('requested','processing');
    end if;
    update public.affiliate_commissions set status='reversed' where id=commission_row.id;
    reversed_count := reversed_count + 1;
  end loop;
  return reversed_count;
end;
$$;
revoke all on function public.reverse_whilo_affiliate_source(text,text,text) from public,anon,authenticated;
grant execute on function public.reverse_whilo_affiliate_source(text,text,text) to service_role;
create or replace function public.request_whilo_affiliate_payout(p_user_id uuid)
returns table(payout_id uuid,amount_minor bigint,status text)
language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  gross_amount bigint := 0;
  debt_amount bigint := 0;
  net_amount bigint := 0;
  new_payout_id uuid;
  idempotency_value text;
  commission_row record;
begin
  perform 1 from public.affiliate_profiles where user_id=p_user_id and status='active' for update;
  if not found then raise exception 'affiliate_not_active' using errcode='42501'; end if;

  select coalesce(sum(c.commission_minor),0)::bigint into gross_amount
  from public.affiliate_commissions c
  where c.affiliate_user_id=p_user_id and c.status='available' and c.available_at <= now()
    and c.payout_id is null
    and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id);
  select coalesce(sum(a.amount_minor),0)::bigint into debt_amount
  from public.affiliate_adjustments a where a.affiliate_user_id=p_user_id and a.status='open' and a.payout_id is null;
  net_amount := gross_amount - debt_amount;
  if net_amount < 10000 then raise exception 'minimum_payout_is_R$100_after_adjustments' using errcode='22023'; end if;

  idempotency_value := 'whilo-affiliate-payout-' || replace(gen_random_uuid()::text,'-','');
  insert into public.affiliate_payouts(affiliate_user_id,amount_minor,currency,status,idempotency_key)
  values(p_user_id,net_amount,'brl','requested',idempotency_value)
  returning id into new_payout_id;

  for commission_row in
    select c.id,c.commission_minor from public.affiliate_commissions c
    where c.affiliate_user_id=p_user_id and c.status='available' and c.available_at <= now()
      and c.payout_id is null
      and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id)
    order by c.available_at,c.created_at
    for update skip locked
  loop
    insert into public.affiliate_payout_items(payout_id,commission_id,amount_minor)
    values(new_payout_id,commission_row.id,commission_row.commission_minor);
  end loop;

  select coalesce(sum(i.amount_minor),0)::bigint into gross_amount
  from public.affiliate_payout_items i where i.payout_id=new_payout_id;
  select coalesce(sum(a.amount_minor),0)::bigint into debt_amount
  from public.affiliate_adjustments a where a.affiliate_user_id=p_user_id and a.status='open' and a.payout_id is null;
  net_amount := gross_amount - debt_amount;
  if net_amount < 10000 then raise exception 'minimum_payout_is_R$100_after_adjustments' using errcode='22023'; end if;

  update public.affiliate_payouts set amount_minor=net_amount where id=new_payout_id;
  update public.affiliate_commissions c set payout_id=new_payout_id
  from public.affiliate_payout_items i where i.payout_id=new_payout_id and i.commission_id=c.id;
  update public.affiliate_adjustments set payout_id=new_payout_id
  where affiliate_user_id=p_user_id and status='open' and payout_id is null;
  return query select new_payout_id,net_amount,'requested'::text;
end;
$$;
revoke all on function public.request_whilo_affiliate_payout(uuid) from public,anon,authenticated;
grant execute on function public.request_whilo_affiliate_payout(uuid) to service_role;

create or replace function public.prevent_affiliate_adjustment_economic_mutation()
returns trigger language plpgsql set search_path = pg_catalog,public as $$
begin
  if row(new.affiliate_user_id,new.source_type,new.source_id,new.reason,new.amount_minor)
     is distinct from
     row(old.affiliate_user_id,old.source_type,old.source_id,old.reason,old.amount_minor) then
    raise exception 'Affiliate adjustment economics are immutable' using errcode='22000';
  end if;
  return new;
end;
$$;
create trigger affiliate_adjustments_snapshot_immutable before update on public.affiliate_adjustments
for each row execute function public.prevent_affiliate_adjustment_economic_mutation();
revoke all on function public.prevent_affiliate_adjustment_economic_mutation() from public,anon,authenticated;

comment on table public.affiliate_adjustments is 'A refunded/disputed sale reverses unpaid commission; previously-paid commission creates an offset against future payouts.';
comment on function public.reverse_whilo_affiliate_source(text,text,text) is 'Idempotently reverses commission liabilities for a refunded or disputed Stripe source and records debit adjustments if funds were already transferred.';

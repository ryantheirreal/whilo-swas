-- Atomic, idempotent usage charging from trusted server-side provider cost.
-- Client/browser code must never be permitted to choose p_provider_cost_minor.
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
    metadata_value||jsonb_build_object('provider_cost_minor',p_provider_cost_minor,'margin_model','provider_cost_cap_60pct')
  ) returning id into ledger_id;

  return jsonb_build_object('charged',true,'duplicate',false,'amount_wb',bill_wb,
    'balance_wb',new_balance,'ledger_id',ledger_id,'provider_cost_minor',p_provider_cost_minor);
end;
$$;
revoke all on function public.charge_whilo_usage(uuid,uuid,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.charge_whilo_usage(uuid,uuid,text,bigint,text,jsonb) to service_role;
comment on function public.charge_whilo_usage(uuid,uuid,text,bigint,text,jsonb) is
  'Atomic Willow Bucks debit for verified direct provider cost. Service-role only; browser-supplied cost is not trusted. Idempotent per wallet ledger key.';

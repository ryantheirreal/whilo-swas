-- Claim affiliate payouts atomically so only one server request can initiate a transfer.
alter table public.affiliate_payouts
  add column if not exists processing_at timestamptz;

create index if not exists affiliate_payouts_stale_processing_idx
  on public.affiliate_payouts(processing_at)
  where status = 'processing';

create or replace function public.claim_whilo_affiliate_payout(p_payout_id uuid)
returns setof public.affiliate_payouts
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.affiliate_payouts p
     set status = 'processing',
         processing_at = now(),
         failure_code = null
   where p.id = p_payout_id
     and p.status in ('requested','failed')
  returning p.*;
$$;
revoke all on function public.claim_whilo_affiliate_payout(uuid) from public, anon, authenticated;
grant execute on function public.claim_whilo_affiliate_payout(uuid) to service_role;
comment on function public.claim_whilo_affiliate_payout(uuid) is
  'Atomic single-winner claim for an affiliate payout. Processing payouts cannot be claimed twice; Stripe idempotency remains a separate defense.';

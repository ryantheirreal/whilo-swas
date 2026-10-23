-- Exact aggregate affiliate metrics for rank/progress dashboards; do not infer totals from a truncated UI page.
create or replace function public.whilo_affiliate_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog,public
as $$
  select jsonb_build_object(
    'total_referrals',
      (select count(*) from public.affiliate_referrals r where r.affiliate_user_id=p_user_id and r.status <> 'blocked'),
    'paid_referrals',
      (select count(*) from public.affiliate_referrals r where r.affiliate_user_id=p_user_id and r.status='qualified' and r.first_paid_at is not null),
    'direct_sales_minor',
      coalesce((select sum(c.source_amount_minor) from public.affiliate_commissions c
        where c.affiliate_user_id=p_user_id and c.direct_affiliate_user_id=p_user_id and c.status <> 'reversed'),0),
    'total_earned_minor',
      greatest(0,
        coalesce((select sum(c.commission_minor) from public.affiliate_commissions c
          where c.affiliate_user_id=p_user_id and c.status <> 'reversed'),0)
        - coalesce((select sum(a.amount_minor) from public.affiliate_adjustments a
          where a.affiliate_user_id=p_user_id and a.status in ('open','applied')),0)),
    'pending_minor',
      coalesce((select sum(c.commission_minor) from public.affiliate_commissions c
        where c.affiliate_user_id=p_user_id and c.status='pending'),0),
    'available_gross_minor',
      coalesce((select sum(c.commission_minor) from public.affiliate_commissions c
        where c.affiliate_user_id=p_user_id and c.status='available' and c.payout_id is null
          and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id)),0),
    'outstanding_adjustments_minor',
      coalesce((select sum(a.amount_minor) from public.affiliate_adjustments a
        where a.affiliate_user_id=p_user_id and a.status='open' and a.payout_id is null),0),
    'available_minor',
      greatest(0,
        coalesce((select sum(c.commission_minor) from public.affiliate_commissions c
          where c.affiliate_user_id=p_user_id and c.status='available' and c.payout_id is null
            and not exists(select 1 from public.affiliate_payout_items i where i.commission_id=c.id)),0)
        - coalesce((select sum(a.amount_minor) from public.affiliate_adjustments a
          where a.affiliate_user_id=p_user_id and a.status='open' and a.payout_id is null),0)),
    'paid_minor',
      coalesce((select sum(c.commission_minor) from public.affiliate_commissions c
        where c.affiliate_user_id=p_user_id and c.status='paid'),0),
    'in_payout_minor',
      coalesce((select sum(p.amount_minor) from public.affiliate_payouts p
        where p.affiliate_user_id=p_user_id and p.status in ('requested','processing')),0),
    'active_sub_affiliates',
      (select count(*) from public.affiliate_profiles a
        where a.parent_affiliate_user_id=p_user_id and a.status='active')
  );
$$;
revoke all on function public.whilo_affiliate_summary(uuid) from public,anon,authenticated;
grant execute on function public.whilo_affiliate_summary(uuid) to service_role;
comment on function public.whilo_affiliate_summary(uuid) is 'Returns exact full-ledger counters and net available payout balance for an authenticated server route; UI pagination never defines rank.';

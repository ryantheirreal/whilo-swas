-- Cover foreign keys introduced by Willow Bucks reversal and refund recovery.
create index if not exists whilo_credit_purchase_state_user_fk_idx
  on public.whilo_credit_purchase_state(user_id);
create index if not exists whilo_credit_reversal_events_org_fk_idx
  on public.whilo_credit_reversal_events(organization_id);

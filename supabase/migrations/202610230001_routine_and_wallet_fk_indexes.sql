-- Cover the remaining foreign keys added by the Routines and Willow Bucks migrations.
-- These indexes support tenant cleanup, creator-scoped lookups, run history, and wallet-ledger joins.
create index if not exists whilo_credit_ledger_user_fk_idx
  on public.whilo_credit_ledger(user_id);
create index if not exists whilo_library_assets_created_by_fk_idx
  on public.whilo_library_assets(created_by);
create index if not exists whilo_routine_runs_org_routine_fk_idx
  on public.whilo_routine_runs(organization_id, routine_id);
create index if not exists whilo_routine_runs_requested_by_fk_idx
  on public.whilo_routine_runs(requested_by);
create index if not exists whilo_routines_asset_fk_idx
  on public.whilo_routines(asset_id);
create index if not exists whilo_routines_created_by_fk_idx
  on public.whilo_routines(created_by);

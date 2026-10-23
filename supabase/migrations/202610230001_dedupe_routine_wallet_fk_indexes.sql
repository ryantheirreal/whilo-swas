-- Deduplicate FK indexes introduced by the dynamic follow-up and explicit routine/wallet index migrations.
-- Retain readable, workload-oriented index names; the existing whilo_routines_asset_idx predates this pass.
drop index if exists public.whilo_fk_91f8afce74ed;
drop index if exists public.whilo_fk_cc16c48e0074;
drop index if exists public.whilo_fk_441314de551b;
drop index if exists public.whilo_fk_b5a043534c00;
drop index if exists public.whilo_fk_56613d94c5ee;
drop index if exists public.whilo_routines_asset_fk_idx;

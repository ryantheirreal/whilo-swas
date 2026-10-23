-- Whilo Routines: reusable automations that target workspace assets as well as websites/computers.
-- All records remain server-only; route handlers verify workspace membership and ownership.
drop policy if exists integrations_deny_browser on public.integration_connections;

create table if not exists public.whilo_library_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  asset_type text not null check (asset_type in ('dashboard','web_app','document','report','workflow','template','dataset')),
  description text not null default '' check (length(description) <= 1500),
  source_url text,
  definition jsonb not null default '{}'::jsonb check (jsonb_typeof(definition) = 'object'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint library_asset_source_https check (source_url is null or source_url ~* '^https://')
);
create index if not exists whilo_library_assets_org_updated_idx
  on public.whilo_library_assets(organization_id, updated_at desc);
create index if not exists whilo_library_assets_org_type_idx
  on public.whilo_library_assets(organization_id, asset_type, status);

create table if not exists public.whilo_routines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 100),
  description text not null check (length(trim(description)) between 1 and 4000),
  target_kind text not null check (target_kind in ('library_asset','dashboard','web_app','website','computer','api')),
  asset_id uuid,
  target_url text,
  runtime_mode text not null default 'browser' check (runtime_mode in ('browser','desktop','api','chat','hybrid')),
  schedule_kind text not null default 'manual' check (schedule_kind in ('manual','daily','weekly')),
  schedule_time text check (schedule_time is null or schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  schedule_days smallint[] not null default '{}',
  timezone text not null default 'America/Sao_Paulo',
  next_run_at timestamptz,
  last_run_at timestamptz,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  acceptance_criteria jsonb not null default '["Outcome is recorded","Evidence and exceptions are included"]'::jsonb
    check (jsonb_typeof(acceptance_criteria) = 'array'),
  approval_policy text not null default 'always' check (approval_policy in ('always','first_run','for_writes')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  constraint whilo_routine_asset_tenant_fk
    foreign key (organization_id,asset_id)
    references public.whilo_library_assets(organization_id,id) on delete restrict,
  constraint whilo_routine_schedule_valid check (
    (schedule_kind = 'manual' and schedule_time is null)
    or (schedule_kind in ('daily','weekly') and schedule_time is not null)
  ),
  constraint whilo_routine_weekdays_valid check (
    cardinality(schedule_days) <= 7
    and array_position(schedule_days, null) is null
    and schedule_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint whilo_routine_target_url_https check (target_url is null or target_url ~* '^https://')
);
create index if not exists whilo_routines_org_enabled_schedule_idx
  on public.whilo_routines(organization_id, enabled, schedule_kind, next_run_at);
create index if not exists whilo_routines_asset_idx on public.whilo_routines(asset_id);

create table if not exists public.whilo_routine_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  routine_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  mission_id uuid unique references public.missions(id) on delete set null,
  trigger_source text not null default 'manual' check (trigger_source in ('manual','schedule','event','chat')),
  status text not null default 'requested' check (status in ('requested','awaiting_approval','queued','running','succeeded','failed','cancelled')),
  idempotency_key text not null,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,idempotency_key),
  foreign key (organization_id,routine_id)
    references public.whilo_routines(organization_id,id) on delete restrict
);
create index if not exists whilo_routine_runs_org_created_idx
  on public.whilo_routine_runs(organization_id, created_at desc);
create index if not exists whilo_routine_runs_routine_created_idx
  on public.whilo_routine_runs(routine_id, created_at desc);

create table if not exists public.whilo_onboarding_state (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step smallint not null default 0 check (current_step between 0 and 5),
  completed_at timestamptz,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index if not exists whilo_onboarding_user_idx on public.whilo_onboarding_state(user_id);

alter table public.whilo_library_assets enable row level security;
alter table public.whilo_routines enable row level security;
alter table public.whilo_routine_runs enable row level security;
alter table public.whilo_onboarding_state enable row level security;

revoke all on public.whilo_library_assets,public.whilo_routines,public.whilo_routine_runs,public.whilo_onboarding_state from public,anon,authenticated;
grant all privileges on public.whilo_library_assets,public.whilo_routines,public.whilo_routine_runs,public.whilo_onboarding_state to service_role;
grant usage,select on all sequences in schema public to service_role;

drop trigger if exists whilo_library_assets_updated_at on public.whilo_library_assets;
create trigger whilo_library_assets_updated_at before update on public.whilo_library_assets
for each row execute function public.set_updated_at();
drop trigger if exists whilo_routines_updated_at on public.whilo_routines;
create trigger whilo_routines_updated_at before update on public.whilo_routines
for each row execute function public.set_updated_at();
drop trigger if exists whilo_routine_runs_updated_at on public.whilo_routine_runs;
create trigger whilo_routine_runs_updated_at before update on public.whilo_routine_runs
for each row execute function public.set_updated_at();
drop trigger if exists whilo_onboarding_state_updated_at on public.whilo_onboarding_state;
create trigger whilo_onboarding_state_updated_at before update on public.whilo_onboarding_state
for each row execute function public.set_updated_at();

comment on table public.whilo_routines is
  'Saved, approval-gated routines. A created/queued mission is not evidence of execution; a configured worker must provide verification.';
comment on table public.whilo_library_assets is
  'Workspace library artifacts, including user-created dashboards and web apps, addressable by routines through an asset ID and optional HTTPS URL.';
comment on table public.whilo_routine_runs is
  'Idempotent audit ledger for routine requests and linked mission approvals.';

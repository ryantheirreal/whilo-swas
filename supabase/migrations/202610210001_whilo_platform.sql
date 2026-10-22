-- Whilo multi-tenant platform foundation. Apply with Supabase CLI after linking the intended project.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = auth.uid())
$$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
  base_name text;
  base_slug text;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  base_name := coalesce(nullif(new.raw_user_meta_data->>'company_name',''), split_part(coalesce(new.email,'owner'), '@', 1) || '''s workspace');
  base_slug := lower(regexp_replace(split_part(coalesce(new.email,'owner'), '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
  insert into public.organizations (name, slug, created_by)
  values (base_name, left(coalesce(nullif(base_slug,''),'workspace'), 32) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8), new.id)
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_whilo on auth.users;
create trigger on_auth_user_created_whilo after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  purpose text not null default '',
  policy jsonb not null default '{}'::jsonb,
  memory jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  owner_pet_id uuid references public.pets(id) on delete set null,
  goal text not null check (length(trim(goal)) between 1 and 4000),
  department text not null default 'Operations',
  state text not null default 'draft' check (state in ('draft','planned','awaiting_approval','queued','running','verifying','awaiting_review','delivered','needs_input','blocked','failed','cancelled')),
  risk text not null default 'medium' check (risk in ('low','medium','high','critical')),
  budget numeric(14,4) not null default 0 check (budget >= 0),
  budget_currency text not null default 'USD',
  acceptance_criteria jsonb not null default '[]'::jsonb,
  result jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (organization_id, idempotency_key)
);

create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  task_key text not null,
  title text not null,
  specialist_role text not null default 'Workflow Planner',
  status text not null default 'queued' check (status in ('queued','running','completed','failed','blocked','cancelled')),
  depends_on text[] not null default '{}',
  tool_scopes text[] not null default '{read,draft}',
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 2 check (max_attempts between 1 and 8),
  result jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, task_key)
);

create table if not exists public.mission_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null unique references public.missions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  priority integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 8),
  scheduled_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  trace_id uuid not null default gen_random_uuid(),
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mission_jobs_claim_idx on public.mission_jobs(status, scheduled_at, priority desc, created_at);
create index if not exists missions_org_created_idx on public.missions(organization_id, created_at desc);

create table if not exists public.mission_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_type text not null default 'user' check (actor_type in ('user','pet','bot','runtime','system','provider')),
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  trace_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists mission_events_timeline_idx on public.mission_events(mission_id, created_at);

create table if not exists public.mission_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  requested_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  decision text not null default 'pending' check (decision in ('pending','approved','rejected','revoked')),
  scopes text[] not null default '{}',
  reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Encrypted integration credentials only. Plaintext tokens are never stored in this table.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('pending','connected','degraded','revoked','error')),
  external_account_id text not null,
  external_account_name text,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  encrypted_payload text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  created_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id)
);
create index if not exists integration_connections_org_provider_idx on public.integration_connections(organization_id, provider, status);

create table if not exists public.oauth_states (
  state_hash text primary key,
  provider text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Used for one-time QR pairing of a user-owned desktop bridge; paired devices must prove possession of the token.
create table if not exists public.bridge_pair_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','paired','expired','revoked')),
  device_name text,
  device_public_key text,
  expires_at timestamptz not null,
  paired_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success','denied','error')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_created_idx on public.audit_events(organization_id, created_at desc);

create or replace function public.consume_oauth_state(p_state_hash text, p_provider text)
returns table(organization_id uuid, user_id uuid)
language sql security definer set search_path = public as $$
  delete from public.oauth_states s
  where s.state_hash = p_state_hash and s.provider = p_provider and s.expires_at > now()
  returning s.organization_id, s.user_id
$$;
revoke all on function public.consume_oauth_state(text,text) from public, anon, authenticated;
grant execute on function public.consume_oauth_state(text,text) to service_role;

create or replace function public.claim_next_mission_job(p_worker_id text)
returns setof public.mission_jobs
language sql security definer set search_path = public as $$
  with next_job as (
    select j.id from public.mission_jobs j
    where j.status = 'queued' and j.scheduled_at <= now() and j.attempts < j.max_attempts
    order by j.priority desc, j.created_at
    for update skip locked limit 1
  )
  update public.mission_jobs j
  set status = 'running', locked_at = now(), locked_by = left(p_worker_id, 200),
      attempts = j.attempts + 1, updated_at = now()
  from next_job where j.id = next_job.id
  returning j.*
$$;
revoke all on function public.claim_next_mission_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_mission_job(text) to service_role;

-- RLS: each browser session sees only rows in its organization.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.pets enable row level security;
alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.mission_jobs enable row level security;
alter table public.mission_events enable row level security;
alter table public.mission_approvals enable row level security;
alter table public.integration_connections enable row level security;
alter table public.oauth_states enable row level security;
alter table public.bridge_pair_sessions enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profile_read_self on public.profiles;
create policy profile_read_self on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists members_read_self on public.organization_members;
create policy members_read_self on public.organization_members for select to authenticated using (user_id = auth.uid());

drop policy if exists pets_org_all on public.pets;
create policy pets_org_all on public.pets for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists missions_org_all on public.missions;
create policy missions_org_all on public.missions for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists tasks_org_all on public.mission_tasks;
create policy tasks_org_all on public.mission_tasks for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists jobs_org_read on public.mission_jobs;
create policy jobs_org_read on public.mission_jobs for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists events_org_read on public.mission_events;
create policy events_org_read on public.mission_events for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists approvals_org_read on public.mission_approvals;
create policy approvals_org_read on public.mission_approvals for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists bridge_sessions_org_read on public.bridge_pair_sessions;
create policy bridge_sessions_org_read on public.bridge_pair_sessions for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists audit_events_org_read on public.audit_events;
create policy audit_events_org_read on public.audit_events for select to authenticated using (public.is_org_member(organization_id));

-- Force credential rows through the server API: end users can view safe connection metadata, never tokens.
drop policy if exists integrations_deny_browser on public.integration_connections;
create policy integrations_deny_browser on public.integration_connections for all to authenticated using (false) with check (false);
revoke all on public.integration_connections, public.oauth_states from anon, authenticated;
grant all on public.integration_connections, public.oauth_states, public.bridge_pair_sessions, public.mission_jobs to service_role;

create or replace view public.integration_connections_safe
with (security_barrier = true) as
select c.id, c.organization_id, c.provider, c.status, c.external_account_id,
       c.external_account_name, c.scopes, c.metadata, c.connected_at, c.last_verified_at, c.revoked_at
from public.integration_connections c
where public.is_org_member(c.organization_id);
grant select on public.integration_connections_safe to authenticated;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists pets_updated_at on public.pets;
create trigger pets_updated_at before update on public.pets for each row execute function public.set_updated_at();
drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at before update on public.missions for each row execute function public.set_updated_at();
drop trigger if exists mission_tasks_updated_at on public.mission_tasks;
create trigger mission_tasks_updated_at before update on public.mission_tasks for each row execute function public.set_updated_at();
drop trigger if exists mission_jobs_updated_at on public.mission_jobs;
create trigger mission_jobs_updated_at before update on public.mission_jobs for each row execute function public.set_updated_at();
drop trigger if exists integration_connections_updated_at on public.integration_connections;
create trigger integration_connections_updated_at before update on public.integration_connections for each row execute function public.set_updated_at();

-- IMPORTANT: create users through Supabase Auth Admin API, never by inserting plaintext credentials into SQL.

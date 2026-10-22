-- Pairing records for a user-owned Whilo desktop bridge. This does not by itself implement iMessage transport.
create table if not exists public.bridge_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  public_key text,
  credential_hash text not null unique,
  status text not null default 'active' check (status in ('active','disabled','revoked')),
  scopes text[] not null default '{bridge:heartbeat}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
alter table public.bridge_pair_sessions
  add column if not exists device_id uuid references public.bridge_devices(id) on delete set null;

create or replace function public.claim_bridge_pair_session(
  p_token_hash text,
  p_device_name text,
  p_public_key text,
  p_credential_hash text
)
returns table(device_id uuid, organization_id uuid, owner_id uuid, device_name text)
language plpgsql security definer set search_path = public as $$
declare s public.bridge_pair_sessions%rowtype; new_device_id uuid;
begin
  select * into s from public.bridge_pair_sessions
  where token_hash = p_token_hash and status = 'pending' and expires_at > now()
  for update;
  if not found then return; end if;

  insert into public.bridge_devices (
    organization_id, owner_id, device_name, public_key, credential_hash, status
  ) values (
    s.organization_id, s.requested_by, left(trim(p_device_name), 120),
    nullif(left(p_public_key, 4096), ''), p_credential_hash, 'active'
  ) returning id into new_device_id;

  update public.bridge_pair_sessions
  set status = 'paired', device_name = left(trim(p_device_name), 120),
      device_public_key = nullif(left(p_public_key, 4096), ''),
      device_id = new_device_id, paired_at = now()
  where id = s.id;

  return query select new_device_id, s.organization_id, s.requested_by, left(trim(p_device_name), 120);
end;
$$;
revoke all on function public.claim_bridge_pair_session(text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_bridge_pair_session(text,text,text,text) to service_role;
revoke all on public.bridge_devices from anon, authenticated;
grant all on public.bridge_devices to service_role;

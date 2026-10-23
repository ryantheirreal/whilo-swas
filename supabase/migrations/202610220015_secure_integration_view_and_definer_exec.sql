-- Remove SECURITY DEFINER view behavior while preserving the intended safe metadata read path.
-- The browser can read only non-secret columns and only rows belonging to the signed-in user's workspace.
alter view public.integration_connections_safe set (security_invoker = true, security_barrier = true);

revoke all privileges on table public.integration_connections_safe from public, anon, authenticated;
grant select on table public.integration_connections_safe to authenticated;
grant select on table public.integration_connections_safe to service_role;

revoke all privileges on table public.integration_connections from public, anon, authenticated;
grant select (id, organization_id, provider, status, external_account_id, external_account_name, scopes, metadata, connected_at, last_verified_at, revoked_at)
  on table public.integration_connections to authenticated;

drop policy if exists integration_connections_member_read on public.integration_connections;
create policy integration_connections_member_read
  on public.integration_connections
  for select to authenticated
  using (public.is_org_member(organization_id));

-- Trigger functions should only be invoked by triggers, never exposed as browser-callable RPCs.
revoke all on function public.ensure_human_profile() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;

-- These SECURITY DEFINER helpers remain callable only to roles with a legitimate RLS/view need.
revoke all on function public.can_view_human_profile(uuid) from public, anon;
grant execute on function public.can_view_human_profile(uuid) to authenticated, service_role;
alter function public.can_view_human_profile(uuid) set search_path = pg_catalog, public;

revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
alter function public.is_org_member(uuid) set search_path = pg_catalog, public;

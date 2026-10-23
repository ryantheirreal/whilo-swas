-- Defense in depth: organization membership data is accessed through authenticated server routes only.
-- Backend calls use SUPABASE_SERVICE_ROLE_KEY; browser roles do not need direct table privileges.
alter table public.organization_members enable row level security;

revoke all privileges on table public.organization_members from public, anon, authenticated;
grant select, insert, update, delete on table public.organization_members to service_role;

comment on table public.organization_members is
  'Server-accessed workspace membership ledger. Browser roles have no direct table privileges; tenant access is enforced in server routes and database functions.';

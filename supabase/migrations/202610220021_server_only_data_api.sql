-- Whilo data-plane lockdown: all browser-facing business data flows through authenticated server routes.
-- RLS remains defense in depth, but table access itself is not granted to browser roles.
revoke all privileges on all tables in schema public from public, anon, authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Prevent new migration-created business tables from accidentally becoming browser-accessible.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

comment on schema public is
  'Whilo business data is server-accessed. Browser clients use authenticated API routes; direct table grants are intentionally absent. RLS remains enabled as defense in depth.';

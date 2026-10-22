-- Explicit server-role table privileges for the Supabase REST API.
-- RLS remains enabled; service_role bypasses RLS by design and is never exposed to browsers.
grant usage on schema public to service_role;
grant all privileges on public.profiles to service_role;
grant all privileges on public.organizations to service_role;
grant all privileges on public.organization_members to service_role;
grant all privileges on public.pets to service_role;
grant all privileges on public.missions to service_role;
grant all privileges on public.mission_tasks to service_role;
grant all privileges on public.mission_jobs to service_role;
grant all privileges on public.mission_events to service_role;
grant all privileges on public.mission_approvals to service_role;
grant all privileges on public.integration_connections to service_role;
grant all privileges on public.oauth_states to service_role;
grant all privileges on public.bridge_pair_sessions to service_role;
grant all privileges on public.bridge_devices to service_role;
grant all privileges on public.audit_events to service_role;

grant usage, select on all sequences in schema public to service_role;

grant execute on function public.consume_oauth_state(text,text) to service_role;
grant execute on function public.claim_next_mission_job(text) to service_role;
grant execute on function public.claim_bridge_pair_session(text,text,text,text) to service_role;
grant execute on function public.create_mission_bundle(uuid,uuid,jsonb,jsonb,text) to service_role;
grant execute on function public.decide_mission_bundle(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.ensure_owner_workspace(text) to service_role;

-- Public browser role may read the safe connection view only; no direct token access.
grant select on public.integration_connections_safe to authenticated;
revoke all on public.integration_connections from anon, authenticated;
revoke all on public.oauth_states from anon, authenticated;

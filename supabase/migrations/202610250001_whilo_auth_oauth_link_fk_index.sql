-- Add the last missing FK-leading index found during the live Supabase performance audit.
-- This supports auth-link transaction lookups/deletes without widening browser privileges.
create index if not exists whilo_auth_oauth_transactions_link_auth_user_id_idx
  on public.whilo_auth_oauth_transactions(link_auth_user_id);

comment on index public.whilo_auth_oauth_transactions_link_auth_user_id_idx is
  'Supports the link_auth_user_id foreign key; identified by the Supabase performance advisor follow-up.';

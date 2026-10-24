-- Bind account linking to the already-authenticated Whilo user that initiated OAuth.
alter table public.whilo_auth_oauth_transactions
  add column if not exists link_auth_user_id uuid references auth.users(id) on delete cascade;

create index if not exists whilo_auth_oauth_link_user_idx
  on public.whilo_auth_oauth_transactions(link_auth_user_id, expires_at)
  where link_auth_user_id is not null and consumed_at is null;

comment on column public.whilo_auth_oauth_transactions.link_auth_user_id is
  'Optional authenticated Whilo account initiating an explicit identity-link flow; email matching alone is never an account-linking credential.';

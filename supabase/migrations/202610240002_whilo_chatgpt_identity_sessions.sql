-- OpenAI Sign in with ChatGPT: identity-only OAuth transactions.
-- Consumer ChatGPT plan inference is intentionally not enabled by this hosted SaaS integration.
create table if not exists public.whilo_auth_oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'openai_chatgpt'),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  browser_session_hash text not null check (browser_session_hash ~ '^[0-9a-f]{64}$'),
  nonce text not null,
  code_verifier text not null,
  client_id text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists whilo_auth_oauth_transactions_expiry_idx
  on public.whilo_auth_oauth_transactions(expires_at) where consumed_at is null;

create table if not exists public.whilo_external_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'openai_chatgpt'),
  client_id text not null,
  provider_subject text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  verified_email text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, client_id, provider_subject)
);
create index if not exists whilo_external_identities_user_idx
  on public.whilo_external_identities(auth_user_id);

alter table public.whilo_auth_oauth_transactions enable row level security;
alter table public.whilo_external_identities enable row level security;
revoke all privileges on public.whilo_auth_oauth_transactions, public.whilo_external_identities from public, anon, authenticated;
grant select, insert, update, delete on public.whilo_auth_oauth_transactions, public.whilo_external_identities to service_role;

create or replace function public.consume_whilo_siwc_transaction(
  p_state_hash text,
  p_browser_session_hash text
)
returns setof public.whilo_auth_oauth_transactions
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.whilo_auth_oauth_transactions t
     set consumed_at = now()
   where t.state_hash = p_state_hash
     and t.browser_session_hash = p_browser_session_hash
     and t.provider = 'openai_chatgpt'
     and t.consumed_at is null
     and t.expires_at > now()
  returning t.*;
$$;
revoke all on function public.consume_whilo_siwc_transaction(text,text) from public, anon, authenticated;
grant execute on function public.consume_whilo_siwc_transaction(text,text) to service_role;

comment on table public.whilo_auth_oauth_transactions is
  'Short-lived, browser-bound, single-use OAuth transactions. Service role only; never stores provider access or refresh tokens.';
comment on table public.whilo_external_identities is
  'Verified ChatGPT identity mapping only. No ChatGPT API credentials or consumer-plan access tokens are persisted.';

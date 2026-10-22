-- Whilo Marketplace v1: declarative Pet/Bot listings, creator onboarding, orders, entitlements,
-- immutable fee snapshots, Stripe webhook idempotency, and subscription status.
-- Apply after migrations 001-008 in a staging database first.

create table if not exists public.marketplace_sellers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 80),
  bio text not null default '' check (length(bio) <= 1000),
  country_code text not null default 'BR' check (country_code = 'BR'),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_details_submitted boolean not null default false,
  onboarding_started_at timestamptz,
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  listing_type text not null check (listing_type in ('pet','bot','skill','playbook','template')),
  title text not null check (length(trim(title)) between 3 and 100),
  summary text not null check (length(trim(summary)) between 10 and 240),
  description text not null default '' check (length(description) <= 12000),
  category text not null default 'Productivity' check (length(trim(category)) between 2 and 60),
  tags text[] not null default '{}',
  version text not null default '1.0.0' check (length(version) <= 40),
  license text not null default 'Proprietary' check (length(trim(license)) between 2 and 80),
  pricing_model text not null default 'one_time' check (pricing_model in ('free','one_time')),
  price_minor integer not null default 0 check (price_minor between 0 and 50000000),
  currency text not null default 'BRL' check (currency = 'BRL'),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  status text not null default 'draft' check (status in ('draft','in_review','published','rejected','archived')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  featured boolean not null default false,
  installs_count bigint not null default 0 check (installs_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (seller_id, slug),
  check ((pricing_model = 'free' and price_minor = 0) or (pricing_model = 'one_time' and price_minor > 0)),
  check (jsonb_object_length(manifest) <= 16)
);

create index if not exists marketplace_listings_public_idx
  on public.marketplace_listings(status, featured desc, published_at desc)
  where status = 'published';
create index if not exists marketplace_listings_category_idx
  on public.marketplace_listings(category, listing_type, status);
create index if not exists marketplace_listings_seller_idx
  on public.marketplace_listings(seller_id, status, updated_at desc);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  currency text not null default 'BRL' check (currency = 'BRL'),
  price_minor integer not null check (price_minor > 0),
  platform_fee_bps integer not null default 2000 check (platform_fee_bps = 2000),
  platform_fee_minor integer not null check (platform_fee_minor = floor(price_minor * 0.20)::integer),
  seller_proceeds_minor integer not null check (seller_proceeds_minor = price_minor - platform_fee_minor),
  processor_fee_minor integer check (processor_fee_minor is null or processor_fee_minor >= 0),
  state text not null default 'pending' check (state in ('pending','paid','refunded','disputed','failed','cancelled')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_orders_buyer_idx
  on public.marketplace_orders(buyer_organization_id, buyer_user_id, created_at desc);
create index if not exists marketplace_orders_seller_idx
  on public.marketplace_orders(seller_id, state, created_at desc);

create table if not exists public.marketplace_entitlements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  order_id uuid unique references public.marketplace_orders(id) on delete restrict,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (listing_id, buyer_user_id)
);

create index if not exists marketplace_entitlements_buyer_idx
  on public.marketplace_entitlements(buyer_organization_id, buyer_user_id, status);

create table if not exists public.marketplace_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.whilo_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null check (plan_code in ('plus','premium','super','ultra')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'pending' check (status in ('pending','trialing','active','past_due','paused','cancelled','incomplete','unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists whilo_subscriptions_user_idx on public.whilo_subscriptions(user_id, status);

-- All commerce data is accessed only via server endpoints using the service role.
-- The browser never receives that key; webhook and API validation are part of the authorization boundary.
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_entitlements enable row level security;
alter table public.marketplace_webhook_events enable row level security;
alter table public.whilo_subscriptions enable row level security;

revoke all on public.marketplace_sellers, public.marketplace_listings, public.marketplace_orders,
  public.marketplace_entitlements, public.marketplace_webhook_events, public.whilo_subscriptions
  from anon, authenticated;
grant all privileges on public.marketplace_sellers, public.marketplace_listings, public.marketplace_orders,
  public.marketplace_entitlements, public.marketplace_webhook_events, public.whilo_subscriptions
  to service_role;
grant usage, select on all sequences in schema public to service_role;

drop trigger if exists marketplace_sellers_updated_at on public.marketplace_sellers;
create trigger marketplace_sellers_updated_at before update on public.marketplace_sellers
for each row execute function public.set_updated_at();
drop trigger if exists marketplace_listings_updated_at on public.marketplace_listings;
create trigger marketplace_listings_updated_at before update on public.marketplace_listings
for each row execute function public.set_updated_at();
drop trigger if exists marketplace_orders_updated_at on public.marketplace_orders;
create trigger marketplace_orders_updated_at before update on public.marketplace_orders
for each row execute function public.set_updated_at();
drop trigger if exists whilo_subscriptions_updated_at on public.whilo_subscriptions;
create trigger whilo_subscriptions_updated_at before update on public.whilo_subscriptions
for each row execute function public.set_updated_at();

comment on table public.marketplace_orders is 'Immutable money snapshot: price, 20% platform fee, and seller proceeds are stored in minor currency units. Processor fees are paid from the platform share in v1.';
comment on table public.marketplace_entitlements is 'A server-confirmed purchase or free installation grants access. Never grant paid entitlements from a browser redirect.';
comment on column public.marketplace_listings.manifest is 'Declarative, bounded JSON configuration only. Never execute seller-submitted source code from this field.';

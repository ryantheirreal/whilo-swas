-- Whilo marketplace installs preserve the purchased manifest and instantiate the asset inside the buyer workspace.
-- Apply after migration 009. Run against staging before production.

drop trigger if exists marketplace_orders_snapshot_immutable on public.marketplace_orders;
create or replace function public.prevent_marketplace_order_snapshot_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if row(new.listing_id, new.seller_id, new.buyer_organization_id, new.buyer_user_id,
         new.currency, new.price_minor, new.platform_fee_bps,
         new.platform_fee_minor, new.seller_proceeds_minor)
     is distinct from
     row(old.listing_id, old.seller_id, old.buyer_organization_id, old.buyer_user_id,
         old.currency, old.price_minor, old.platform_fee_bps,
         old.platform_fee_minor, old.seller_proceeds_minor) then
    raise exception 'Marketplace order pricing snapshots are immutable' using errcode = '22000';
  end if;
  return new;
end;
$$;

create trigger marketplace_orders_snapshot_immutable
before update on public.marketplace_orders
for each row execute function public.prevent_marketplace_order_snapshot_mutation();

revoke all on function public.prevent_marketplace_order_snapshot_mutation() from public, anon, authenticated;

create table if not exists public.marketplace_installations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  entitlement_id uuid references public.marketplace_entitlements(id) on delete set null,
  listing_version text not null,
  asset_type text not null check (asset_type in ('pet','bot','skill','playbook','template')),
  manifest_snapshot jsonb not null check (jsonb_typeof(manifest_snapshot) = 'object'),
  pet_instance_id uuid references public.pets(id) on delete set null,
  state text not null default 'active' check (state in ('active','paused','removed')),
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, organization_id)
);

create index if not exists marketplace_installations_workspace_idx
  on public.marketplace_installations(organization_id, state, installed_at desc);
create index if not exists marketplace_installations_buyer_idx
  on public.marketplace_installations(buyer_user_id, state, installed_at desc);

alter table public.marketplace_installations enable row level security;
revoke all on public.marketplace_installations from anon, authenticated;
grant all privileges on public.marketplace_installations to service_role;

drop trigger if exists marketplace_installations_updated_at on public.marketplace_installations;
create trigger marketplace_installations_updated_at before update on public.marketplace_installations
for each row execute function public.set_updated_at();

create or replace function public.install_marketplace_asset(
  p_organization_id uuid,
  p_buyer_user_id uuid,
  p_listing_id uuid
)
returns table (
  result_installation_id uuid,
  result_asset_type text,
  result_pet_instance_id uuid,
  result_state text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  listing_row public.marketplace_listings%rowtype;
  entitlement_row public.marketplace_entitlements%rowtype;
  created_installation_id uuid;
  existing_installation_id uuid;
  created_pet_id uuid;
  existing_pet_id uuid;
  existing_type text;
  existing_state text;
begin
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = p_buyer_user_id
  ) then
    raise exception 'Buyer is not a member of the target workspace' using errcode = '42501';
  end if;

  select l.* into listing_row
  from public.marketplace_listings l
  where l.id = p_listing_id and l.status = 'published';
  if not found then
    raise exception 'A published marketplace listing is required' using errcode = 'P0002';
  end if;

  select e.* into entitlement_row
  from public.marketplace_entitlements e
  where e.listing_id = p_listing_id
    and e.buyer_organization_id = p_organization_id
    and e.buyer_user_id = p_buyer_user_id
    and e.status = 'active'
  limit 1;
  if not found then
    raise exception 'An active entitlement is required before installation' using errcode = '42501';
  end if;

  insert into public.marketplace_installations (
    organization_id, buyer_user_id, listing_id, entitlement_id,
    listing_version, asset_type, manifest_snapshot, state
  ) values (
    p_organization_id, p_buyer_user_id, listing_row.id, entitlement_row.id,
    listing_row.version, listing_row.listing_type, listing_row.manifest, 'active'
  )
  on conflict (listing_id, organization_id) do nothing
  returning id into created_installation_id;

  if created_installation_id is null then
    select i.id, i.pet_instance_id, i.asset_type, i.state
      into existing_installation_id, existing_pet_id, existing_type, existing_state
    from public.marketplace_installations i
    where i.listing_id = p_listing_id and i.organization_id = p_organization_id
    limit 1;
    return query select existing_installation_id, existing_type, existing_pet_id, existing_state;
    return;
  end if;

  if listing_row.listing_type = 'pet' then
    insert into public.pets (
      organization_id, name, slug, purpose, policy, memory, enabled, created_by
    ) values (
      p_organization_id,
      listing_row.title,
      left(listing_row.slug, 70) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
      listing_row.summary,
      jsonb_build_object(
        'origin', 'whilo_marketplace',
        'marketplace_listing_id', listing_row.id,
        'marketplace_installation_id', created_installation_id,
        'listing_version', listing_row.version,
        'manifest', listing_row.manifest,
        'requires_approval', coalesce((listing_row.manifest->>'requiresApproval')::boolean, true)
      ),
      '{}'::jsonb,
      true,
      p_buyer_user_id
    ) returning id into created_pet_id;
  end if;

  update public.marketplace_installations i
  set pet_instance_id = created_pet_id, updated_at = now()
  where i.id = created_installation_id;

  update public.marketplace_listings l
  set installs_count = l.installs_count + 1, updated_at = now()
  where l.id = p_listing_id;

  return query
    select created_installation_id, listing_row.listing_type, created_pet_id, 'active'::text;
end;
$$;

revoke all on function public.install_marketplace_asset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.install_marketplace_asset(uuid, uuid, uuid) to service_role;

comment on table public.marketplace_installations is 'Buyer-side install ledger. Manifest and version are snapshotted. Pets create a workspace Pet record; task-scoped Bots and other assets remain bounded installations.';
comment on function public.install_marketplace_asset(uuid, uuid, uuid) is 'Creates an installation exactly once after validating workspace membership and a live entitlement. Service role only; call from the authenticated API after verifying the human session.';

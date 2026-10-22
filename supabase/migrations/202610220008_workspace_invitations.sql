-- Workspace invitations enable human-to-human collaboration beyond the initial owner.
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_normalized text not null check (length(email_normalized) between 3 and 320),
  invited_by uuid not null references auth.users(id) on delete cascade,
  intended_role text not null default 'member' check (intended_role in ('member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_invitations_org_status_idx on public.workspace_invitations(organization_id,status,created_at desc);
create index if not exists workspace_invitations_email_idx on public.workspace_invitations(email_normalized,status,expires_at);

alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon,authenticated;
grant all privileges on public.workspace_invitations to service_role;

-- Newly invited Auth users are placed into the invited workspace instead of receiving a stray personal workspace.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
  invitation_role text;
  base_name text;
  base_slug text;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  select wi.organization_id, wi.intended_role
    into org_id, invitation_role
  from public.workspace_invitations wi
  where wi.email_normalized = lower(trim(coalesce(new.email,'')))
    and wi.status = 'pending' and wi.expires_at > now()
  order by wi.created_at desc limit 1;

  if org_id is not null then
    insert into public.organization_members (organization_id,user_id,role)
    values (org_id,new.id,coalesce(invitation_role,'member'))
    on conflict (organization_id,user_id) do nothing;
    return new;
  end if;

  base_name := coalesce(nullif(new.raw_user_meta_data->>'company_name',''), split_part(coalesce(new.email,'owner'), '@', 1) || '''s workspace');
  base_slug := lower(regexp_replace(split_part(coalesce(new.email,'owner'), '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
  insert into public.organizations (name, slug, created_by)
  values (base_name, left(coalesce(nullif(base_slug,''),'workspace'), 32) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8), new.id)
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner')
  on conflict (organization_id,user_id) do nothing;
  return new;
end;
$$;

create or replace function public.accept_workspace_invitation(p_user_id uuid, p_token_hash text)
returns table(organization_id uuid, organization_name text, member_role text)
language plpgsql security definer set search_path = public as $$
declare
  invitation public.workspace_invitations%rowtype;
  account_email text;
  org_name text;
begin
  select lower(trim(u.email)) into account_email
  from auth.users u where u.id=p_user_id;
  if account_email is null then raise exception 'account_not_found' using errcode='P0002'; end if;

  select * into invitation from public.workspace_invitations wi
  where wi.token_hash=p_token_hash and wi.status='pending' and wi.expires_at>now()
  for update;
  if not found then raise exception 'invitation_expired_or_used' using errcode='P0002'; end if;
  if invitation.email_normalized <> account_email then
    raise exception 'invitation_email_mismatch' using errcode='42501';
  end if;

  insert into public.organization_members(organization_id,user_id,role)
  values(invitation.organization_id,p_user_id,invitation.intended_role)
  on conflict(organization_id,user_id) do update set role=excluded.role;

  update public.workspace_invitations
  set status='accepted',accepted_by=p_user_id,accepted_at=now(),updated_at=now()
  where id=invitation.id;

  select o.name into org_name from public.organizations o where o.id=invitation.organization_id;
  return query select invitation.organization_id,coalesce(org_name,'Whilo workspace'),invitation.intended_role;
end;
$$;
revoke all on function public.accept_workspace_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.accept_workspace_invitation(uuid,text) to service_role;

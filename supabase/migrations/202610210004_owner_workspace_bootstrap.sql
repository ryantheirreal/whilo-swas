-- Idempotent owner/workspace provisioner; it never sets or resets a password.
create or replace function public.ensure_owner_workspace(p_email text)
returns table(user_id uuid, organization_id uuid, role text, created_workspace boolean)
language plpgsql security definer set search_path = public as $$
declare
  auth_user_id uuid;
  auth_email text;
  metadata jsonb;
  org_id uuid;
  org_role text;
  was_created boolean := false;
  base_name text;
  base_slug text;
  pet_name text;
  pet_slug text;
  pet_purpose text;
begin
  if p_email is null or length(trim(p_email)) < 3 or length(trim(p_email)) > 320 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  select u.id, u.email, u.raw_user_meta_data into auth_user_id, auth_email, metadata
  from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if auth_user_id is null then
    raise exception 'auth_user_not_found' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, email, display_name)
  values (auth_user_id, coalesce(auth_email,''), nullif(metadata->>'full_name',''))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  select m.organization_id, m.role into org_id, org_role
  from public.organization_members m
  where m.user_id = auth_user_id order by m.created_at asc limit 1;

  if org_id is null then
    base_name := coalesce(nullif(metadata->>'company_name',''), split_part(coalesce(auth_email,'owner'), '@', 1) || '''s workspace');
    base_slug := lower(regexp_replace(split_part(coalesce(auth_email,'owner'), '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
    insert into public.organizations (name, slug, created_by)
    values (base_name, left(coalesce(nullif(base_slug,''),'workspace'), 32) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8), auth_user_id)
    returning id into org_id;
    insert into public.organization_members (organization_id, user_id, role)
    values (org_id, auth_user_id, 'owner')
    on conflict (organization_id,user_id) do nothing;
    org_role := 'owner';
    was_created := true;
  end if;

  for pet_name, pet_slug, pet_purpose in
    select * from (values
      ('Whilo','whilo','Accountable lead Pet; owns mission outcomes and escalations.'),
      ('Fynn','fynn','Research and discovery Pet for evidence-first work.'),
      ('Nori','nori','Operations and repeatable workflow Pet.'),
      ('Capuccino','capuccino','Writing and communications draft Pet.'),
      ('Ollie','ollie','Analysis and reporting Pet.'),
      ('Pico','pico','Engineering and technical troubleshooting Pet.')
    ) as defaults(name, slug, purpose)
  loop
    insert into public.pets (organization_id, name, slug, purpose, created_by)
    values (org_id, pet_name, pet_slug, pet_purpose, auth_user_id)
    on conflict (organization_id, slug) do nothing;
  end loop;

  return query select auth_user_id, org_id, coalesce(org_role,'member'), was_created;
end;
$$;
revoke all on function public.ensure_owner_workspace(text) from public, anon, authenticated;
grant execute on function public.ensure_owner_workspace(text) to service_role;

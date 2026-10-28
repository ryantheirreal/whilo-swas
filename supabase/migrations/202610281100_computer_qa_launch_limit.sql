-- Atomic server-only rate limiting for the short-lived remote Computer QA runtime.
create table if not exists public.computer_qa_launches (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_host text not null check (length(target_host) between 1 and 253),
  created_at timestamptz not null default now()
);

create index if not exists computer_qa_launches_actor_created_idx
  on public.computer_qa_launches (organization_id, actor_id, created_at desc);

alter table public.computer_qa_launches enable row level security;
revoke all privileges on table public.computer_qa_launches from public, anon, authenticated;
grant all privileges on table public.computer_qa_launches to service_role;

create or replace function public.reserve_computer_qa_launch(
  p_organization_id uuid,
  p_actor_id uuid,
  p_target_host text
)
returns table(allowed boolean, used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_host text := lower(trim(coalesce(p_target_host,'')));
begin
  if p_organization_id is null or p_actor_id is null then
    raise exception 'invalid_actor_scope' using errcode = '22023';
  end if;
  if length(v_host) < 1 or length(v_host) > 253 then
    raise exception 'invalid_target_host' using errcode = '22023';
  end if;

  -- Serialize launches for this member so concurrent requests cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_actor_id::text, 0));

  delete from public.computer_qa_launches
  where organization_id = p_organization_id
    and actor_id = p_actor_id
    and created_at < now() - interval '7 days';

  select count(*)::integer into v_count
  from public.computer_qa_launches l
  where l.organization_id = p_organization_id
    and l.actor_id = p_actor_id
    and l.created_at >= now() - interval '10 minutes';

  if v_count >= 3 then
    return query select false, v_count;
    return;
  end if;

  insert into public.computer_qa_launches (organization_id, actor_id, target_host)
  values (p_organization_id, p_actor_id, v_host);

  return query select true, v_count + 1;
end;
$$;

revoke all on function public.reserve_computer_qa_launch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_computer_qa_launch(uuid, uuid, text) to service_role;

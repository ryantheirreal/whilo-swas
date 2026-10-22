-- Whilo Human Messages: DMs, groups, supergroups and broadcast channels.
-- Workspace-scoped by default; real-time fanout and media storage are separate provider integrations.
create extension if not exists pgcrypto;

create table if not exists public.human_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  status_text text not null default '',
  presence text not null default 'offline' check (presence in ('online','away','busy','offline')),
  last_seen_at timestamptz,
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists human_profiles_username_lower_uq on public.human_profiles(lower(username));
create index if not exists human_profiles_search_idx on public.human_profiles(searchable, lower(username), lower(display_name));

create or replace function public.ensure_human_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_name text;
  base_handle text;
  chosen_username text;
  suffix text;
begin
  raw_name := coalesce(nullif(trim(new.display_name),''), split_part(coalesce(new.email,'member'), '@', 1));
  base_handle := lower(regexp_replace(split_part(split_part(coalesce(new.email,'member'), '@', 1), '+', 1), '[^a-zA-Z0-9]+', '', 'g'));
  if length(base_handle) < 2 then base_handle := 'member'; end if;
  suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  chosen_username := left(base_handle, 22) || '-' || suffix;

  insert into public.human_profiles (id, username, display_name)
  values (new.id, chosen_username, left(raw_name, 80))
  on conflict (id) do update
    set display_name = case when public.human_profiles.display_name = '' then excluded.display_name else public.human_profiles.display_name end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_ensure_human_profile on public.profiles;
create trigger profiles_ensure_human_profile
after insert or update of email, display_name on public.profiles
for each row execute function public.ensure_human_profile();

insert into public.human_profiles (id, username, display_name)
select p.id,
       left(coalesce(nullif(lower(regexp_replace(split_part(split_part(coalesce(p.email,'member'), '@', 1), '+', 1), '[^a-zA-Z0-9]+', '', 'g')),''),'member'),22)
         || '-' || substr(replace(gen_random_uuid()::text, '-', ''),1,6),
       left(coalesce(nullif(trim(p.display_name),''),split_part(coalesce(p.email,'member'), '@', 1)),80)
from public.profiles p
on conflict (id) do nothing;

create table if not exists public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_type text not null check (conversation_type in ('direct','group','supergroup','channel')),
  title text not null default '',
  description text not null default '',
  avatar_url text,
  created_by uuid not null references auth.users(id),
  is_public boolean not null default false,
  dm_key text,
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 3600),
  settings jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint message_direct_has_dm_key check ((conversation_type = 'direct' and dm_key is not null) or conversation_type <> 'direct')
);
create unique index if not exists message_direct_pair_uq on public.message_conversations(organization_id, dm_key) where conversation_type = 'direct';
create index if not exists message_conversation_org_recent_idx on public.message_conversations(organization_id, last_message_at desc nulls last);

create table if not exists public.message_conversation_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','admin','moderator','member','subscriber','read_only')),
  member_status text not null default 'active' check (member_status in ('invited','active','left','banned')),
  joined_at timestamptz,
  last_read_at timestamptz,
  last_read_message_id uuid,
  muted_until timestamptz,
  notifications_enabled boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);
create index if not exists message_members_user_idx on public.message_conversation_members(organization_id,user_id,member_status,updated_at desc);
create index if not exists message_members_conversation_idx on public.message_conversation_members(conversation_id,member_status,created_at);

create table if not exists public.message_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_kind text not null default 'human' check (sender_kind in ('human','pet','bot','system')),
  sender_agent_id uuid,
  content text not null default '',
  content_type text not null default 'text' check (content_type in ('text','markdown','system')),
  reply_to_message_id uuid references public.message_messages(id) on delete set null,
  thread_root_id uuid references public.message_messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  pinned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_content_length check (length(content) <= 12000)
);
alter table public.message_conversation_members
  drop constraint if exists message_conversation_members_last_read_message_id_fkey;
alter table public.message_conversation_members
  add constraint message_conversation_members_last_read_message_id_fkey
  foreign key (last_read_message_id) references public.message_messages(id) on delete set null;
create index if not exists message_timeline_idx on public.message_messages(conversation_id,created_at desc,id desc) where deleted_at is null;
create index if not exists message_thread_idx on public.message_messages(conversation_id,thread_root_id,created_at asc) where deleted_at is null;
create index if not exists message_sender_idx on public.message_messages(sender_user_id,created_at desc);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  message_id uuid not null references public.message_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','🎉','🔥','👀','✅','🙏','💡')),
  created_at timestamptz not null default now(),
  unique (message_id,user_id,emoji)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id,created_at);

create table if not exists public.message_pins (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  message_id uuid not null references public.message_messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id),
  pinned_at timestamptz not null default now(),
  primary key(conversation_id,message_id)
);

create table if not exists public.message_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  invite_status text not null default 'pending' check (invite_status in ('pending','accepted','declined','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (conversation_id,invited_user_id)
);

create table if not exists public.message_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  message_id uuid references public.message_messages(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists message_events_conversation_idx on public.message_events(conversation_id,created_at desc);

create or replace function public.create_message_conversation(
  p_organization_id uuid,
  p_creator_id uuid,
  p_type text,
  p_title text,
  p_description text,
  p_member_ids uuid[],
  p_is_public boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  members uuid[];
  target_id uuid;
  pair_key text;
  member_id uuid;
  member_role text;
begin
  if p_type not in ('direct','group','supergroup','channel') then raise exception 'invalid_conversation_type' using errcode='22023'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=p_creator_id) then
    raise exception 'workspace_access_denied' using errcode='42501';
  end if;

  select array_agg(x order by x::text) into members
  from (select distinct v as x from unnest(coalesce(p_member_ids,'{}'::uuid[]) || array[p_creator_id]) as ids(v)) s;
  if members is null or cardinality(members) < 1 then raise exception 'members_required' using errcode='22023'; end if;
  if cardinality(members) > case when p_type='direct' then 2 when p_type='group' then 200 else 50000 end then
    raise exception 'too_many_members' using errcode='22023';
  end if;
  if p_type='direct' and cardinality(members) <> 2 then raise exception 'direct_requires_two_people' using errcode='22023'; end if;
  if p_type <> 'direct' and length(trim(coalesce(p_title,''))) < 1 then raise exception 'conversation_title_required' using errcode='22023'; end if;
  if length(coalesce(p_title,'')) > 100 or length(coalesce(p_description,'')) > 1600 then raise exception 'conversation_metadata_too_long' using errcode='22023'; end if;
  if exists (
    select 1 from unnest(members) u(id)
    where not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=u.id)
  ) then raise exception 'all_members_must_belong_to_workspace' using errcode='42501'; end if;

  if p_type='direct' then
    pair_key := members[1]::text || ':' || members[2]::text;
    select c.id into target_id from public.message_conversations c
    where c.organization_id=p_organization_id and c.conversation_type='direct' and c.dm_key=pair_key;
    if target_id is not null then
      insert into public.message_conversation_members (organization_id,conversation_id,user_id,member_role,member_status,joined_at)
      select p_organization_id,target_id,u,'member','active',now() from unnest(members) u
      on conflict (conversation_id,user_id) do update set member_status='active',updated_at=now();
      return target_id;
    end if;
  end if;

  insert into public.message_conversations(organization_id,conversation_type,title,description,created_by,is_public,dm_key)
  values (p_organization_id,p_type,left(trim(coalesce(p_title,'')),100),left(trim(coalesce(p_description,'')),1600),
          p_creator_id,case when p_type='channel' then coalesce(p_is_public,false) else false end,pair_key)
  returning id into target_id;

  foreach member_id in array members loop
    member_role := case when member_id=p_creator_id then 'owner' else (case when p_type='channel' then 'subscriber' else 'member' end) end;
    insert into public.message_conversation_members(organization_id,conversation_id,user_id,member_role,member_status,joined_at)
    values(p_organization_id,target_id,member_id,member_role,'active',now());
  end loop;
  insert into public.message_events(organization_id,conversation_id,actor_user_id,event_type,details)
  values(p_organization_id,target_id,p_creator_id,'conversation.created',jsonb_build_object('type',p_type,'member_count',cardinality(members)));
  return target_id;
end;
$$;
revoke all on function public.create_message_conversation(uuid,uuid,text,text,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.create_message_conversation(uuid,uuid,text,text,text,uuid[],boolean) to service_role;

create or replace function public.touch_message_conversation(p_conversation_id uuid, p_org_id uuid, p_message_at timestamptz)
returns void language sql security definer set search_path = public as $$
  update public.message_conversations set last_message_at=greatest(coalesce(last_message_at,'epoch'::timestamptz),p_message_at),updated_at=now()
  where id=p_conversation_id and organization_id=p_org_id
$$;
revoke all on function public.touch_message_conversation(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.touch_message_conversation(uuid,uuid,timestamptz) to service_role;

-- RLS is defense in depth. Privileged REST access is exclusively server-side.
alter table public.human_profiles enable row level security;
alter table public.message_conversations enable row level security;
alter table public.message_conversation_members enable row level security;
alter table public.message_messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_pins enable row level security;
alter table public.message_invites enable row level security;
alter table public.message_events enable row level security;

drop policy if exists human_profiles_member_read on public.human_profiles;
create policy human_profiles_member_read on public.human_profiles for select to authenticated
using (id=auth.uid() or exists (
  select 1 from public.organization_members mine join public.organization_members theirs
    on theirs.organization_id=mine.organization_id
  where mine.user_id=auth.uid() and theirs.user_id=human_profiles.id
));
drop policy if exists message_conversation_member_read on public.message_conversations;
create policy message_conversation_member_read on public.message_conversations for select to authenticated
using (public.is_org_member(organization_id) and exists (
  select 1 from public.message_conversation_members cm
  where cm.conversation_id=message_conversations.id and cm.user_id=auth.uid() and cm.member_status='active'
));
drop policy if exists message_members_self_read on public.message_conversation_members;
create policy message_members_self_read on public.message_conversation_members for select to authenticated using (user_id=auth.uid());
drop policy if exists messages_member_read on public.message_messages;
create policy messages_member_read on public.message_messages for select to authenticated using (
  public.is_org_member(organization_id) and exists (
    select 1 from public.message_conversation_members cm
    where cm.conversation_id=message_messages.conversation_id and cm.user_id=auth.uid() and cm.member_status='active'
  )
);
drop policy if exists reactions_member_read on public.message_reactions;
create policy reactions_member_read on public.message_reactions for select to authenticated using (
  exists (select 1 from public.message_conversation_members cm
    where cm.conversation_id=message_reactions.conversation_id and cm.user_id=auth.uid() and cm.member_status='active')
);
drop policy if exists pins_member_read on public.message_pins;
create policy pins_member_read on public.message_pins for select to authenticated using (
  exists (select 1 from public.message_conversation_members cm
    where cm.conversation_id=message_pins.conversation_id and cm.user_id=auth.uid() and cm.member_status='active')
);
drop policy if exists invites_invitee_read on public.message_invites;
create policy invites_invitee_read on public.message_invites for select to authenticated using (invited_user_id=auth.uid());
drop policy if exists message_events_member_read on public.message_events;
create policy message_events_member_read on public.message_events for select to authenticated using (
  exists (select 1 from public.message_conversation_members cm
    where cm.conversation_id=message_events.conversation_id and cm.user_id=auth.uid() and cm.member_status='active')
);

revoke all on public.human_profiles,public.message_conversations,public.message_conversation_members,public.message_messages,
  public.message_reactions,public.message_pins,public.message_invites,public.message_events from anon,authenticated;
grant select on public.human_profiles to authenticated;
grant select on public.message_conversations,public.message_conversation_members,public.message_messages,
  public.message_reactions,public.message_pins,public.message_invites,public.message_events to authenticated;
grant all privileges on public.human_profiles,public.message_conversations,public.message_conversation_members,public.message_messages,
  public.message_reactions,public.message_pins,public.message_invites,public.message_events to service_role;
grant usage,select on all sequences in schema public to service_role;

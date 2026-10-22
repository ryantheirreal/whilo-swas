-- Let authenticated members discover human profiles of their workspace peers.
create or replace function public.can_view_human_profile(p_target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_target_user_id = auth.uid() or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = p_target_user_id
  )
$$;
revoke all on function public.can_view_human_profile(uuid) from public;
grant execute on function public.can_view_human_profile(uuid) to authenticated;

drop policy if exists human_profiles_member_read on public.human_profiles;
create policy human_profiles_member_read on public.human_profiles for select to authenticated
using (public.can_view_human_profile(id));

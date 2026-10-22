-- Transactional mission creation and approval. Jobs are queued only after a recorded approval.
create or replace function public.create_mission_bundle(
  p_organization_id uuid,
  p_user_id uuid,
  p_mission jsonb,
  p_tasks jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mission_id uuid;
  item jsonb;
begin
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = p_user_id
  ) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select m.id into mission_id from public.missions m
    where m.organization_id = p_organization_id and m.idempotency_key = p_idempotency_key;
    if mission_id is not null then return mission_id; end if;
  end if;

  insert into public.missions (
    organization_id, created_by, goal, department, state, risk, budget,
    budget_currency, acceptance_criteria, idempotency_key
  ) values (
    p_organization_id, p_user_id, p_mission->>'goal',
    coalesce(nullif(p_mission->>'department',''),'Operations'),
    'awaiting_approval',
    case when p_mission->>'risk' in ('low','medium','high','critical') then p_mission->>'risk' else 'medium' end,
    greatest(0, coalesce(nullif(p_mission->>'budget','')::numeric, 0)),
    coalesce(nullif(p_mission->>'budgetCurrency',''),'USD'),
    coalesce(p_mission->'acceptanceCriteria','[]'::jsonb),
    p_idempotency_key
  ) returning id into mission_id;

  for item in select value from jsonb_array_elements(coalesce(p_tasks,'[]'::jsonb)) as rows(value)
  loop
    insert into public.mission_tasks (
      organization_id, mission_id, task_key, title, specialist_role,
      depends_on, tool_scopes, max_attempts
    ) values (
      p_organization_id, mission_id, item->>'id', item->>'title',
      coalesce(nullif(item->>'role',''),'Workflow Planner'),
      array(select jsonb_array_elements_text(coalesce(item->'dependsOn','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(item->'toolScopes','["read","draft"]'::jsonb))),
      greatest(1, least(8, coalesce(nullif(item->>'maxAttempts','')::integer, 2)))
    );
  end loop;

  insert into public.mission_approvals (organization_id, mission_id, requested_by, decision, scopes, reason)
  values (p_organization_id, mission_id, p_user_id, 'pending', array['execute_mission'], 'Approval is required before execution.');

  insert into public.mission_events (organization_id, mission_id, actor_id, actor_type, event_type, detail)
  values (p_organization_id, mission_id, p_user_id, 'user', 'mission.created', jsonb_build_object(
    'state', 'awaiting_approval', 'task_count', jsonb_array_length(coalesce(p_tasks,'[]'::jsonb)),
    'idempotency_key', p_idempotency_key
  ));
  return mission_id;
end;
$$;
revoke all on function public.create_mission_bundle(uuid,uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_mission_bundle(uuid,uuid,jsonb,jsonb,text) to service_role;

create or replace function public.decide_mission_bundle(
  p_organization_id uuid,
  p_user_id uuid,
  p_mission_id uuid,
  p_decision text,
  p_reason text
)
returns table(mission_id uuid, mission_state text, job_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  m public.missions%rowtype;
  membership_role text;
  new_job_id uuid;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  select role into membership_role from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
  if membership_role is null then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;

  select * into m from public.missions
  where id = p_mission_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'mission_not_found' using errcode = 'P0002'; end if;
  if m.state <> 'awaiting_approval' then raise exception 'mission_not_awaiting_approval' using errcode = '55000'; end if;
  if m.created_by <> p_user_id and membership_role not in ('owner','admin') then
    raise exception 'approval_forbidden' using errcode = '42501';
  end if;

  update public.mission_approvals
  set decision = p_decision, decided_by = p_user_id, decided_at = now(),
      reason = left(coalesce(p_reason,''), 1200)
  where mission_approvals.mission_id = p_mission_id
    and mission_approvals.organization_id = p_organization_id and decision = 'pending';

  if not found then raise exception 'approval_already_decided' using errcode = '55000'; end if;

  if p_decision = 'approved' then
    update public.missions set state = 'queued', updated_at = now()
    where id = p_mission_id and organization_id = p_organization_id;
    insert into public.mission_jobs (organization_id, mission_id, status, payload)
    values (p_organization_id, p_mission_id, 'queued', jsonb_build_object('mission_id', p_mission_id))
    on conflict (mission_id) do update set status = 'queued', scheduled_at = now(), updated_at = now()
    returning id into new_job_id;
  else
    update public.missions set state = 'blocked', updated_at = now()
    where id = p_mission_id and organization_id = p_organization_id;
  end if;

  insert into public.mission_events (organization_id, mission_id, actor_id, actor_type, event_type, detail)
  values (p_organization_id, p_mission_id, p_user_id, 'user', 'mission.approval_decided',
    jsonb_build_object('decision', p_decision, 'reason', left(coalesce(p_reason,''),1200),
                       'job_id', new_job_id));
  return query select p_mission_id, case when p_decision = 'approved' then 'queued' else 'blocked' end, new_job_id;
end;
$$;
revoke all on function public.decide_mission_bundle(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.decide_mission_bundle(uuid,uuid,uuid,text,text) to service_role;

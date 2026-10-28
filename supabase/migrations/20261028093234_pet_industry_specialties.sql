
-- Pet industry specializations. Only migrate untouched bootstrap profiles; keep user-customized purposes/policies intact.
WITH specializations(slug, pet_name, old_purpose, new_purpose, new_policy) AS (
  VALUES
    ('whilo', 'Whilo',
     'Accountable lead Pet; owns mission outcomes and escalations.',
     'Insurance brokerage operations Pet; prepares commercial-lines submissions, renewal queues and evidence-backed quote comparisons. Coverage decisions and binding require qualified human approval.',
     '{"specialty_market":"Insurance brokerage","segments":["Commercial-lines submissions","Renewal operations","Quote comparison","Broker follow-up"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["coverage recommendations","binding or modifying coverage","sending carrier or client communications"]}'::jsonb),
    ('fynn', 'Fynn',
     'Research and discovery Pet for evidence-first work.',
     'Management consulting research Pet; builds source-backed market maps, benchmarks and evidence packs. Strategic recommendations remain subject to accountable human judgment.',
     '{"specialty_market":"Management consulting","segments":["Market research","Benchmarking","Data gathering","Deliverable evidence review"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["strategic recommendations","material client commitments","publication of findings"]}'::jsonb),
    ('nori', 'Nori',
     'Operations and repeatable workflow Pet.',
     'Supply-chain and procurement Pet; compares supplier offers, monitors renewal windows and surfaces evidence-backed sourcing exceptions. Purchase orders and supplier commitments require human approval.',
     '{"specialty_market":"Supply chain & procurement","segments":["Supplier discovery","RFQ comparison","Contract renewal monitoring","Spend exception review"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["purchase orders","supplier commitments","contract changes","payments"]}'::jsonb),
    ('capuccino', 'Capuccino',
     'Writing and communications draft Pet.',
     'Advertising and creative-operations Pet; prepares source-backed creative briefs, controlled variants and honest campaign readouts. Brand judgment, claims, targeting, budgets and publication require human approval.',
     '{"specialty_market":"Advertising & creative operations","segments":["Audience research","Creative briefs","Variant production","Performance learning"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["brand positioning","factual or regulated claims","ad targeting","spend","publication"]}'::jsonb),
    ('ollie', 'Ollie',
     'Analysis and reporting Pet.',
     'Recruitment and staffing operations Pet; organizes sourcing evidence, recruiter administration and interview coordination using job-related criteria. Hiring and rejection decisions remain human-owned.',
     '{"specialty_market":"Recruitment & staffing","segments":["Talent market mapping","Job-related sourcing","Recruiter operations","Interview coordination"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["candidate ranking with consequential effect","hiring decisions","rejection decisions","protected-trait inference"]}'::jsonb),
    ('pico', 'Pico',
     'Engineering and technical troubleshooting Pet.',
     'IT managed-services Pet; triages service desk and monitoring evidence and prepares least-privilege access-request packets. Production changes require an authorized approval and verified execution path.',
     '{"specialty_market":"IT managed services","segments":["Service desk triage","Monitoring summaries","Access-request packets","Patch-status reporting"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["production changes","permission grants","patching","deletion","credential access"]}'::jsonb)
)
UPDATE public.pets AS p
SET purpose = s.new_purpose,
    policy = s.new_policy,
    updated_at = now()
FROM specializations AS s
WHERE p.slug = s.slug
  AND p.name = s.pet_name
  AND p.purpose = s.old_purpose
  AND p.policy = '{}'::jsonb;

-- Future workspace bootstrap: create the six default Pets with stable vertical roles.
CREATE OR REPLACE FUNCTION public.ensure_owner_workspace(p_email text)
RETURNS TABLE(user_id uuid, organization_id uuid, role text, created_workspace boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
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
  pet_policy jsonb;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) < 3 OR length(trim(p_email)) > 320 THEN
    RAISE EXCEPTION 'invalid_email' USING errcode = '22023';
  END IF;

  SELECT u.id, u.email, u.raw_user_meta_data INTO auth_user_id, auth_email, metadata
  FROM auth.users u WHERE lower(u.email) = lower(trim(p_email)) LIMIT 1;
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (auth_user_id, coalesce(auth_email,''), nullif(metadata->>'full_name',''))
  ON CONFLICT (id) DO UPDATE SET email = excluded.email, updated_at = now();

  SELECT m.organization_id, m.role INTO org_id, org_role
  FROM public.organization_members m
  WHERE m.user_id = auth_user_id ORDER BY m.created_at ASC LIMIT 1;

  IF org_id IS NULL THEN
    base_name := coalesce(nullif(metadata->>'company_name',''), split_part(coalesce(auth_email,'owner'), '@', 1) || '''s workspace');
    base_slug := lower(regexp_replace(split_part(coalesce(auth_email,'owner'), '@', 1), '[^a-zA-Z0-9]+', '-', 'g'));
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (base_name, left(coalesce(nullif(base_slug,''),'workspace'), 32) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8), auth_user_id)
    RETURNING id INTO org_id;
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (org_id, auth_user_id, 'owner')
    ON CONFLICT (organization_id,user_id) DO NOTHING;
    org_role := 'owner';
    was_created := true;
  END IF;

  FOR pet_name, pet_slug, pet_purpose, pet_policy IN
    SELECT * FROM (VALUES
      ('Whilo','whilo',
       'Insurance brokerage operations Pet; prepares commercial-lines submissions, renewal queues and evidence-backed quote comparisons. Coverage decisions and binding require qualified human approval.',
       '{"specialty_market":"Insurance brokerage","segments":["Commercial-lines submissions","Renewal operations","Quote comparison","Broker follow-up"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["coverage recommendations","binding or modifying coverage","sending carrier or client communications"]}'::jsonb),
      ('Fynn','fynn',
       'Management consulting research Pet; builds source-backed market maps, benchmarks and evidence packs. Strategic recommendations remain subject to accountable human judgment.',
       '{"specialty_market":"Management consulting","segments":["Market research","Benchmarking","Data gathering","Deliverable evidence review"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["strategic recommendations","material client commitments","publication of findings"]}'::jsonb),
      ('Nori','nori',
       'Supply-chain and procurement Pet; compares supplier offers, monitors renewal windows and surfaces evidence-backed sourcing exceptions. Purchase orders and supplier commitments require human approval.',
       '{"specialty_market":"Supply chain & procurement","segments":["Supplier discovery","RFQ comparison","Contract renewal monitoring","Spend exception review"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["purchase orders","supplier commitments","contract changes","payments"]}'::jsonb),
      ('Capuccino','capuccino',
       'Advertising and creative-operations Pet; prepares source-backed creative briefs, controlled variants and honest campaign readouts. Brand judgment, claims, targeting, budgets and publication require human approval.',
       '{"specialty_market":"Advertising & creative operations","segments":["Audience research","Creative briefs","Variant production","Performance learning"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["brand positioning","factual or regulated claims","ad targeting","spend","publication"]}'::jsonb),
      ('Ollie','ollie',
       'Recruitment and staffing operations Pet; organizes sourcing evidence, recruiter administration and interview coordination using job-related criteria. Hiring and rejection decisions remain human-owned.',
       '{"specialty_market":"Recruitment & staffing","segments":["Talent market mapping","Job-related sourcing","Recruiter operations","Interview coordination"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["candidate ranking with consequential effect","hiring decisions","rejection decisions","protected-trait inference"]}'::jsonb),
      ('Pico','pico',
       'IT managed-services Pet; triages service desk and monitoring evidence and prepares least-privilege access-request packets. Production changes require an authorized approval and verified execution path.',
       '{"specialty_market":"IT managed services","segments":["Service desk triage","Monitoring summaries","Access-request packets","Patch-status reporting"],"execution_mode":"draft_only","human_approval_required":true,"approval_boundaries":["production changes","permission grants","patching","deletion","credential access"]}'::jsonb)
    ) AS defaults(name, slug, purpose, policy)
  LOOP
    INSERT INTO public.pets (organization_id, name, slug, purpose, policy, created_by)
    VALUES (org_id, pet_name, pet_slug, pet_purpose, pet_policy, auth_user_id)
    ON CONFLICT (organization_id, slug) DO NOTHING;
  END LOOP;

  RETURN QUERY SELECT auth_user_id, org_id, coalesce(org_role,'member'), was_created;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_owner_workspace(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_owner_workspace(text) TO service_role;

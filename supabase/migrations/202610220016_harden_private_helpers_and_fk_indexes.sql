-- Whilo hardening pass: keep privileged helpers outside the exposed public API,
-- make row-security predicates scale, and add covering indexes for missing FK indexes.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Keep helper function OIDs intact so existing policies and views continue to work,
-- while preventing PostgREST's default public-schema RPC surface from exposing them.
alter function public.is_org_member(uuid) set schema private;
alter function public.can_view_human_profile(uuid) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.ensure_human_profile() set schema private;

alter function private.is_org_member(uuid) set search_path = pg_catalog, public;
alter function private.can_view_human_profile(uuid) set search_path = pg_catalog, public;
alter function private.handle_new_user() set search_path = pg_catalog, public;
alter function private.ensure_human_profile() set search_path = pg_catalog, public;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.can_view_human_profile(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.can_view_human_profile(uuid) to authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function private.ensure_human_profile() from public, anon, authenticated, service_role;

-- Wrap stable auth lookups in a scalar subquery to avoid evaluating them per-row.
do $$
declare
  p record;
  statement text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    statement := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null and p.qual like '%auth.uid()%' then
      statement := statement || format(' using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if p.with_check is not null and p.with_check like '%auth.uid()%' then
      statement := statement || format(' with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute statement;
  end loop;
end $$;

-- Build indexes for FK columns only where no existing valid index has the FK
-- columns as its leading key columns. Names are stable and collision-resistant.
do $$
declare
  fk record;
  column_list text;
  index_name text;
begin
  for fk in
    select c.oid, c.conrelid, c.conkey, n.nspname as schema_name, t.relname as table_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indisready
          and i.indpred is null
          and i.indexprs is null
          and (
            select array_agg(k.attnum::smallint order by k.ord)
            from unnest(i.indkey) with ordinality k(attnum, ord)
            where k.ord <= cardinality(c.conkey)
          ) = c.conkey
      )
  loop
    select string_agg(format('%I', a.attname), ', ' order by u.ord)
      into column_list
    from unnest(fk.conkey) with ordinality u(attnum, ord)
    join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = u.attnum;

    index_name := 'whilo_fk_' || substr(md5(fk.oid::text), 1, 12);
    execute format('create index if not exists %I on %I.%I (%s)',
      index_name, fk.schema_name, fk.table_name, column_list);
  end loop;
end $$;

comment on schema private is 'Whilo internal helper functions; intentionally not part of the public PostgREST API.';

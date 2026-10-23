-- Post-create index pass for foreign keys introduced after the initial platform migration.
-- Only create a btree index when no valid, non-partial index already covers the FK's leading columns.
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
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid and i.indisready
          and i.indpred is null and i.indexprs is null
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

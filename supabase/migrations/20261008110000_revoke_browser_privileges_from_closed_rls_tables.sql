-- Close the SQL privilege layer on RLS tables that intentionally have no policies.
--
-- PostgreSQL uses two independent gates for normal row access:
--   1. SQL privileges (GRANT/REVOKE), and
--   2. row-level security policies.
--
-- With RLS enabled and no policy, normal row access is default-deny. However,
-- TRUNCATE and REFERENCES are not governed by RLS. Historical default/table
-- grants therefore leave a privilege surface that is unnecessary for tables
-- which are deliberately closed to anon/authenticated callers.
--
-- This migration does not add policies, broaden access, touch service_role, or
-- change any table that currently has an RLS policy. A future migration that
-- intentionally makes one of these tables browser-accessible must explicitly
-- add both its policy and the minimum required SQL grants.
begin;

do $closed_rls_browser_privileges$
declare
  target record;
  hardened_tables integer := 0;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not exists (
        select 1
        from pg_policy p
        where p.polrelid = c.oid
      )
      and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
        or has_table_privilege('authenticated', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'REFERENCES')
        or has_table_privilege('authenticated', c.oid, 'TRIGGER')
      )
    order by c.relname
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      target.schema_name,
      target.table_name
    );
    hardened_tables := hardened_tables + 1;
  end loop;

  if hardened_tables = 0 then
    raise exception 'closed-RLS browser hardening matched zero tables; refusing vacuous success';
  end if;

  raise notice 'revoked browser-role table privileges from % closed RLS tables', hardened_tables;
end
$closed_rls_browser_privileges$;

do $verify_closed_rls_browser_privileges$
declare
  remaining_table_grants integer;
  explicit_column_acls integer;
begin
  select count(*)
  into remaining_table_grants
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
    and not exists (
      select 1
      from pg_policy p
      where p.polrelid = c.oid
    )
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
      or has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('anon', c.oid, 'REFERENCES')
      or has_table_privilege('anon', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'SELECT')
      or has_table_privilege('authenticated', c.oid, 'INSERT')
      or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('authenticated', c.oid, 'DELETE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
    );

  if remaining_table_grants <> 0 then
    raise exception '% closed RLS tables still grant privileges to anon/authenticated', remaining_table_grants;
  end if;

  -- There were no explicit column ACLs in the production preflight. Guard that
  -- property too: a column-specific grant could otherwise survive a table-level
  -- REVOKE and reopen part of the relation later.
  select count(*)
  into explicit_column_acls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
    and a.attnum > 0
    and not a.attisdropped
    and a.attacl is not null
    and not exists (
      select 1
      from pg_policy p
      where p.polrelid = c.oid
    );

  if explicit_column_acls <> 0 then
    raise exception '% explicit column ACLs remain on closed RLS tables; review before release', explicit_column_acls;
  end if;
end
$verify_closed_rls_browser_privileges$;

commit;

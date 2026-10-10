-- SONARA P1/P2 catalog-only optimization report, 2026-10-08.
-- READ ONLY: do not add indexes, drop policies, grant roles, or touch data.
-- Run with psql -X -v ON_ERROR_STOP=1 -f scripts/sql/postgres-p1-p2-candidate-review.sql
-- on a specifically approved Supabase project. Query catalog privileges only.
-- Supabase docs: /guides/database/postgres/row-level-security-performance
--                /guides/database/query-optimization

-- Exact equivalence of policy AST + role + command + permissive mode.
-- This suggests review; dropping either side still requires protected migration.
SELECT n.nspname AS schema_name,c.relname AS table_name,
       CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END AS command,
       p.polroles::text AS roles,
       count(*) AS equivalent_policy_count,
       array_agg(p.polname ORDER BY p.polname) AS names
  FROM pg_policy p
  JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND p.polpermissive
 GROUP BY n.nspname,c.relname,p.polcmd,p.polroles,p.polpermissive,
          p.polqual,p.polwithcheck
HAVING count(*)>1
 ORDER BY equivalent_policy_count DESC,table_name,command;

-- Only count overlapping PERMISSIVE policies for actual client roles AND
-- whether the table grants that operation. `includes_service_guard` means
-- at least one policy predicates on auth.role()='service_role'; this is a
-- triage signal, NOT permission to delete another tenant-scoped policy.
-- A warning is not an access leak:
-- PostgreSQL ORs permissive policies and roles may inherit privileges.
WITH commands(command,pg_command) AS (
 VALUES ('SELECT'::text,'r'::"char"),('INSERT','a'),('UPDATE','w'),('DELETE','d')
), client_roles(role_name) AS (
 VALUES ('anon'::text),('authenticated')
), expanded AS (
 SELECT c.oid AS relation_id,n.nspname AS schema_name,c.relname AS table_name,
        role_name,commands.command,p.polname,p.polqual,p.polwithcheck,
        (concat_ws(' ',visible_policy.qual,visible_policy.with_check)
          ~* 'auth[.]role[(][)][^=]*=[[:space:]]*''service_role''') AS includes_service_guard,
        has_table_privilege(role_name,c.oid,commands.command) AS table_granted
 FROM pg_policy p
 JOIN pg_class c ON c.oid=p.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_policies visible_policy ON visible_policy.schemaname=n.nspname
   AND visible_policy.tablename=c.relname AND visible_policy.policyname=p.polname
 CROSS JOIN commands CROSS JOIN client_roles
 WHERE n.nspname='public' AND p.polpermissive
   AND (p.polcmd='*' OR p.polcmd=commands.pg_command)
   AND ('public'=ANY(visible_policy.roles::text[])
        OR role_name=ANY(visible_policy.roles::text[]))
), overlapped AS (
 SELECT schema_name,table_name,role_name,command,
        bool_or(table_granted) AS table_granted,
        bool_or(includes_service_guard) AS includes_service_guard,
        count(DISTINCT polname) AS permissive_policies,
        array_agg(DISTINCT polname ORDER BY polname) AS policy_names
 FROM expanded
 GROUP BY schema_name,table_name,role_name,command
 HAVING count(DISTINCT polname)>1
)
SELECT * FROM overlapped
 ORDER BY table_granted DESC,permissive_policies DESC,table_name,role_name,command
 LIMIT 100;

-- Foreign-key prefix coverage: full, valid, ready and nonpartial B-tree only.
-- Order of equalities in a composite FK may differ; compare sorted column
-- sets in the first n index key columns (INCLUDE columns do not count).
-- This conservative query may disagree with the advisor on exotic opclasses,
-- non-B-tree access methods or constraints; discrepancies require review.
WITH foreign_keys AS (
 SELECT con.oid,constraint_name,con.conrelid,con.confrelid,con.conkey,
        cardinality(con.conkey) AS key_count,n.nspname AS schema_name,
        tab.relname AS table_name,ref.relname AS referenced_table
 FROM (
   SELECT oid,conname AS constraint_name,conrelid,confrelid,conkey,contype
   FROM pg_constraint
 ) con
 JOIN pg_class tab ON tab.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=tab.relnamespace
 JOIN pg_class ref ON ref.oid=con.confrelid
 WHERE con.contype='f' AND n.nspname='public'
), missing_coverage AS (
 SELECT fk.*
 FROM foreign_keys fk
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index ix
   JOIN pg_class idx ON idx.oid=ix.indexrelid
   JOIN pg_am am ON am.oid=idx.relam
   WHERE ix.indrelid=fk.conrelid
      AND ix.indisvalid AND ix.indisready
      AND ix.indpred IS NULL AND ix.indexprs IS NULL
      AND ix.indnkeyatts>=fk.key_count AND am.amname='btree'
      AND ARRAY(
        SELECT ix.indkey[i]::smallint
        FROM generate_series(0,fk.key_count-1) AS i ORDER BY ix.indkey[i]
      )=ARRAY(
        SELECT key::smallint FROM unnest(fk.conkey) key ORDER BY key
      )
 )
)
SELECT fk.schema_name,fk.table_name,fk.constraint_name AS foreign_key_name,
       array_to_string(ARRAY(
         SELECT attr.attname FROM unnest(fk.conkey) WITH ORDINALITY AS k(attnum,pos)
         JOIN pg_attribute attr ON attr.attrelid=fk.conrelid AND attr.attnum=k.attnum
         ORDER BY k.pos
       ),',') AS key_columns,
       fk.referenced_table,
       COALESCE(st.n_live_tup,0) AS planner_estimated_rows,
       COALESCE(st.seq_scan,0) AS observed_seq_scans,
       COALESCE(st.seq_tup_read,0) AS observed_seq_tuples_read,
       pg_total_relation_size(fk.conrelid) AS relation_bytes,
       CASE
         WHEN COALESCE(st.n_live_tup,0)<1000 THEN 'defer_small_table'
         WHEN COALESCE(st.seq_scan,0)<20 THEN 'capture_query_plan'
         WHEN COALESCE(st.seq_tup_read,0)<50000 THEN 'measure_fk_workload'
         ELSE 'review_explain_analyze_and_write_cost'
       END AS required_next_step
FROM missing_coverage fk
LEFT JOIN pg_stat_user_tables st ON st.relid=fk.conrelid
ORDER BY COALESCE(st.n_live_tup,0) DESC,
         COALESCE(st.seq_scan,0) DESC,
         fk.table_name,fk.constraint_name
LIMIT 100;

-- SECURITY DEFINER is necessary for some policy membership lookups, but
-- makes callers run under the function owner. Inspect privileges and owner,
-- and require positive and negative user A/B tests before altering grants.
SELECT p.oid::regprocedure::text AS function_name,
       pg_get_userbyid(p.proowner) AS owner_name,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       p.proconfig AS session_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.oid::regprocedure::text;

-- PostgreSQL counters are resettable, and small data sets often prefer seq
-- scans. These alone never authorize CREATE INDEX or DROP INDEX.

-- Subscription migration-vs-catalog RLS drift (metadata only, zero writes).
-- The canonical member/admin rule comes from 011_sonara_saas_launch_system.sql.
-- Two different user_id ownership rules were found in preview but not in the
-- checked-in migration history. Do not automatically copy/drop them: compare
-- real tenant membership semantics and obtain an approved migration first.
-- A clean native replay expects the canonical rule and neither extra rule.
WITH policy_names(name, origin) AS (
  VALUES ('subscriptions_select_member'::text, 'checked-in migration 011'::text),
         ('Users can view own subscriptions'::text, 'not in checked-in migrations'::text),
         ('Users can view their own subscription'::text, 'not in checked-in migrations'::text)
), observed AS (
  SELECT policyname, permissive, roles::text AS roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='subscriptions'
)
SELECT n.name AS policy_name, n.origin AS expected_origin,
       o.policyname IS NOT NULL AS exists_in_catalog,
       o.roles, o.cmd, o.qual,
       CASE
         WHEN n.name='subscriptions_select_member' AND o.policyname IS NULL
           THEN 'missing_migration_policy'
         WHEN n.name='subscriptions_select_member' AND (
           o.permissive IS DISTINCT FROM 'PERMISSIVE'
           OR o.roles IS DISTINCT FROM '{authenticated}'
           OR o.cmd IS DISTINCT FROM 'SELECT'
           OR replace(regexp_replace(lower(coalesce(o.qual,'')),'[[:space:]()]','','g'),'public.','')
              IS DISTINCT FROM 'is_org_memberorganization_idoris_admin_or_founder'
           OR o.with_check IS NOT NULL
         ) THEN 'migration_policy_definition_drift'
         WHEN n.name='subscriptions_select_member' THEN 'migration_policy_matches'
         WHEN o.policyname IS NOT NULL THEN 'extra_policy_not_in_migration_history'
         ELSE 'extra_policy_absent'
       END AS review_status
FROM policy_names n
LEFT JOIN observed o ON o.policyname=n.name
ORDER BY n.name;

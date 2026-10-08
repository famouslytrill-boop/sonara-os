-- SONARA active preview database: narrowly scoped performance hygiene.
-- Audit 2026-10-08, PostgreSQL 17.6, target project yqncsonkxgwhcxedgevk.
-- Two redundant indexes and three non-row-dependent auth.uid() initplans.
-- This migration must pass PostgreSQL replay + role-matrix tests before deployment.
-- No RLS roles, grants, ownership predicates, rows or FK constraints are changed.
-- The inactive sonara-industries-prod project is NOT the target.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE v_ok boolean;
BEGIN
  -- Both employee_schedules indexes are valid, ready, unconstrained,
  -- non-unique and identical across table, keys, operator classes,
  -- collations, options, key count, expressions and predicates.
  SELECT
    count(*) = 2
    AND count(*) FILTER (WHERE ix.indisvalid AND ix.indisready
                        AND NOT ix.indisunique AND NOT ix.indisprimary
                        AND NOT ix.indisreplident) = 2
    AND count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM pg_constraint pc WHERE pc.conindid = ix.indexrelid
        )) = 0
    AND count(DISTINCT (ix.indrelid, ix.indkey::text, ix.indclass::text,
                        ix.indcollation::text, ix.indoption::text,
                        ix.indnkeyatts, ix.indnatts,
                        coalesce(pg_get_expr(ix.indpred, ix.indrelid), ''),
                        coalesce(pg_get_expr(ix.indexprs, ix.indrelid), ''))) = 1
  INTO v_ok
  FROM pg_index ix
  JOIN pg_class cls ON cls.oid = ix.indexrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND cls.relname IN ('employee_schedules_org_starts_at_idx',
                        'employee_schedules_organization_starts_at_idx');
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'employee_schedules indexes differ or missing; abort';
  END IF;

  -- Keep the unique constraint-backed entities_slug_key; drop only
  -- the equivalent non-unique, non-constraint-backed index.
  SELECT
    count(*) = 2
    AND count(*) FILTER (WHERE cls.relname = 'entities_slug_idx'
           AND NOT ix.indisunique AND NOT ix.indisprimary
           AND NOT ix.indisreplident AND ix.indisvalid AND ix.indisready
           AND NOT EXISTS (SELECT 1 FROM pg_constraint pc
                           WHERE pc.conindid = ix.indexrelid)) = 1
    AND count(*) FILTER (WHERE cls.relname = 'entities_slug_key'
           AND ix.indisunique AND ix.indisvalid AND ix.indisready
           AND EXISTS (SELECT 1 FROM pg_constraint pc
                       WHERE pc.conindid = ix.indexrelid)) = 1
    AND count(DISTINCT (ix.indrelid, ix.indkey::text, ix.indclass::text,
                        ix.indcollation::text, ix.indoption::text,
                        ix.indnkeyatts, ix.indnatts,
                        coalesce(pg_get_expr(ix.indpred, ix.indrelid), ''),
                        coalesce(pg_get_expr(ix.indexprs, ix.indrelid), ''))) = 1
  INTO v_ok
  FROM pg_index ix
  JOIN pg_class cls ON cls.oid = ix.indexrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND cls.relname IN ('entities_slug_idx', 'entities_slug_key');
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'entities slug indexes differ or missing; abort';
  END IF;

  -- Verify the exact old policy semantics; never silently overwrite drift.
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
      AND ((tablename = 'device_permission_grants'
            AND policyname = 'device_permission_grants_self_insert'
            AND cmd = 'INSERT' AND roles = ARRAY['authenticated']::name[]
            AND with_check = '(user_id = auth.uid())')
        OR (tablename = 'device_permission_grants'
            AND policyname = 'device_permission_grants_self_read'
            AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(user_id = auth.uid())')
        OR (tablename = 'creator_follows'
            AND policyname = 'people can read their own follows'
            AND cmd = 'SELECT' AND roles = ARRAY['public']::name[]
            AND qual = '(auth.uid() = follower_user_id)'))) <> 3
  THEN
    RAISE EXCEPTION 'RLS policy definition changed; abort';
  END IF;
END;
$preflight$;

DROP INDEX public.employee_schedules_org_starts_at_idx;
DROP INDEX public.entities_slug_idx;

-- Non-correlated scalar subqueries become one-time InitPlans.
-- The row-dependent user_id/follower_user_id comparisons remain unchanged.
ALTER POLICY device_permission_grants_self_insert
  ON public.device_permission_grants
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY device_permission_grants_self_read
  ON public.device_permission_grants
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "people can read their own follows"
  ON public.creator_follows
  USING ((SELECT auth.uid()) = follower_user_id);

DO $postflight$
BEGIN
  IF to_regclass('public.employee_schedules_org_starts_at_idx') IS NOT NULL
     OR to_regclass('public.entities_slug_idx') IS NOT NULL
     OR to_regclass('public.employee_schedules_organization_starts_at_idx') IS NULL
     OR to_regclass('public.entities_slug_key') IS NULL
  THEN RAISE EXCEPTION 'index postflight failed'; END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND ((tablename = 'device_permission_grants'
              AND policyname = 'device_permission_grants_self_insert'
              AND cmd = 'INSERT' AND roles = ARRAY['authenticated']::name[]
              AND with_check ~* 'SELECT[[:space:]]+auth[.]uid[(][)]')
          OR (tablename = 'device_permission_grants'
              AND policyname = 'device_permission_grants_self_read'
              AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
              AND qual ~* 'SELECT[[:space:]]+auth[.]uid[(][)]')
          OR (tablename = 'creator_follows'
              AND policyname = 'people can read their own follows'
              AND cmd = 'SELECT' AND roles = ARRAY['public']::name[]
              AND qual ~* 'SELECT[[:space:]]+auth[.]uid[(][)]'))) <> 3
  THEN RAISE EXCEPTION 'RLS postflight failed'; END IF;
END;
$postflight$;
COMMIT;

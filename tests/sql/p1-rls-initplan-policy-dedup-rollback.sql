-- P1 RLS staging proof, updated for 20261008100000_tighten_service_role_rls_policies.
-- Do NOT modify historical migrations to silence definition drift.
-- The previous probe expected 21 obsolete auth.role() service-role policies
-- and 4 obsolete unwrapped auth.uid() policies; those exact definitions were
-- correctly replaced by the later hardening migration. This probe checks
-- their CURRENT exact role, operation and predicate shape, then safely
-- stages only an exact duplicate subscriptions policy removal.
-- All changes are rolled back, and any drift fails the native replay.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE expected_rls_p1 (
  tbl text NOT NULL,
  policy_name text NOT NULL,
  permissive text NOT NULL,
  roles text NOT NULL,
  cmd text NOT NULL,
  qualifier text,
  check_expr text
) ON COMMIT DROP;
INSERT INTO expected_rls_p1 VALUES
  ('agent_pending_actions', 'service role manages agent_pending_actions', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('agent_schedules', 'service role manages agent_schedules', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_employee_profiles', 'business_employee_profiles_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL),
  ('business_sub_app_records', 'service role can manage business_sub_app_records', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_work_order_assignments', 'service role manages business_work_order_assignments', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_work_order_events', 'service role manages business_work_order_events', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_work_order_evidence', 'service role manages business_work_order_evidence', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_work_order_materials', 'service role manages business_work_order_materials', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('business_work_orders', 'service role manages business_work_orders', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('creator_follows', 'service role can manage creator_follows', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('customer_invoice_lines', 'service role can manage customer_invoice_lines', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('customer_invoice_payments', 'service role can manage customer_invoice_payments', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('customer_invoices', 'service role can manage customer_invoices', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_artifacts', 'service role manages generation_artifacts', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_attempts', 'service role manages generation_attempts', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_audit_events', 'service role manages generation_audit_events', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_callback_events', 'service role manages generation_callback_events', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_cost_events', 'service role manages generation_cost_events', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('generation_jobs', 'service role manages generation_jobs', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('merchant_product_variants', 'service role can manage merchant_product_variants', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('merchant_products', 'service role can manage merchant_products', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('shared_links', 'service role can manage shared_links', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
  ('sonara_platforms', 'sonara_platforms_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL),
  ('user_notifications', 'user_notifications_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL),
  ('user_preferences', 'user_preferences_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(( SELECT auth.uid() AS uid) = user_id)', NULL);

DO $drift$
DECLARE bad int;
BEGIN
  IF (SELECT count(*) FROM expected_rls_p1) <> 25
    OR (SELECT count(DISTINCT (tbl,policy_name)) FROM expected_rls_p1) <> 25
  THEN RAISE EXCEPTION 'P1 expected exactly 25 distinct policies'; END IF;

  SELECT count(*) INTO bad
  FROM expected_rls_p1 e
  LEFT JOIN pg_policies p
    ON p.schemaname='public'
    AND p.tablename=e.tbl AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR p.qual IS DISTINCT FROM e.qualifier
    OR p.with_check IS DISTINCT FROM e.check_expr;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'P1 hardened policy definition drift on % of 25 policies; abort',bad;
  END IF;

  -- Fresh migration replay can legitimately contain one canonical policy;
  -- a hosted database may carry a second duplicate. Preserve only a
  -- direct owner-equality SELECT granted to authenticated users. If there
  -- are two, they must be byte-for-byte equivalent before staging removal.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname='Users can view own subscriptions') <> 1
  THEN RAISE EXCEPTION 'subscriptions canonical owner policy absent; abort'; END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname IN ('Users can view own subscriptions',
                           'Users can view their own subscription')) NOT BETWEEN 1 AND 2
  THEN RAISE EXCEPTION 'subscriptions owner policy count drifted; abort'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions'
      AND policyname IN ('Users can view own subscriptions',
                         'Users can view their own subscription')
      AND (
        permissive <> 'PERMISSIVE' OR
        roles <> ARRAY['authenticated']::name[] OR
        cmd <> 'SELECT' OR with_check IS NOT NULL OR
        regexp_replace(lower(qual),'[[:space:]()]','','g') NOT IN
          ('auth.uid=user_id', 'user_id=auth.uid',
           'selectauth.uidasuid=user_id', 'user_id=selectauth.uidasuid')
      )
  ) THEN RAISE EXCEPTION 'subscriptions owner predicate or grants drifted; abort'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='subscriptions'
      AND policyname='Users can view their own subscription')
    AND (SELECT count(DISTINCT qual) FROM pg_policies WHERE schemaname='public'
      AND tablename='subscriptions'
      AND policyname IN ('Users can view own subscriptions',
                         'Users can view their own subscription')) <> 1
  THEN RAISE EXCEPTION 'subscriptions duplicate differs from canonical; abort'; END IF;
END
$drift$;

-- Preserve the original canonical predicate byte-for-byte across staging.
CREATE TEMP TABLE subscription_select_baseline ON COMMIT DROP AS
  SELECT permissive, roles::text AS roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='subscriptions'
    AND policyname='Users can view own subscriptions';

-- This is a staging-only proof; no permanent policy is modified.
-- If a fresh replay has no duplicate, there is nothing to drop.
DO $deduplicate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='subscriptions'
       AND policyname='Users can view their own subscription') THEN
    EXECUTE 'DROP POLICY "Users can view their own subscription" ON public.subscriptions';
  END IF;
END
$deduplicate$;

DO $postflight$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM expected_rls_p1 e
  LEFT JOIN pg_policies p
    ON p.schemaname='public'
    AND p.tablename=e.tbl AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR p.qual IS DISTINCT FROM e.qualifier
    OR p.with_check IS DISTINCT FROM e.check_expr;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'P1 postflight drift on % hardened policies; abort',bad;
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname='Users can view own subscriptions'
        AND permissive='PERMISSIVE'
        AND roles=ARRAY['authenticated']::name[]
        AND cmd='SELECT'
        AND (permissive, roles::text, cmd, qual, with_check) IS NOT DISTINCT FROM
            (SELECT permissive, roles, cmd, qual, with_check FROM subscription_select_baseline)
       ) <> 1
    OR (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname='Users can view their own subscription') <> 0
  THEN RAISE EXCEPTION 'P1 duplicate-subscription policy staging failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

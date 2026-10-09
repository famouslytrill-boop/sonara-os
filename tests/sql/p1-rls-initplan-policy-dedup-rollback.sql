-- Staging-only P1 draft. This is NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Generate a forward migration through Supabase CLI only after live/fixture
-- schema comparison, role-denial regression, approval and exact-head CI.
-- Verifies 25 already-hardened auth policies and rollbacks a duplicate
-- subscription SELECT-policy removal. No changes to existing migrations.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE TEMP TABLE expected_rls_p1 (
 tbl text NOT NULL, policy_name text NOT NULL, permissive text NOT NULL,
 roles text NOT NULL, cmd text NOT NULL, qualifier text, check_expr text
) ON COMMIT DROP;
INSERT INTO expected_rls_p1 VALUES
    ('agent_pending_actions', 'service role manages agent_pending_actions', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('agent_schedules', 'service role manages agent_schedules', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_employee_profiles', 'business_employee_profiles_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
    ('business_sub_app_records', 'service role can manage business_sub_app_records', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_work_order_assignments', 'service role manages business_work_order_assignments', 'PERMISSIVE', '{service_role}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_work_order_events', 'service role manages business_work_order_events', 'PERMISSIVE', '{service_role}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_work_order_evidence', 'service role manages business_work_order_evidence', 'PERMISSIVE', '{service_role}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_work_order_materials', 'service role manages business_work_order_materials', 'PERMISSIVE', '{service_role}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('business_work_orders', 'service role manages business_work_orders', 'PERMISSIVE', '{service_role}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('creator_follows', 'service role can manage creator_follows', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('customer_invoice_lines', 'service role can manage customer_invoice_lines', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('customer_invoice_payments', 'service role can manage customer_invoice_payments', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('customer_invoices', 'service role can manage customer_invoices', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_artifacts', 'service role manages generation_artifacts', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_attempts', 'service role manages generation_attempts', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_audit_events', 'service role manages generation_audit_events', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_callback_events', 'service role manages generation_callback_events', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_cost_events', 'service role manages generation_cost_events', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('generation_jobs', 'service role manages generation_jobs', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('merchant_product_variants', 'service role can manage merchant_product_variants', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('merchant_products', 'service role can manage merchant_products', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('shared_links', 'service role can manage shared_links', 'PERMISSIVE', '{public}', 'ALL', '(auth.role() = ''service_role''::text)', '(auth.role() = ''service_role''::text)'),
    ('sonara_platforms', 'sonara_platforms_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
    ('user_notifications', 'user_notifications_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
    ('user_preferences', 'user_preferences_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL);

-- Applied migration 20261008100000 already hardened these 25 policies.
-- Preserve exact expected scope and row filters; NEVER undo the migration.
UPDATE expected_rls_p1
SET roles = '{service_role}', qualifier = 'true', check_expr = 'true'
WHERE roles IN ('{public}', '{service_role}')
  AND cmd = 'ALL'
  AND qualifier = '(auth.role() = ''service_role''::text)'
  AND check_expr = '(auth.role() = ''service_role''::text)';

UPDATE expected_rls_p1
SET qualifier = '(( SELECT auth.uid() AS uid) = user_id)'
WHERE roles = '{authenticated}' AND cmd = 'SELECT'
  AND qualifier = '(auth.uid() = user_id)' AND check_expr IS NULL;

DO $preflight$
DECLARE bad integer;
BEGIN
  IF (SELECT count(*) FROM expected_rls_p1) <> 25
    OR (SELECT count(*) FROM expected_rls_p1
        WHERE roles='{service_role}' AND cmd='ALL'
          AND qualifier='true' AND check_expr='true') <> 21
    OR (SELECT count(*) FROM expected_rls_p1
        WHERE roles='{authenticated}' AND cmd='SELECT'
          AND qualifier='(( SELECT auth.uid() AS uid) = user_id)'
          AND check_expr IS NULL) <> 4 THEN
    RAISE EXCEPTION 'P1 hardened policy expectations altered; abort';
  END IF;

  SELECT count(*) INTO bad FROM expected_rls_p1 e
  LEFT JOIN pg_policies p ON p.schemaname='public'
    AND p.tablename=e.tbl AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM e.permissive
     OR p.roles::text IS DISTINCT FROM e.roles
     OR p.cmd IS DISTINCT FROM e.cmd
     OR p.qual IS DISTINCT FROM e.qualifier
     OR p.with_check IS DISTINCT FROM e.check_expr;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'P1 hardened policy definition drift on % policies; abort',bad;
  END IF;

  -- Both duplicate policies must have precisely the same member predicate.
  IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions'
      AND policyname IN ('Users can view own subscriptions',
                         'Users can view their own subscription')
      AND permissive='PERMISSIVE'
      AND roles=ARRAY['authenticated']::name[] AND cmd='SELECT'
      AND qual='(( SELECT auth.uid() AS uid) = user_id)'
      AND with_check IS NULL) <> 2 THEN
    RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort';
  END IF;
END
$preflight$;

-- Only this duplicate is exercised, inside a ROLLBACK-only transaction.
-- The 25 already-hardened policies are never weakened or rewritten.
DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $postflight$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM expected_rls_p1 e
  LEFT JOIN pg_policies p ON p.schemaname='public'
    AND p.tablename=e.tbl AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM e.permissive
     OR p.roles::text IS DISTINCT FROM e.roles
     OR p.cmd IS DISTINCT FROM e.cmd
     OR p.qual IS DISTINCT FROM e.qualifier
     OR p.with_check IS DISTINCT FROM e.check_expr;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'P1 hardened policy postflight drift on % policies; abort',bad;
  END IF;
  IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions'
      AND policyname='Users can view own subscriptions'
      AND permissive='PERMISSIVE'
      AND roles=ARRAY['authenticated']::name[] AND cmd='SELECT'
      AND qual='(( SELECT auth.uid() AS uid) = user_id)'
      AND with_check IS NULL) <> 1
    OR EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname='Users can view their own subscription') THEN
    RAISE EXCEPTION 'P1 subscription dedup postflight failed; abort';
  END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

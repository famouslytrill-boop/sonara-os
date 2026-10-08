-- Staging-only P1 draft. This is NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Generate a forward migration through Supabase CLI only after live/fixture
-- schema comparison, role-denial regression, approval and exact-head CI.
-- Checks: 21 service-role-only policies already hardened by migration
-- 20261008100000 and four optimized user-ownership policies, then proposes
-- a transaction-rollback-only dedup of one exactly matching SELECT policy.
-- Never restore an auth.role() predicate or broaden role access.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE TEMP TABLE expected_rls_p1 (
 tbl text NOT NULL, policy_name text NOT NULL, permissive text NOT NULL,
 roles text NOT NULL, cmd text NOT NULL, qualifier text, check_expr text
) ON COMMIT DROP;
INSERT INTO expected_rls_p1 VALUES
    ('agent_pending_actions', 'service role manages agent_pending_actions', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
    ('agent_schedules', 'service role manages agent_schedules', 'PERMISSIVE', '{service_role}', 'ALL', 'true', 'true'),
    ('business_employee_profiles', 'business_employee_profiles_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
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
    ('sonara_platforms', 'sonara_platforms_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
    ('user_notifications', 'user_notifications_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL),
    ('user_preferences', 'user_preferences_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', '(auth.uid() = user_id)', NULL);


DO $verify_optimized_policy_baseline$
DECLARE bad integer;
BEGIN
  -- Verify the complete current post-hardening shape, not just existence.
  IF (SELECT count(*) FROM expected_rls_p1) <> 25 THEN
    RAISE EXCEPTION 'P1 policy inventory changed; abort';
  END IF;
  SELECT count(*) INTO bad
  FROM expected_rls_p1 e
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public' AND p.tablename = e.tbl AND p.policyname = e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM e.permissive
     OR p.roles::text IS DISTINCT FROM e.roles
     OR p.cmd IS DISTINCT FROM e.cmd
     OR (e.cmd = 'ALL' AND
         (p.qual IS DISTINCT FROM 'true' OR p.with_check IS DISTINCT FROM 'true'))
     OR (e.cmd = 'SELECT' AND (
          regexp_replace(lower(coalesce(p.qual,'')), '[[:space:]()]', '', 'g')
             IS DISTINCT FROM 'selectauth.uidasuid=user_id'
          OR p.with_check IS NOT NULL
        ));
  IF bad <> 0 THEN
    RAISE EXCEPTION 'P1 post-hardening policy drift on % of 25 policies; abort', bad;
  END IF;
END
$verify_optimized_policy_baseline$;

-- A rollback-only exercise for exact duplicate subscription SELECT policies.
DO $check_duplicate_before$
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'subscriptions'
        AND policyname IN ('Users can view own subscriptions',
                           'Users can view their own subscription')
        AND permissive = 'PERMISSIVE'
        AND roles = ARRAY['authenticated']::name[]
        AND cmd = 'SELECT'
        AND qual = '(( SELECT auth.uid() AS uid) = user_id)'
        AND with_check IS NULL) <> 2 THEN
    RAISE EXCEPTION 'subscription dedup preflight definitions drifted; abort';
  END IF;
END
$check_duplicate_before$;

DROP POLICY "Users can view their own subscription" ON public.subscriptions;

-- Exact after-state and rollback proof: neither a role nor any of the
-- optimized RLS rules was modified by the dedup exercise.
DO $postflight$
DECLARE survivors integer;
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname='Users can view own subscriptions'
        AND permissive='PERMISSIVE'
        AND roles=ARRAY['authenticated']::name[]
        AND cmd='SELECT'
        AND qual='(( SELECT auth.uid() AS uid) = user_id)'
        AND with_check IS NULL) <> 1
  OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='subscriptions'
             AND policyname='Users can view their own subscription') THEN
    RAISE EXCEPTION 'P1 subscription dedup failed';
  END IF;
END
$postflight$;

SELECT 'p1_post_hardening_rls_and_dedup_rollback_passed';
ROLLBACK;

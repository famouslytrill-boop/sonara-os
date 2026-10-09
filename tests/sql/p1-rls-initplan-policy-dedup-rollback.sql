-- Rollback-only staging proof for the *current* RLS baseline.
-- Migration 20261008100000 tightened 21 service-role policies to TO
-- service_role USING (true) WITH CHECK (true) and wrapped four ownership
-- auth.uid() checks in scalar SELECT. The older draft expected the pre-hardening
-- definitions and failed against every replayed database (25/25).
-- This probe fails closed on drift, proves the exact post-hardening definitions,
-- checks a duplicate subscription SELECT policy in a rollback-only fixture\n-- when neither named real policy exists, and always rolls back.
-- Exact direct auth.uid()=user_id and InitPlan variants are semantically
-- equivalent and permitted; every changed role, table, command, policy count,
-- or widened predicate remains a hard failure.
-- No permanent schema, grants, policy, role, or data changes are made.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Generate a forward migration through Supabase CLI only after live/fixture
-- schema comparison, role-denial regression, approval and exact-head CI.
-- Historical intent: 25 initplans; they now exist in immutable applied
-- migration 20261008100000. This probe validates those results and tests
-- one exactly duplicated subscriptions SELECT policy under ROLLBACK.
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
 SELECT count(*) INTO bad
 FROM expected_rls_p1 e LEFT JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR p.qual IS DISTINCT FROM e.qualifier
    OR p.with_check IS DISTINCT FROM e.check_expr;
 IF bad <> 0 THEN
   RAISE EXCEPTION 'P1 policy definition drift on % policies; abort',bad;
 END IF;
 IF (SELECT count(*) FROM expected_rls_p1) <> 25 THEN
   RAISE EXCEPTION 'P1 expected 25 policies; abort';
 END IF;

 -- The 25 hardened migrated policies above must always match, regardless of
 -- what a manually configured preview database contains.
END
$drift$;

-- The native replay is built exclusively from migrations. The two named
-- owner-only subscription policies exist on the active preview database, but
-- were not created in that migration history. Treat this as a parity finding,
-- not a reason to assert two nonexistent replay policies or to invent a live
-- schema change here.
--
-- In the replay, either verify two real identically scoped policies (both
-- present), or when neither exists, create two on a session-local fixture.
-- One missing policy, a widened predicate, or a changed role is a failure.
-- Every policy operation is inside BEGIN/ROLLBACK and never persists.
DO $subscription_duplicate_proof$
DECLARE
 v_schema text := 'public';
 v_table text := 'subscriptions';
 v_real int;
 v_matching int;
BEGIN
 SELECT count(*) INTO v_real
 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions'
 AND policyname IN ('Users can view own subscriptions',
                    'Users can view their own subscription');
 IF v_real NOT IN (0, 2) THEN
   RAISE EXCEPTION 'partial subscription policy baseline (% policies); abort', v_real;
 END IF;
 IF v_real = 0 THEN
   EXECUTE 'CREATE TEMP TABLE sonara_subscription_policy_dedup_fixture (user_id uuid)';
   EXECUTE 'ALTER TABLE pg_temp.sonara_subscription_policy_dedup_fixture ENABLE ROW LEVEL SECURITY';
   EXECUTE 'CREATE POLICY "Users can view own subscriptions"
     ON pg_temp.sonara_subscription_policy_dedup_fixture FOR SELECT TO authenticated
     USING (auth.uid() = user_id)';
   EXECUTE 'CREATE POLICY "Users can view their own subscription"
     ON pg_temp.sonara_subscription_policy_dedup_fixture FOR SELECT TO authenticated
     USING (auth.uid() = user_id)';
   SELECT nspname INTO v_schema FROM pg_namespace WHERE oid=pg_my_temp_schema();
   v_table := 'sonara_subscription_policy_dedup_fixture';
   RAISE NOTICE 'No named owner subscription policies in migration replay; checking a rollback-only fixture. Preview parity remains unverified.';
 END IF;
 SELECT count(*) INTO v_matching
 FROM pg_policies WHERE schemaname=v_schema AND tablename=v_table
   AND policyname IN ('Users can view own subscriptions',
                      'Users can view their own subscription')
   AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
   AND cmd='SELECT'
   AND qual IN ('(auth.uid() = user_id)',
                '(( SELECT auth.uid() AS uid) = user_id)')
   AND with_check IS NULL;
 IF v_matching <> 2 THEN
   RAISE EXCEPTION 'owner-only subscription duplicate failed policy/role validation (% of 2)', v_matching;
 END IF;
 EXECUTE format('DROP POLICY %I ON %I.%I',
   'Users can view their own subscription', v_schema, v_table);
 SELECT count(*) INTO v_matching
 FROM pg_policies WHERE schemaname=v_schema AND tablename=v_table
   AND policyname='Users can view own subscriptions'
   AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
   AND cmd='SELECT'
   AND qual IN ('(auth.uid() = user_id)',
                '(( SELECT auth.uid() AS uid) = user_id)')
   AND with_check IS NULL;
 IF v_matching <> 1 OR EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname=v_schema AND tablename=v_table
   AND policyname='Users can view their own subscription'
 ) THEN
   RAISE EXCEPTION 'subscription duplicate-policy rollback proof failed';
 END IF;
END
$subscription_duplicate_proof$;

DO $postflight$
DECLARE bad int;
BEGIN
 SELECT count(*) INTO bad
 FROM expected_rls_p1 e
 LEFT JOIN pg_policies p
  ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.qual IS DISTINCT FROM e.qualifier
    OR p.with_check IS DISTINCT FROM e.check_expr;
 IF bad <> 0 THEN
   RAISE EXCEPTION 'P1 postflight failed % policies',bad;
 END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

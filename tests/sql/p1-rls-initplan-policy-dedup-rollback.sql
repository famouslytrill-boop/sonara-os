-- Rollback-only staging proof for the *current* RLS baseline.
-- Migration 20261008100000 tightened 21 service-role policies to TO
-- service_role USING (true) WITH CHECK (true) and wrapped four ownership
-- auth.uid() checks in scalar SELECT. The older draft expected the pre-hardening
-- definitions and failed against every replayed database (25/25).
-- This probe fails closed on drift, proves the exact post-hardening definitions,
-- checks a duplicate subscription SELECT policy can be dropped, and rolls back.
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

 -- These two permissive policies must be identical in all security dimensions
 -- before one can safely be dropped.
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')
       AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       -- Both are exact representations of the same owner-only predicate.
       -- A fresh migration replay can preserve the direct auth.uid() form,
       -- while active preview has the noncorrelated SELECT InitPlan form.
       -- Any wider predicate, changed role or extra operation still aborts.
       AND qual IN ('(auth.uid() = user_id)',
                    '(( SELECT auth.uid() AS uid) = user_id)')
       AND with_check IS NULL) <> 2 THEN
   RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort. Actual: %',
     (SELECT jsonb_agg(jsonb_build_object(
       'name', policyname, 'roles', roles, 'cmd', cmd,
       'qual', qual, 'with_check', with_check) ORDER BY policyname)
      FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions'
      AND policyname IN ('Users can view own subscriptions',
                         'Users can view their own subscription'));
 END IF;
 -- One policy per exact name is required: duplicate equivalent predicates
 -- do not authorize accidentally dropping an unrelated broad role policy.
 IF (SELECT count(DISTINCT policyname) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')) <> 2 THEN
   RAISE EXCEPTION 'subscription owner policies missing';
 END IF;
END
$drift$;

-- Service-role policies are already hardened by migration 20261008100000.
-- Never revert them inside this probe; verify their exact role/predicate values
-- and transactionally test only the remaining duplicate subscription policy.
DROP POLICY "Users can view their own subscription" ON public.subscriptions;

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
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view own subscriptions'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual IN ('(auth.uid() = user_id)',
                    '(( SELECT auth.uid() AS uid) = user_id)')
       AND with_check IS NULL)<>1
 OR (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view their own subscription')<>0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

-- Staging-only post-hardening P1 replay proof. NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Canonical migration 20261008100000_tighten_service_role_rls_policies.sql
-- already hardened 21 pure service-role policies and 4 ownership policies.
-- Never revert those policies to pre-hardening auth.role() predicates.
-- This probe requires exact hardened definitions and the canonical
-- migration-defined subscriptions_select_member policy, without modifying it.
-- Two additional preview-only subscription policies are not created by
-- migrations and must not be expected in a native replay. Any unexpected
-- role, predicate, command, or extra policy still aborts.
-- Existing P0 synthetic role and tenant RLS write/deny matrix runs before it.
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

 -- The two duplicate SELECT policies found on the connected preview
 -- database are NOT produced by this migration history. They cannot be used
 -- as a baseline for native replay. Require their absence here, not their
 -- fabricated presence; a real drift remains a hard failure.
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')) <> 0 THEN
   RAISE EXCEPTION 'native replay unexpectedly contains preview-only subscriptions policies; abort';
 END IF;
 -- Migration 011 creates this genuine member/admin subscription policy.
 -- Require the role, command, nontrivial membership predicate, and lack of
 -- INSERT/UPDATE WITH CHECK; do not relax access to satisfy a lint result.
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='subscriptions_select_member'
       AND permissive='PERMISSIVE'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual LIKE '%is_org_member(organization_id)%'
       AND qual LIKE '%is_admin_or_founder()%'
       AND with_check IS NULL) <> 1 THEN
   RAISE EXCEPTION 'canonical subscriptions_select_member definition drifted; abort';
 END IF;
END
$drift$;

-- No ownership or service-role policy changes are needed or allowed here.
-- Their exact hardened definitions were checked above, and a regression
-- in any of those policies blocks this replay rather than broadening access.

-- No subscription policy DDL is performed in the disposable replay.
-- Preview-only duplicate removal requires a separate live catalog review,
-- approved forward migration and user/role allow-deny proof.

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
       AND policyname='subscriptions_select_member'
       AND permissive='PERMISSIVE'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual LIKE '%is_org_member(organization_id)%'
       AND qual LIKE '%is_admin_or_founder()%'
       AND with_check IS NULL) <> 1
 OR (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')) <> 0
 THEN RAISE EXCEPTION 'P1 canonical subscription policy postflight drift; abort'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

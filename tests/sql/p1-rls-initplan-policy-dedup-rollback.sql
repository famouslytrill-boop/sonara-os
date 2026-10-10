-- Staging-only post-hardening P1 replay proof. NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Canonical migration 20261008100000_tighten_service_role_rls_policies.sql
-- already hardened 21 pure service-role policies and 4 ownership policies.
-- Never revert those policies to pre-hardening auth.role() predicates.
-- This probe requires exact hardened definitions and the canonical
-- three migration-defined subscriptions policies, without modifying them.
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

CREATE TEMP TABLE expected_subscription_rls (
  policy_name text NOT NULL, permissive text NOT NULL, roles text NOT NULL,
  cmd text NOT NULL, qualifier text, check_expr text
) ON COMMIT DROP;
INSERT INTO expected_subscription_rls VALUES
  ('org members can read subscriptions', 'PERMISSIVE', '{public}', 'SELECT',
    '((organization_id IS NOT NULL) AND is_org_member(organization_id))', NULL),
  ('service role can manage subscriptions', 'PERMISSIVE', '{service_role}', 'ALL',
    'true', 'true'),
  ('subscriptions_select_member', 'PERMISSIVE', '{authenticated}', 'SELECT',
    '(is_org_member(organization_id) OR is_admin_or_founder())', NULL);

DO $drift$
DECLARE bad int;
DECLARE sample_diffs text;
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
   -- This is a read-only diagnostic of the disposable replay catalog.
   -- Preserve the exact preflight equality check above: do not apply a
   -- migration, drop a policy, normalize expressions, or turn a drift into
   -- a false green. Five samples suffice to locate a common formatting
   -- or schema divergence without flooding the CI log.
   SELECT string_agg(
     format('%I.%I: %s; expected permissive=%s actual=%s; roles=%s vs %s; command=%s vs %s; qual=%s vs %s; check=%s vs %s',
       d.tbl, d.policy_name,
       CASE WHEN d.actual_name IS NULL THEN 'POLICY MISSING' ELSE 'POLICY DRIFTED' END,
       d.expected_perm, d.actual_perm, d.expected_roles, d.actual_roles,
       d.expected_cmd, d.actual_cmd, d.expected_qual, d.actual_qual,
       d.expected_check, d.actual_check),
     E'\\n')
   INTO sample_diffs
   FROM (
     SELECT e.tbl, e.policy_name, e.permissive AS expected_perm,
       p.policyname AS actual_name, p.permissive AS actual_perm,
       e.roles AS expected_roles, p.roles::text AS actual_roles,
       e.cmd AS expected_cmd, p.cmd AS actual_cmd,
       e.qualifier AS expected_qual, p.qual AS actual_qual,
       e.check_expr AS expected_check, p.with_check AS actual_check
     FROM expected_rls_p1 e LEFT JOIN pg_policies p
       ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
     WHERE p.policyname IS NULL
        OR p.permissive IS DISTINCT FROM e.permissive
        OR p.roles::text IS DISTINCT FROM e.roles
        OR p.cmd IS DISTINCT FROM e.cmd
        OR p.qual IS DISTINCT FROM e.qualifier
        OR p.with_check IS DISTINCT FROM e.check_expr
     ORDER BY e.tbl, e.policy_name
     LIMIT 5
   ) d;
   RAISE EXCEPTION 'P1 policy definition drift on % policies; abort',bad
     USING DETAIL=COALESCE(sample_diffs,'No replay catalog differences could be displayed');
 END IF;
 IF (SELECT count(*) FROM expected_rls_p1) <> 25 THEN
   RAISE EXCEPTION 'P1 expected 25 policies; abort';
 END IF;


 IF (SELECT count(*) FROM expected_subscription_rls) <> 3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions') <> 3
 OR EXISTS (
   SELECT 1 FROM expected_subscription_rls e
   LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename='subscriptions'
     AND p.policyname=e.policy_name
   WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM e.permissive
     OR p.roles::text IS DISTINCT FROM e.roles
     OR p.cmd IS DISTINCT FROM e.cmd
     OR p.qual IS DISTINCT FROM e.qualifier
     OR p.with_check IS DISTINCT FROM e.check_expr
 ) THEN
   RAISE EXCEPTION 'P1 subscription role or predicate drift; abort';
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
       AND replace(regexp_replace(lower(qual), '[[:space:]()]', '', 'g'), 'public.', '')
           = 'is_org_memberorganization_idoris_admin_or_founder'
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
 IF (SELECT count(*) FROM expected_subscription_rls) <> 3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions') <> 3
 OR EXISTS (
   SELECT 1 FROM expected_subscription_rls e
   LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename='subscriptions'
     AND p.policyname=e.policy_name
   WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM e.permissive
     OR p.roles::text IS DISTINCT FROM e.roles
     OR p.cmd IS DISTINCT FROM e.cmd
     OR p.qual IS DISTINCT FROM e.qualifier
     OR p.with_check IS DISTINCT FROM e.check_expr
 ) THEN
   RAISE EXCEPTION 'P1 subscription role or predicate drift; abort';
 END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='subscriptions_select_member'
       AND permissive='PERMISSIVE'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND replace(regexp_replace(lower(qual), '[[:space:]()]', '', 'g'), 'public.', '')
           = 'is_org_memberorganization_idoris_admin_or_founder'
       AND with_check IS NULL) <> 1
 OR (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')) <> 0
 THEN RAISE EXCEPTION 'P1 canonical subscription policy postflight drift; abort'; END IF;
END
$postflight$;
SELECT 'p1_post_hardening_rls_and_canonical_subscription_passed';
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

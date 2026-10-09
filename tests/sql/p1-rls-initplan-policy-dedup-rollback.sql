-- Staging-only P1 post-migration attestation. NOT a Supabase migration.
-- Always ROLLBACK. The 20261008100000_tighten_service_role_rls_policies.sql
-- migration already replaced 21 pure service-role auth.role() predicates with
-- TO service_role USING true / WITH CHECK true and wrapped four user ownership
-- checks as initplans. The former test expected the OLD, pre-migration values
-- and therefore rejected all 25 correctly-hardened policies.
-- This proves exact current role scope, command, USING and WITH CHECK on those
-- 25 policies, then dry-runs subscription duplicate removal inside a rollback.
-- Never replace equality with approximate matching or skip tenant-denial probes.
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
DECLARE
  bad int;
  item record;
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
   -- Keep this security gate fail-closed. Make each mismatching policy visible
   -- with both the migration-authority expectation and the database reality.
   -- A count without these details cannot distinguish policy drift from
   -- PostgreSQL pg_policies formatting differences across major versions.
   FOR item IN
     SELECT e.tbl, e.policy_name,
       CASE WHEN p.policyname IS NULL THEN 'missing'
         ELSE concat_ws(',',
           CASE WHEN p.permissive IS DISTINCT FROM e.permissive THEN 'permissive' END,
           CASE WHEN p.roles::text IS DISTINCT FROM e.roles THEN 'roles' END,
           CASE WHEN p.cmd IS DISTINCT FROM e.cmd THEN 'command' END,
           CASE WHEN p.qual IS DISTINCT FROM e.qualifier THEN 'using' END,
           CASE WHEN p.with_check IS DISTINCT FROM e.check_expr THEN 'with_check' END)
       END AS fields,
       e.roles expected_roles, p.roles::text actual_roles,
       e.qualifier expected_using, p.qual actual_using,
       e.check_expr expected_check, p.with_check actual_check
     FROM expected_rls_p1 e
     LEFT JOIN pg_policies p ON p.schemaname='public'
       AND p.tablename=e.tbl AND p.policyname=e.policy_name
     WHERE p.policyname IS NULL OR p.permissive IS DISTINCT FROM e.permissive
       OR p.roles::text IS DISTINCT FROM e.roles OR p.cmd IS DISTINCT FROM e.cmd
       OR p.qual IS DISTINCT FROM e.qualifier
       OR p.with_check IS DISTINCT FROM e.check_expr
     ORDER BY e.tbl, e.policy_name
   LOOP
     RAISE NOTICE 'P1 drift %.% field(s)=% roles expected=% actual=% USING expected=% actual=% CHECK expected=% actual=%',
       item.tbl, item.policy_name, item.fields, item.expected_roles,
       item.actual_roles, item.expected_using, item.actual_using,
       item.expected_check, item.actual_check;
   END LOOP;
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
       AND cmd='SELECT' AND qual='(( SELECT auth.uid() AS uid) = user_id)'
       AND with_check IS NULL) <> 2 THEN
   RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort';
 END IF;
END
$drift$;

-- The approved hardening migration already applied to these 25 policies.
-- Do not modify them in this probe; preflight attests exact security context.
-- Dry-run only the remaining duplicate subscription SELECT policy below.

DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $postflight$
DECLARE
  bad int;
  service_count int;
  ownership_count int;
BEGIN
 -- Compare EVERY security dimension again after the rolled-back-only
 -- subscription DROP: the other 25 definitions must remain unchanged.
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
   RAISE EXCEPTION 'P1 postflight security drift on % policies',bad;
 END IF;

 SELECT count(*) INTO service_count
 FROM expected_rls_p1 e
 JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE e.roles='{service_role}' AND p.roles=ARRAY['service_role']::name[]
   AND p.cmd='ALL' AND p.qual='true' AND p.with_check='true';
 SELECT count(*) INTO ownership_count
 FROM expected_rls_p1 e
 JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE e.roles='{authenticated}' AND p.roles=ARRAY['authenticated']::name[]
   AND p.cmd='SELECT'
   AND p.qual='(( SELECT auth.uid() AS uid) = user_id)' AND p.with_check IS NULL;
 IF service_count <> 21 OR ownership_count <> 4 THEN
   RAISE EXCEPTION 'P1 hardening categories drifted: service=% ownership=%',
     service_count, ownership_count;
 END IF;

 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view own subscriptions'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual='(( SELECT auth.uid() AS uid) = user_id)') <> 1
 OR (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view their own subscription') <> 0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

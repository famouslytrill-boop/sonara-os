-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- Disposable/native-replay-only P1 RLS reconciliation proof.
-- The migration history and checked preview snapshot already have 21
-- service-role-scoped policies and four optimized auth.uid ownership policies.
-- The older draft expected public+auth.role predicates and would fail on all
-- 25 even though the replay schema had narrower role scopes and InitPlans.
--
-- Do NOT "repair" those existing access rules by broadening policies. Check
-- every attribute against an explicit reviewed snapshot, then dry-run the
-- single genuinely duplicate subscriptions SELECT policy removal.
-- This is NOT an applied Supabase migration. Final ROLLBACK is mandatory.
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

-- Emit only policy identifiers and mismatch categories; never print customer
-- rows or full RLS expressions to routine CI job logs.
SELECT e.tbl AS table_name, e.policy_name,
  CASE WHEN p.policyname IS NULL THEN 'policy_missing'
       ELSE concat_ws(',',
         CASE WHEN p.permissive IS DISTINCT FROM e.permissive THEN 'permissive' END,
         CASE WHEN p.roles::text IS DISTINCT FROM e.roles THEN 'roles' END,
         CASE WHEN p.cmd IS DISTINCT FROM e.cmd THEN 'command' END,
         CASE WHEN p.qual IS DISTINCT FROM e.qualifier THEN 'using_expression' END,
         CASE WHEN p.with_check IS DISTINCT FROM e.check_expr THEN 'check_expression' END)
  END AS differing_attributes
FROM expected_rls_p1 e LEFT JOIN pg_policies p
  ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
WHERE p.policyname IS NULL
   OR p.permissive IS DISTINCT FROM e.permissive
   OR p.roles::text IS DISTINCT FROM e.roles
   OR p.cmd IS DISTINCT FROM e.cmd
   OR p.qual IS DISTINCT FROM e.qualifier
   OR p.with_check IS DISTINCT FROM e.check_expr
ORDER BY e.tbl, e.policy_name;

DO $drift$
DECLARE bad int;
BEGIN
 SELECT count(*) INTO bad FROM expected_rls_p1 e
 LEFT JOIN pg_policies p
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
 IF (SELECT count(*) FROM expected_rls_p1) <> 25
    OR (SELECT count(*) FROM expected_rls_p1 WHERE roles='{service_role}' AND cmd='ALL') <> 21
    OR (SELECT count(*) FROM expected_rls_p1 WHERE roles='{authenticated}' AND cmd='SELECT') <> 4 THEN
   RAISE EXCEPTION 'P1 expected exactly 21 role-bound and four user-owned policies; abort';
 END IF;

 -- Both permissive subscription SELECT policies must be identical in role,
 -- command, predicate and WITH CHECK to prove removing a copy does not
 -- change the effective OR-joined access decision.
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

-- The only policy DDL in this disposable transaction (the temp table is
-- diagnostic only). All 25 guarded policies stay byte-for-byte unchanged.
-- No grant, ownership or persistent customer-row modification occurs.
DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $postflight$
DECLARE bad int;
BEGIN
 SELECT count(*) INTO bad FROM expected_rls_p1 e
 LEFT JOIN pg_policies p
  ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR p.qual IS DISTINCT FROM e.qualifier
    OR p.with_check IS DISTINCT FROM e.check_expr;
 IF bad <> 0 THEN
   RAISE EXCEPTION 'P1 postflight changed % unrelated policy definitions; abort',bad;
 END IF;
 IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='subscriptions'
         AND policyname='Users can view own subscriptions'
         AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
         AND cmd='SELECT' AND qual='(( SELECT auth.uid() AS uid) = user_id)'
         AND with_check IS NULL)<>1
 OR (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='subscriptions'
         AND policyname='Users can view their own subscription')<>0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;

SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

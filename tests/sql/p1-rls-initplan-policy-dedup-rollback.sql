-- Staging-only P1 draft. This is NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- Generate a forward migration through Supabase CLI only after live/fixture
-- schema comparison, role-denial regression, approval and exact-head CI.
-- Changes: 25 non-row-dependent scalar auth InitPlans; one *exactly*
-- duplicate subscriptions SELECT policy. No role, grant or row modifications.
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

-- Two exact, security-reviewed policy baselines: legacy scalar-auth policies
-- or the already-hardened role-scoped and auth-InitPlan forms.
CREATE TEMP TABLE expected_rls_p1_hardened ON COMMIT DROP AS
SELECT tbl,policy_name,permissive,cmd,
 CASE WHEN roles='{authenticated}' THEN roles ELSE '{service_role}' END AS roles,
 CASE WHEN roles='{authenticated}' THEN '(( SELECT auth.uid() AS uid) = user_id)' ELSE 'true' END AS qualifier,
 CASE WHEN roles='{authenticated}' THEN NULL::text ELSE 'true' END AS check_expr
FROM expected_rls_p1;

DO $drift$
DECLARE old_bad int; hard_bad int; details text;
BEGIN
 IF (SELECT count(*) FROM expected_rls_p1)<>25
 OR (SELECT count(*) FROM expected_rls_p1_hardened)<>25
 THEN RAISE EXCEPTION 'P1 expected exactly 25 policies; abort'; END IF;

 SELECT count(*) INTO old_bad FROM expected_rls_p1 e
 LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL OR p.permissive IS DISTINCT FROM e.permissive
 OR p.roles::text IS DISTINCT FROM e.roles OR p.cmd IS DISTINCT FROM e.cmd
 OR p.qual IS DISTINCT FROM e.qualifier OR p.with_check IS DISTINCT FROM e.check_expr;

 SELECT count(*) INTO hard_bad FROM expected_rls_p1_hardened e
 LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL OR p.permissive IS DISTINCT FROM e.permissive
 OR p.roles::text IS DISTINCT FROM e.roles OR p.cmd IS DISTINCT FROM e.cmd
 OR p.qual IS DISTINCT FROM e.qualifier OR p.with_check IS DISTINCT FROM e.check_expr;

 IF old_bad<>0 AND hard_bad<>0 THEN
   SELECT string_agg(format('%s.%s missing=%s roles=%s cmd=%s using=%s check=%s',
     e.tbl,e.policy_name,p.policyname IS NULL,p.roles::text IS DISTINCT FROM e.roles,
     p.cmd IS DISTINCT FROM e.cmd,p.qual IS DISTINCT FROM e.qualifier,
     p.with_check IS DISTINCT FROM e.check_expr),'; ')
   INTO details FROM
    (SELECT * FROM expected_rls_p1_hardened ORDER BY tbl,policy_name LIMIT 8) e
   LEFT JOIN pg_policies p ON p.schemaname='public'
     AND p.tablename=e.tbl AND p.policyname=e.policy_name;
   RAISE EXCEPTION 'P1 policy definition drift: legacy % mismatches, hardened % mismatches; abort',
     old_bad, hard_bad USING DETAIL=COALESCE(details,'No mismatch details');
 END IF;

 IF (SELECT count(*) FROM pg_policies
 WHERE schemaname='public' AND tablename='subscriptions'
 AND policyname IN ('Users can view own subscriptions','Users can view their own subscription')
 AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
 AND cmd='SELECT' AND qual='(( SELECT auth.uid() AS uid) = user_id)'
 AND with_check IS NULL)<>2
 THEN RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort'; END IF;
 RAISE NOTICE 'P1 rollback baseline: %',
   CASE WHEN old_bad=0 THEN 'legacy rewrite' ELSE 'already hardened' END;
END
$drift$;

-- Never rewrite service_role-scoped hardened policies into legacy predicates.
-- psql IF covers all 25 legacy ALTER statements (otherwise none execute).
SELECT CASE WHEN count(*)=25 THEN 'true' ELSE 'false' END AS apply_legacy_p1
FROM expected_rls_p1 e JOIN pg_policies p
ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
WHERE p.permissive=e.permissive AND p.roles::text=e.roles AND p.cmd=e.cmd
AND p.qual IS NOT DISTINCT FROM e.qualifier
AND p.with_check IS NOT DISTINCT FROM e.check_expr
\gset
\if :apply_legacy_p1
ALTER POLICY "service role manages agent_pending_actions" ON public."agent_pending_actions"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages agent_schedules" ON public."agent_schedules"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "business_employee_profiles_select_own" ON public."business_employee_profiles"
  USING (((select auth.uid()) = user_id));
ALTER POLICY "service role can manage business_sub_app_records" ON public."business_sub_app_records"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages business_work_order_assignments" ON public."business_work_order_assignments"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages business_work_order_events" ON public."business_work_order_events"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages business_work_order_evidence" ON public."business_work_order_evidence"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages business_work_order_materials" ON public."business_work_order_materials"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages business_work_orders" ON public."business_work_orders"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage creator_follows" ON public."creator_follows"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage customer_invoice_lines" ON public."customer_invoice_lines"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage customer_invoice_payments" ON public."customer_invoice_payments"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage customer_invoices" ON public."customer_invoices"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_artifacts" ON public."generation_artifacts"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_attempts" ON public."generation_attempts"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_audit_events" ON public."generation_audit_events"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_callback_events" ON public."generation_callback_events"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_cost_events" ON public."generation_cost_events"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role manages generation_jobs" ON public."generation_jobs"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage merchant_product_variants" ON public."merchant_product_variants"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage merchant_products" ON public."merchant_products"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "service role can manage shared_links" ON public."shared_links"
  USING (((select auth.role()) = 'service_role'::text))
  WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "sonara_platforms_select_own" ON public."sonara_platforms"
  USING (((select auth.uid()) = user_id));
ALTER POLICY "user_notifications_select_own" ON public."user_notifications"
  USING (((select auth.uid()) = user_id));
ALTER POLICY "user_preferences_select_own" ON public."user_preferences"
  USING (((select auth.uid()) = user_id));

\endif

DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $postflight$
DECLARE old_bad int; hard_bad int;
BEGIN
 SELECT count(*) INTO hard_bad FROM expected_rls_p1_hardened e
 LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL OR p.permissive IS DISTINCT FROM e.permissive
 OR p.roles::text IS DISTINCT FROM e.roles OR p.cmd IS DISTINCT FROM e.cmd
 OR p.qual IS DISTINCT FROM e.qualifier OR p.with_check IS DISTINCT FROM e.check_expr;

 SELECT count(*) INTO old_bad FROM expected_rls_p1 e
 LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL OR p.permissive IS DISTINCT FROM e.permissive
 OR p.roles::text IS DISTINCT FROM e.roles OR p.cmd IS DISTINCT FROM e.cmd
 OR (e.qualifier IS NOT NULL AND p.qual !~* 'SELECT[[:space:]]+auth[.](uid|role)[(][)]')
 OR (e.check_expr IS NOT NULL AND p.with_check !~* 'SELECT[[:space:]]+auth[.](uid|role)[(][)]');
 IF hard_bad<>0 AND old_bad<>0 THEN
   RAISE EXCEPTION 'P1 postflight failed: hardened % mismatches, rewritten legacy % mismatches',
     hard_bad,old_bad;
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
 AND tablename='subscriptions' AND policyname='Users can view own subscriptions'
 AND roles=ARRAY['authenticated']::name[] AND cmd='SELECT'
 AND qual='(( SELECT auth.uid() AS uid) = user_id)')<>1
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
 AND tablename='subscriptions' AND policyname='Users can view their own subscription')<>0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

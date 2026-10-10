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
    OR (e.qualifier IS NOT NULL AND p.qual !~* 'SELECT[[:space:]]+auth[.](uid|role)[(][)]')
    OR (e.check_expr IS NOT NULL AND p.with_check !~* 'SELECT[[:space:]]+auth[.](uid|role)[(][)]');
 IF bad <> 0 THEN
   RAISE EXCEPTION 'P1 postflight failed % policies',bad;
 END IF;
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view own subscriptions'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual='(( SELECT auth.uid() AS uid) = user_id)')<>1
 OR (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname='Users can view their own subscription')<>0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

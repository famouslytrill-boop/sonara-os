-- Disposable PostgreSQL regression probe, not a production migration.
-- A forward migration dated 20261008100000 already hardens pure service-role
-- RLS and four scalar auth.uid ownership policies. The old P1 dry-run fixture
-- expected their PRE-MIGRATION definitions and failed on all 25 policies.
--
-- Assert the real post-migration policy definitions, roles and predicates.
-- Preserve the subscription deduplication dry-run, inside ROLLBACK.
-- Never broadens roles, does not edit any live data or persisted schema.
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


-- Expected values originate from the prior guarded draft. Normalize only
-- transformations actually performed by the 20261008100000 migration.
UPDATE expected_rls_p1
  SET roles = '{service_role}', qualifier='true', check_expr='true'
  WHERE qualifier = '(auth.role() = ''service_role''::text)'
    AND check_expr = '(auth.role() = ''service_role''::text)'
    AND cmd='ALL';
UPDATE expected_rls_p1
  SET qualifier='(( SELECT auth.uid() AS uid) = user_id)'
  WHERE qualifier='(auth.uid() = user_id)' AND cmd='SELECT';

DO $post_migration$
DECLARE
 bad integer;
 difference record;
BEGIN
 IF (SELECT count(*) FROM expected_rls_p1) <> 25
    OR (SELECT count(*) FROM expected_rls_p1
        WHERE roles='{service_role}' AND qualifier='true' AND check_expr='true') <> 21
    OR (SELECT count(*) FROM expected_rls_p1
        WHERE roles='{authenticated}' AND qualifier LIKE '%SELECT auth.uid()%') <> 4
 THEN RAISE EXCEPTION 'P1 fixture itself has drifted or become vacuous'; END IF;

 SELECT count(*) INTO bad
 FROM expected_rls_p1 e LEFT JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR regexp_replace(coalesce(lower(p.qual),'[null]'), '[[:space:]()]', '', 'g')
       IS DISTINCT FROM regexp_replace(coalesce(lower(e.qualifier),'[null]'), '[[:space:]()]', '', 'g')
    OR regexp_replace(coalesce(lower(p.with_check),'[null]'), '[[:space:]()]', '', 'g')
       IS DISTINCT FROM regexp_replace(coalesce(lower(e.check_expr),'[null]'), '[[:space:]()]', '', 'g');
 IF bad <> 0 THEN
   FOR difference IN
     SELECT e.tbl, e.policy_name, e.roles AS wanted_roles, p.roles::text AS actual_roles,
            e.qualifier AS wanted_qual, p.qual AS actual_qual,
            e.check_expr AS wanted_check, p.with_check AS actual_check
     FROM expected_rls_p1 e LEFT JOIN pg_policies p
       ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
     WHERE p.policyname IS NULL
        OR p.permissive IS DISTINCT FROM e.permissive
        OR p.roles::text IS DISTINCT FROM e.roles
        OR p.cmd IS DISTINCT FROM e.cmd
        OR regexp_replace(coalesce(lower(p.qual),'[null]'), '[[:space:]()]', '', 'g')
           IS DISTINCT FROM regexp_replace(coalesce(lower(e.qualifier),'[null]'), '[[:space:]()]', '', 'g')
        OR regexp_replace(coalesce(lower(p.with_check),'[null]'), '[[:space:]()]', '', 'g')
           IS DISTINCT FROM regexp_replace(coalesce(lower(e.check_expr),'[null]'), '[[:space:]()]', '', 'g')
     ORDER BY e.tbl LIMIT 5
   LOOP
     RAISE NOTICE 'P1 policy %.% roles [% -> %] qual [% -> %] check [% -> %]',
       difference.tbl, difference.policy_name,
       difference.wanted_roles, difference.actual_roles,
       difference.wanted_qual, difference.actual_qual,
       difference.wanted_check, difference.actual_check;
   END LOOP;
   RAISE EXCEPTION 'P1 hardened policy contract drift on % definitions; abort', bad;
 END IF;

 -- Subscriptions can already be deduplicated by the applied migration
 -- history. Verify that exactly one or two select policies remain, each
 -- restricted to the authenticated user's own user_id, before any dry-run
 -- cleanup. Never drop a non-equivalent or more restrictive policy.
 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')) NOT BETWEEN 1 AND 2
 THEN RAISE EXCEPTION 'subscriptions policy missing or unexpected count'; END IF;

 IF EXISTS (
   SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')
       AND (permissive IS DISTINCT FROM 'PERMISSIVE'
         OR roles IS DISTINCT FROM ARRAY['authenticated']::name[]
         OR cmd IS DISTINCT FROM 'SELECT'
         OR with_check IS NOT NULL
         OR regexp_replace(lower(coalesce(qual,'')), '[[:space:]()]', '', 'g')
           NOT IN ('selectauth.uidasuid=user_id','auth.uid=user_id'))
 ) THEN RAISE EXCEPTION 'subscriptions owner-only policy semantics drifted; abort'; END IF;

 -- If the previous migration already removed the duplicate, no destructive
 -- step should be attempted. If both exist, each passed the strict predicate.

END;
$post_migration$;

DO $dedup$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename='subscriptions' AND policyname IN
        ('Users can view own subscriptions', 'Users can view their own subscription')) = 2
  THEN
    EXECUTE 'DROP POLICY "Users can view their own subscription" ON public.subscriptions';
  END IF;
END;
$dedup$;

DO $postflight$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND tablename='subscriptions' AND policyname IN
       ('Users can view own subscriptions', 'Users can view their own subscription')) <> 1
 THEN RAISE EXCEPTION 'subscriptions dry-run did not finish with exactly one policy'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='subscriptions'
       AND policyname IN ('Users can view own subscriptions',
                          'Users can view their own subscription')
       AND (permissive IS DISTINCT FROM 'PERMISSIVE'
            OR roles IS DISTINCT FROM ARRAY['authenticated']::name[]
            OR cmd IS DISTINCT FROM 'SELECT'
            OR with_check IS NOT NULL
            OR regexp_replace(lower(coalesce(qual,'')), '[[:space:]()]', '', 'g')
                NOT IN ('selectauth.uidasuid=user_id','auth.uid=user_id')))
 THEN RAISE EXCEPTION 'subscriptions dry-run broadened authorization'; END IF;
 IF (SELECT count(*) FROM expected_rls_p1) <> 25
 THEN RAISE EXCEPTION 'P1 policy verification did not cover 25 policies'; END IF;
END;
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

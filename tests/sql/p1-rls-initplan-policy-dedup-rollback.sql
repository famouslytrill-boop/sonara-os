-- Staging-only RLS hardening verification. This is NOT a Supabase migration.
-- Script intentionally ends with ROLLBACK and is invoked by native replay.
-- The 20261008100000 migration already hardened these 25 policies; replay
-- must validate their POST-migration state rather than require pre-migration
-- predicates and falsely report drift on every policy.
-- Assert the exact roles/commands/predicates for 25 policies and, in a
-- rolled-back transaction, verify one strictly identical duplicate
-- subscriptions SELECT policy could be dropped. No production DDL occurs.
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

 -- These two permissive policies must be identical in every security
 -- dimension before one can safely be dropped. Do not require a guessed role
 -- label here: CREATE POLICY defaults TO PUBLIC when TO is omitted, while
 -- pg_policy.polroles records the actual role OIDs. The dedup invariant is
 -- exact equivalence, not a particular role spelling.
 --
 -- pg_policies.qual is deparsed display text and may vary in harmless
 -- formatting across PostgreSQL versions. Compare PostgreSQL's catalog policy
 -- trees instead: same SELECT command, role set, permissive mode, USING AST
 -- and WITH CHECK AST.
 IF (SELECT count(*) FROM pg_policy p
     JOIN pg_class c ON c.oid=p.polrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='subscriptions'
       AND p.polname IN ('Users can view own subscriptions',
                         'Users can view their own subscription')
       AND p.polcmd='r'
       AND p.polpermissive=true
       AND p.polqual IS NOT NULL
       AND p.polwithcheck IS NULL) <> 2 THEN
   RAISE EXCEPTION 'subscriptions duplicate policy command/permissive definitions drifted; abort';
 END IF;

 IF (SELECT count(*)
     FROM pg_policy left_policy
     JOIN pg_class c ON c.oid=left_policy.polrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     JOIN pg_policy right_policy
       ON right_policy.polrelid=left_policy.polrelid
      AND right_policy.polname='Users can view their own subscription'
     WHERE n.nspname='public'
       AND c.relname='subscriptions'
       AND left_policy.polname='Users can view own subscriptions'
       AND left_policy.polcmd=right_policy.polcmd
       AND left_policy.polroles=right_policy.polroles
       AND left_policy.polpermissive=right_policy.polpermissive
       AND left_policy.polqual::text IS NOT DISTINCT FROM right_policy.polqual::text
       AND left_policy.polwithcheck::text IS NOT DISTINCT FROM right_policy.polwithcheck::text
   ) <> 1 THEN
   RAISE EXCEPTION 'subscriptions policies are not exact catalog-AST duplicates; abort';
 END IF;
END
$drift$;

-- Service-only and ownership policies are already hardened by the immutable
-- 20261008100000 migration. Changing them again here would regress that work.
-- Exercise only the still-unapplied subscriptions dedup in this rollback test.

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
 IF (SELECT count(*) FROM pg_policy p
     JOIN pg_class c ON c.oid=p.polrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='subscriptions'
       AND p.polname='Users can view own subscriptions'
       AND p.polcmd='r'
       AND p.polpermissive=true
       AND p.polqual IS NOT NULL
       AND p.polwithcheck IS NULL)<>1
 OR (SELECT count(*) FROM pg_policy p
     JOIN pg_class c ON c.oid=p.polrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='subscriptions'
       AND p.polname='Users can view their own subscription')<>0
 THEN RAISE EXCEPTION 'P1 subscription dedup failed'; END IF;
END
$postflight$;
SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

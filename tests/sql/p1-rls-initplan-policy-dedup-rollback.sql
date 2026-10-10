-- Transactional native replay proof for policies AFTER migration 20261008100000.
-- This fixture is NOT a migration and never updates a customer database.
-- Previous version assumed 25 pre-hardening auth.role()/uid() predicates,
-- even though the applied migration replaced 21 pure service_role predicates
-- with a role-scoped TRUE check and optimized four ownership checks. That
-- fixture correctly aborted when it detected drift but no longer matched the
-- current schema. Preserve the failure-on-drift rule against CURRENT policies.
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
    ('business_employee_profiles', 'business_employee_profiles_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', 'ownership_uid', NULL),
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
    ('sonara_platforms', 'sonara_platforms_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', 'ownership_uid', NULL),
    ('user_notifications', 'user_notifications_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', 'ownership_uid', NULL),
    ('user_preferences', 'user_preferences_select_own', 'PERMISSIVE', '{authenticated}', 'SELECT', 'ownership_uid', NULL);


DO $preflight$
DECLARE bad int; broad int; legacy int;
BEGIN
 IF (SELECT count(*) FROM expected_rls_p1) <> 25
   OR (SELECT count(*) FROM expected_rls_p1 WHERE qualifier='true') <> 21
   OR (SELECT count(*) FROM expected_rls_p1 WHERE qualifier='ownership_uid') <> 4
 THEN
   RAISE EXCEPTION 'P1 expected 21 role-scoped and four ownership policies; abort';
 END IF;

 SELECT count(*) INTO bad
 FROM expected_rls_p1 e LEFT JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE p.policyname IS NULL
    OR p.permissive IS DISTINCT FROM e.permissive
    OR p.roles::text IS DISTINCT FROM e.roles
    OR p.cmd IS DISTINCT FROM e.cmd
    OR (e.qualifier='true' AND
        (p.qual IS DISTINCT FROM 'true' OR p.with_check IS DISTINCT FROM 'true'))
    OR (e.qualifier='ownership_uid' AND
        (p.with_check IS NOT NULL
         OR regexp_replace(lower(coalesce(p.qual,'')), '[[:space:]()]', '', 'g')
            NOT IN ('selectauth.uidasuid=user_id', 'selectauth.uid=user_id')))
    OR (e.qualifier NOT IN ('true', 'ownership_uid'))
    OR (e.check_expr='true' AND p.with_check IS DISTINCT FROM 'true');
 IF bad <> 0 THEN
   RAISE EXCEPTION 'P1 post-hardening policy definition drift on % policies; abort', bad;
 END IF;

 -- In particular, no service-only policy may retain a PUBLIC/anon/
 -- authenticated applicability. TRUE is safe only when scoped to service_role.
 SELECT count(*) INTO broad FROM expected_rls_p1 e
 JOIN pg_policies p
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE e.qualifier='true' AND (p.roles <> ARRAY['service_role']::name[]
                               OR p.qual <> 'true' OR p.with_check <> 'true');
 IF broad <> 0 THEN
   RAISE EXCEPTION 'P1 service-only privilege scope widened on % policies; abort', broad;
 END IF;

 SELECT count(*) INTO legacy FROM pg_policies p JOIN expected_rls_p1 e
   ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
 WHERE e.qualifier='true' AND (p.qual ILIKE '%auth.role%' OR p.with_check ILIKE '%auth.role%');
 IF legacy <> 0 THEN
   RAISE EXCEPTION 'P1 legacy per-row role lookup survived on % policies; abort', legacy;
 END IF;

END
$preflight$;

-- The *fresh migration history* creates no such pair on public.subscriptions.
-- The connected preview database does have a pair, but those definitions must
-- not be silently injected into a replay or mistaken for tracked migrations.
-- This assertion will fail if the source history changes, forcing review.
DO $history$
BEGIN
 IF EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='public'
     AND tablename='subscriptions'
     AND policyname IN ('Users can view own subscriptions',
                        'Users can view their own subscription')
 ) THEN
   RAISE EXCEPTION 'subscription history now includes a named policy; re-review synthetic fixture';
 END IF;
END
$history$;

-- Create an isolated RLS table entirely inside a transaction that rolls back.
-- This demonstrates that an EXACTLY duplicate owner-read policy can be removed
-- without widening access, but DOES NOT prove the preview schema matches Git.
CREATE TABLE public.sonara_p1_subscription_policy_fixture (
  id integer PRIMARY KEY, user_id uuid NOT NULL
);
ALTER TABLE public.sonara_p1_subscription_policy_fixture ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sonara_p1_subscription_policy_fixture TO authenticated, anon;
INSERT INTO public.sonara_p1_subscription_policy_fixture (id,user_id) VALUES
  (1, '11111111-1111-4111-8111-111111111111'),
  (2, '22222222-2222-4222-8222-222222222222');

CREATE POLICY "Users can view own subscriptions"
 ON public.sonara_p1_subscription_policy_fixture FOR SELECT
 TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view their own subscription"
 ON public.sonara_p1_subscription_policy_fixture FOR SELECT
 TO authenticated USING ((SELECT auth.uid()) = user_id);

DO $identical$
DECLARE count_matching int;
BEGIN
 SELECT count(*) INTO count_matching
 FROM pg_policies WHERE
   schemaname='public'
   AND tablename='sonara_p1_subscription_policy_fixture'
   AND policyname IN ('Users can view own subscriptions',
                      'Users can view their own subscription')
   AND permissive='PERMISSIVE'
   AND roles=ARRAY['authenticated']::name[]
   AND cmd='SELECT'
   AND qual='(( SELECT auth.uid() AS uid) = user_id)'
   AND with_check IS NULL;
 IF count_matching<>2 THEN
   RAISE EXCEPTION 'synthetic RLS policies not identical; abort';
 END IF;
END
$identical$;

-- A sees only A, B sees only B, and anon sees no rows; the checks run as
-- the actual roles, rather than as the bypass-RLS migration superuser.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $user_a$
DECLARE seen text;
BEGIN
 SELECT string_agg(id::text, ',') INTO seen
 FROM public.sonara_p1_subscription_policy_fixture;
 IF seen IS DISTINCT FROM '1' THEN
   RAISE EXCEPTION 'owner A read isolation failed: %', seen;
 END IF;
END
$user_a$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $user_b$
DECLARE seen text;
BEGIN
 SELECT string_agg(id::text, ',') INTO seen
 FROM public.sonara_p1_subscription_policy_fixture;
 IF seen IS DISTINCT FROM '2' THEN
   RAISE EXCEPTION 'owner B read isolation failed: %', seen;
 END IF;
END
$user_b$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $anonymous$
DECLARE seen int;
BEGIN
 SELECT count(*) INTO seen FROM public.sonara_p1_subscription_policy_fixture;
 IF seen <> 0 THEN
   RAISE EXCEPTION 'anonymous subscription read was visible: %', seen;
 END IF;
END
$anonymous$;
RESET ROLE;

DROP POLICY "Users can view their own subscription"
 ON public.sonara_p1_subscription_policy_fixture;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $after_dedup$
DECLARE seen text;
BEGIN
 SELECT string_agg(id::text, ',') INTO seen
 FROM public.sonara_p1_subscription_policy_fixture;
 IF seen IS DISTINCT FROM '1' THEN
   RAISE EXCEPTION 'deduplicated policy changed owner A visibility: %', seen;
 END IF;
END
$after_dedup$;
RESET ROLE;

ROLLBACK;

-- The fixture and its two policies must be gone after rollback.
DO $rollback_verification$
BEGIN
 IF to_regclass('public.sonara_p1_subscription_policy_fixture') IS NOT NULL
 OR EXISTS (
   SELECT 1 FROM pg_policies WHERE schemaname='public'
     AND tablename='sonara_p1_subscription_policy_fixture'
 ) THEN
   RAISE EXCEPTION 'P1 synthetic policy fixture survived rollback';
 END IF;
END
$rollback_verification$;
SELECT 'p1_rls_hygiene_staging_passed';

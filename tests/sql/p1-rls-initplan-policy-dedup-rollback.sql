-- Post-migration P1 RLS drift and rolled-back dedup proof.
-- 20261008100000_tighten_service_role_rls_policies.sql superseded the older
-- draft that expected pure service-role auth.role() predicates and TO public.
-- That historic preflight failed on ALL 25 policies after the hardening
-- migration legitimately changed roles/predicates. Reusing it would never
-- exercise this branch's Stripe migration replay.
--
-- This is a strict attestation of the hardened POST-migration state, not a
-- bypass. An unexpected policy, role, command or predicate fails closed.
-- It exercises the exact duplicate subscription SELECT policy removal inside
-- a transaction that always ROLLBACKs; neither production nor replay retains
-- any modification made by this test.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE TEMP TABLE expected_rls_p1 (
  tbl text NOT NULL, policy_name text NOT NULL,
  cmd text NOT NULL, expected_role text NOT NULL
) ON COMMIT DROP;
INSERT INTO expected_rls_p1 VALUES
  ('agent_pending_actions','service role manages agent_pending_actions','ALL','service_role'),
  ('agent_schedules','service role manages agent_schedules','ALL','service_role'),
  ('business_employee_profiles','business_employee_profiles_select_own','SELECT','authenticated'),
  ('business_sub_app_records','service role can manage business_sub_app_records','ALL','service_role'),
  ('business_work_order_assignments','service role manages business_work_order_assignments','ALL','service_role'),
  ('business_work_order_events','service role manages business_work_order_events','ALL','service_role'),
  ('business_work_order_evidence','service role manages business_work_order_evidence','ALL','service_role'),
  ('business_work_order_materials','service role manages business_work_order_materials','ALL','service_role'),
  ('business_work_orders','service role manages business_work_orders','ALL','service_role'),
  ('creator_follows','service role can manage creator_follows','ALL','service_role'),
  ('customer_invoice_lines','service role can manage customer_invoice_lines','ALL','service_role'),
  ('customer_invoice_payments','service role can manage customer_invoice_payments','ALL','service_role'),
  ('customer_invoices','service role can manage customer_invoices','ALL','service_role'),
  ('generation_artifacts','service role manages generation_artifacts','ALL','service_role'),
  ('generation_attempts','service role manages generation_attempts','ALL','service_role'),
  ('generation_audit_events','service role manages generation_audit_events','ALL','service_role'),
  ('generation_callback_events','service role manages generation_callback_events','ALL','service_role'),
  ('generation_cost_events','service role manages generation_cost_events','ALL','service_role'),
  ('generation_jobs','service role manages generation_jobs','ALL','service_role'),
  ('merchant_product_variants','service role can manage merchant_product_variants','ALL','service_role'),
  ('merchant_products','service role can manage merchant_products','ALL','service_role'),
  ('shared_links','service role can manage shared_links','ALL','service_role'),
  ('sonara_platforms','sonara_platforms_select_own','SELECT','authenticated'),
  ('user_notifications','user_notifications_select_own','SELECT','authenticated'),
  ('user_preferences','user_preferences_select_own','SELECT','authenticated');

DO $drift$
DECLARE
  bad integer;
  entries text;
BEGIN
  SELECT count(*), string_agg(e.tbl || '.' || e.policy_name, ', ' ORDER BY e.tbl,e.policy_name)
  INTO bad, entries
  FROM expected_rls_p1 e
  LEFT JOIN pg_policies p
    ON p.schemaname='public' AND p.tablename=e.tbl AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
     OR p.roles::text IS DISTINCT FROM ('{' || e.expected_role || '}')
     OR p.cmd IS DISTINCT FROM e.cmd
     OR (e.expected_role='service_role'
         AND (p.qual IS DISTINCT FROM 'true' OR p.with_check IS DISTINCT FROM 'true'))
     OR (e.expected_role='authenticated'
         AND (p.qual IS NULL
              OR p.qual !~* 'SELECT[[:space:]]+auth[.]uid[(][)]'
              OR p.with_check IS NOT NULL));
  IF (SELECT count(*) FROM expected_rls_p1) <> 25
     OR (SELECT count(*) FROM expected_rls_p1 WHERE expected_role='service_role') <> 21
     OR (SELECT count(*) FROM expected_rls_p1 WHERE expected_role='authenticated') <> 4
     OR bad <> 0 THEN
    RAISE EXCEPTION 'P1 hardened RLS policy drift on % policies: %', bad, entries;
  END IF;

  -- Both redundant subscriptions SELECT policies must still be identical
  -- in *all* security dimensions before a dry-run DROP is permissible.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname IN ('Users can view own subscriptions',
                           'Users can view their own subscription')
        AND permissive='PERMISSIVE'
        AND roles=ARRAY['authenticated']::name[]
        AND cmd='SELECT'
        AND qual='(( SELECT auth.uid() AS uid) = user_id)'
        AND with_check IS NULL) <> 2 THEN
    RAISE EXCEPTION 'P1 subscriptions duplicate semantics drifted; abort';
  END IF;
END
$drift$;

DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $postflight$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename='subscriptions'
   AND policyname='Users can view own subscriptions'
   AND permissive='PERMISSIVE'
   AND roles=ARRAY['authenticated']::name[]
   AND cmd='SELECT'
   AND qual='(( SELECT auth.uid() AS uid) = user_id)'
   AND with_check IS NULL) <> 1
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename='subscriptions'
   AND policyname='Users can view their own subscription') <> 0 THEN
   RAISE EXCEPTION 'P1 subscription dedup postflight drift; abort';
 END IF;
END
$postflight$;

SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

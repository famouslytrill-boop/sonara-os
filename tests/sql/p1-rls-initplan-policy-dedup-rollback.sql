-- Post-migration P1 verification plus one staging-only deduplication proof.
--
-- 20261008100000_tighten_service_role_rls_policies.sql is now part of the
-- migration history. This file must therefore verify the state that migration
-- leaves behind; it must never expect the old auth.role()/auth.uid() policy
-- text and then "test" a change that has already shipped in the candidate.
--
-- The only DDL below is the still-unshipped removal of one rigorously identical
-- subscriptions SELECT policy. That change remains inside this disposable
-- transaction and ends with ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

CREATE TEMP TABLE expected_service_role_policies (
  tbl text NOT NULL,
  policy_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO expected_service_role_policies VALUES
  ('agent_pending_actions', 'service role manages agent_pending_actions'),
  ('agent_schedules', 'service role manages agent_schedules'),
  ('business_sub_app_records', 'service role can manage business_sub_app_records'),
  ('business_work_order_assignments', 'service role manages business_work_order_assignments'),
  ('business_work_order_events', 'service role manages business_work_order_events'),
  ('business_work_order_evidence', 'service role manages business_work_order_evidence'),
  ('business_work_order_materials', 'service role manages business_work_order_materials'),
  ('business_work_orders', 'service role manages business_work_orders'),
  ('creator_follows', 'service role can manage creator_follows'),
  ('customer_invoice_lines', 'service role can manage customer_invoice_lines'),
  ('customer_invoice_payments', 'service role can manage customer_invoice_payments'),
  ('customer_invoices', 'service role can manage customer_invoices'),
  ('generation_artifacts', 'service role manages generation_artifacts'),
  ('generation_attempts', 'service role manages generation_attempts'),
  ('generation_audit_events', 'service role manages generation_audit_events'),
  ('generation_callback_events', 'service role manages generation_callback_events'),
  ('generation_cost_events', 'service role manages generation_cost_events'),
  ('generation_jobs', 'service role manages generation_jobs'),
  ('merchant_product_variants', 'service role can manage merchant_product_variants'),
  ('merchant_products', 'service role can manage merchant_products'),
  ('shared_links', 'service role can manage shared_links');

CREATE TEMP TABLE expected_owner_initplans (
  tbl text NOT NULL,
  policy_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO expected_owner_initplans VALUES
  ('business_employee_profiles', 'business_employee_profiles_select_own'),
  ('sonara_platforms', 'sonara_platforms_select_own'),
  ('user_notifications', 'user_notifications_select_own'),
  ('user_preferences', 'user_preferences_select_own');

DO $post_migration_invariants$
DECLARE
  bad_service_role integer;
  bad_owner integer;
  remaining_pure_auth_role integer;
BEGIN
  -- These 21 policies were in the original advisor set. After the forward
  -- migration they must still exist, but only service_role can enter them and
  -- their now-redundant predicate is a constant true.
  SELECT count(*) INTO bad_service_role
  FROM expected_service_role_policies e
  LEFT JOIN pg_policies p
    ON p.schemaname='public'
   AND p.tablename=e.tbl
   AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
     OR p.roles::text IS DISTINCT FROM '{service_role}'
     OR p.cmd IS DISTINCT FROM 'ALL'
     OR regexp_replace(lower(coalesce(p.qual,'')), '[[:space:]()]', '', 'g') IS DISTINCT FROM 'true'
     OR regexp_replace(lower(coalesce(p.with_check,'')), '[[:space:]()]', '', 'g') IS DISTINCT FROM 'true';

  IF bad_service_role <> 0 THEN
    RAISE EXCEPTION 'post-migration service-role policy invariant failed on % policies', bad_service_role;
  END IF;

  -- The four user-owned SELECT policies keep the authenticated role and row
  -- comparison, but auth.uid() must be wrapped so PostgreSQL can use an InitPlan.
  SELECT count(*) INTO bad_owner
  FROM expected_owner_initplans e
  LEFT JOIN pg_policies p
    ON p.schemaname='public'
   AND p.tablename=e.tbl
   AND p.policyname=e.policy_name
  WHERE p.policyname IS NULL
     OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
     OR p.roles::text IS DISTINCT FROM '{authenticated}'
     OR p.cmd IS DISTINCT FROM 'SELECT'
     OR p.with_check IS NOT NULL
     OR p.qual !~* 'SELECT[[:space:]]+auth[.]uid[(][)]';

  IF bad_owner <> 0 THEN
    RAISE EXCEPTION 'post-migration owner InitPlan invariant failed on % policies', bad_owner;
  END IF;

  -- The forward migration intentionally generalizes beyond the original 21:
  -- after it runs, no pure service-role policy in public may still reevaluate
  -- auth.role() row by row.
  SELECT count(*) INTO remaining_pure_auth_role
  FROM (
    SELECT
      regexp_replace(lower(coalesce(qual, '')), '[[:space:]()]', '', 'g') AS nq,
      regexp_replace(lower(coalesce(with_check, '')), '[[:space:]()]', '', 'g') AS nc
    FROM pg_policies
    WHERE schemaname='public'
      AND array_length(roles, 1)=1
      AND roles[1]::text IN ('public','service_role')
  ) policies
  WHERE nq IN (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    )
     OR nc IN (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    );

  IF remaining_pure_auth_role <> 0 THEN
    RAISE EXCEPTION '% pure service-role policies still evaluate auth.role()', remaining_pure_auth_role;
  END IF;

  -- The one remaining policy-overlap proposal is allowed to proceed only when
  -- the two subscriptions policies are still identical in every security
  -- dimension relevant to this removal.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public'
        AND tablename='subscriptions'
        AND policyname IN (
          'Users can view own subscriptions',
          'Users can view their own subscription'
        )
        AND permissive='PERMISSIVE'
        AND roles=ARRAY['authenticated']::name[]
        AND cmd='SELECT'
        AND qual='(( SELECT auth.uid() AS uid) = user_id)'
        AND with_check IS NULL) <> 2 THEN
    RAISE EXCEPTION 'subscriptions duplicate policy definitions drifted; abort';
  END IF;
END
$post_migration_invariants$;

-- Still proposal-only. Prove the exact duplicate can be removed safely, then
-- roll the transaction back so native replay changes no candidate schema.
DROP POLICY "Users can view their own subscription" ON public.subscriptions;

DO $dedup_postflight$
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public'
        AND tablename='subscriptions'
        AND policyname='Users can view own subscriptions'
        AND roles=ARRAY['authenticated']::name[]
        AND cmd='SELECT'
        AND qual='(( SELECT auth.uid() AS uid) = user_id)') <> 1
     OR (SELECT count(*) FROM pg_policies
         WHERE schemaname='public'
           AND tablename='subscriptions'
           AND policyname='Users can view their own subscription') <> 0
  THEN
    RAISE EXCEPTION 'P1 subscription dedup failed';
  END IF;
END
$dedup_postflight$;

SELECT 'p1_rls_hygiene_staging_passed';
ROLLBACK;

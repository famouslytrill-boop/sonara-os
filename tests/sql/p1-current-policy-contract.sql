-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- Post-hardening, *read-only* policy attestation for native PG 16/17/18 replay.
-- The historic RLS rewriting dry-run is intentionally NOT re-applied against
-- already-restricted service_role policies. This checks the exact modern
-- command, role and policy expression. Failure must STOP release.
-- See tests/sql/p1-rls-initplan-policy-dedup-rollback.sql for the archived
-- old-policy rewrite experiment, which requires an older schema baseline.

DO $current_policy_contract$
DECLARE
  bad_count integer;
  expected_count integer;
  bad_names text;
  subscription_count integer;
  subscription_invalid integer;
  subscription_details text;
BEGIN
  WITH expected(table_name,policy_name,kind) AS (
    VALUES
    ('agent_pending_actions','service role manages agent_pending_actions','service'),
    ('agent_schedules','service role manages agent_schedules','service'),
    ('business_employee_profiles','business_employee_profiles_select_own','own'),
    ('business_sub_app_records','service role can manage business_sub_app_records','service'),
    ('business_work_order_assignments','service role manages business_work_order_assignments','service'),
    ('business_work_order_events','service role manages business_work_order_events','service'),
    ('business_work_order_evidence','service role manages business_work_order_evidence','service'),
    ('business_work_order_materials','service role manages business_work_order_materials','service'),
    ('business_work_orders','service role manages business_work_orders','service'),
    ('creator_follows','service role can manage creator_follows','service'),
    ('customer_invoice_lines','service role can manage customer_invoice_lines','service'),
    ('customer_invoice_payments','service role can manage customer_invoice_payments','service'),
    ('customer_invoices','service role can manage customer_invoices','service'),
    ('generation_artifacts','service role manages generation_artifacts','service'),
    ('generation_attempts','service role manages generation_attempts','service'),
    ('generation_audit_events','service role manages generation_audit_events','service'),
    ('generation_callback_events','service role manages generation_callback_events','service'),
    ('generation_cost_events','service role manages generation_cost_events','service'),
    ('generation_jobs','service role manages generation_jobs','service'),
    ('merchant_product_variants','service role can manage merchant_product_variants','service'),
    ('merchant_products','service role can manage merchant_products','service'),
    ('shared_links','service role can manage shared_links','service'),
    ('sonara_platforms','sonara_platforms_select_own','own'),
    ('user_notifications','user_notifications_select_own','own'),
    ('user_preferences','user_preferences_select_own','own')
  ),
  status AS (
    SELECT e.table_name,e.policy_name,p.policyname,
      CASE WHEN e.kind='service' THEN
        p.permissive='PERMISSIVE'
        AND p.roles=ARRAY['service_role']::name[]
        AND p.cmd='ALL'
        AND p.qual='true'
        AND p.with_check='true'
      ELSE
        p.permissive='PERMISSIVE'
        AND p.roles=ARRAY['authenticated']::name[]
        AND p.cmd='SELECT'
        AND p.qual='(( SELECT auth.uid() AS uid) = user_id)'
        AND p.with_check IS NULL
      END AS safe
    FROM expected e LEFT JOIN pg_policies p
      ON p.schemaname='public'
      AND p.tablename=e.table_name
      AND p.policyname=e.policy_name
  )
  SELECT count(*),count(*) FILTER (WHERE safe IS DISTINCT FROM true),
    string_agg(table_name||':'||policy_name,', ' ORDER BY table_name,policy_name)
      FILTER (WHERE safe IS DISTINCT FROM true)
    INTO expected_count,bad_count,bad_names
    FROM status;
  IF expected_count <> 25 THEN
    RAISE EXCEPTION 'P1 baseline expected exactly 25 policies, found %',expected_count;
  END IF;
  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'P1 current policy contract drift on % policies: %',
      bad_count,bad_names;
  END IF;
  -- Synthetic replay may contain one of the two historical duplicate
  -- subscriptions SELECT policies; the connected schema has both.
  -- Requiring an obsolete duplicate blocked all nine native test lanes.
  -- Preserve a *strict* entitlement condition: at least one, at most two,
  -- authenticated SELECT with an exact user_id ownership predicate.
  SELECT count(*), count(*) FILTER (WHERE NOT (
       permissive='PERMISSIVE'
       AND roles=ARRAY['authenticated']::name[]
       AND cmd='SELECT'
       AND qual IN (
         '(( SELECT auth.uid() AS uid) = user_id)',
         '(auth.uid() = user_id)',
         '(user_id = auth.uid())',
         '(user_id = ( SELECT auth.uid() AS uid))'
       )
       AND with_check IS NULL
     )),
     string_agg(policyname || ':' || coalesce(qual,'<null>'), '; ' ORDER BY policyname)
  INTO subscription_count,subscription_invalid,subscription_details
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='subscriptions'
    AND policyname IN ('Users can view own subscriptions',
                       'Users can view their own subscription');

  IF subscription_count NOT BETWEEN 1 AND 2 OR subscription_invalid <> 0 THEN
    RAISE EXCEPTION 'P1 subscription policy baseline drift: % present, % invalid: %',
      subscription_count,subscription_invalid,subscription_details;
  END IF;
END;
$current_policy_contract$;

SELECT 'p1_current_policy_contract_passed';

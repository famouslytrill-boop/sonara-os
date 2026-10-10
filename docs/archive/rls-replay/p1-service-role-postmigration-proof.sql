-- Disposable native-replay postcondition for the applied 20261008100000 migration.
-- Earlier replay executes the historical P1 experiment immediately BEFORE
-- the migration, verifies 25 guarded definitions, creates the inherited
-- subscription pair ONLY when absent and tests deduplication. It rolls back.
-- This probe runs AFTER all migrations, requires the hardened role-scoped
-- equivalents (not the old auth.role() predicates), and also rolls back.
-- NEVER execute this script on customer/production databases.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE expected_service_hardening (
  table_name text NOT NULL,
  policy_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('service_role', 'owner')),
  command text NOT NULL,
  PRIMARY KEY (table_name, policy_name)
) ON COMMIT DROP;

INSERT INTO expected_service_hardening (table_name, policy_name, kind, command) VALUES
  ('agent_pending_actions', 'service role manages agent_pending_actions', 'service_role', 'ALL'),
  ('agent_schedules', 'service role manages agent_schedules', 'service_role', 'ALL'),
  ('business_employee_profiles', 'business_employee_profiles_select_own', 'owner', 'SELECT'),
  ('business_sub_app_records', 'service role can manage business_sub_app_records', 'service_role', 'ALL'),
  ('business_work_order_assignments', 'service role manages business_work_order_assignments', 'service_role', 'ALL'),
  ('business_work_order_events', 'service role manages business_work_order_events', 'service_role', 'ALL'),
  ('business_work_order_evidence', 'service role manages business_work_order_evidence', 'service_role', 'ALL'),
  ('business_work_order_materials', 'service role manages business_work_order_materials', 'service_role', 'ALL'),
  ('business_work_orders', 'service role manages business_work_orders', 'service_role', 'ALL'),
  ('creator_follows', 'service role can manage creator_follows', 'service_role', 'ALL'),
  ('customer_invoice_lines', 'service role can manage customer_invoice_lines', 'service_role', 'ALL'),
  ('customer_invoice_payments', 'service role can manage customer_invoice_payments', 'service_role', 'ALL'),
  ('customer_invoices', 'service role can manage customer_invoices', 'service_role', 'ALL'),
  ('generation_artifacts', 'service role manages generation_artifacts', 'service_role', 'ALL'),
  ('generation_attempts', 'service role manages generation_attempts', 'service_role', 'ALL'),
  ('generation_audit_events', 'service role manages generation_audit_events', 'service_role', 'ALL'),
  ('generation_callback_events', 'service role manages generation_callback_events', 'service_role', 'ALL'),
  ('generation_cost_events', 'service role manages generation_cost_events', 'service_role', 'ALL'),
  ('generation_jobs', 'service role manages generation_jobs', 'service_role', 'ALL'),
  ('merchant_product_variants', 'service role can manage merchant_product_variants', 'service_role', 'ALL'),
  ('merchant_products', 'service role can manage merchant_products', 'service_role', 'ALL'),
  ('shared_links', 'service role can manage shared_links', 'service_role', 'ALL'),
  ('sonara_platforms', 'sonara_platforms_select_own', 'owner', 'SELECT'),
  ('user_notifications', 'user_notifications_select_own', 'owner', 'SELECT'),
  ('user_preferences', 'user_preferences_select_own', 'owner', 'SELECT');

DO $verify_postmigration$
DECLARE
  missing_count integer;
  unmatched text;
  service_count integer;
  owner_count integer;
BEGIN
  SELECT COUNT(*) FILTER (WHERE kind='service_role'),
         COUNT(*) FILTER (WHERE kind='owner')
    INTO service_count, owner_count FROM expected_service_hardening;
  IF service_count <> 21 OR owner_count <> 4 THEN
    RAISE EXCEPTION 'P1 expected 21 service role and 4 owner policies; got %/%',
      service_count, owner_count;
  END IF;

  WITH comparisons AS (
    SELECT e.table_name, e.policy_name, e.kind, e.command,
           p.policyname, p.permissive, p.roles::text AS roles,
           p.cmd, p.qual, p.with_check,
           regexp_replace(lower(coalesce(p.qual, '')), '[[:space:]()]', '', 'g') AS normalized_qual
    FROM expected_service_hardening e
    LEFT JOIN pg_policies p ON p.schemaname = 'public'
      AND p.tablename = e.table_name AND p.policyname = e.policy_name
  ),
  drift AS (
    SELECT *
    FROM comparisons
    WHERE policyname IS NULL OR permissive <> 'PERMISSIVE'
       OR cmd IS DISTINCT FROM command
       OR (kind='service_role' AND (
            roles IS DISTINCT FROM '{service_role}'
            OR qual IS DISTINCT FROM 'true'
            OR with_check IS DISTINCT FROM 'true'
       ))
       OR (kind='owner' AND (
            roles IS DISTINCT FROM '{authenticated}'
            OR command <> 'SELECT'
            OR with_check IS NOT NULL
            OR normalized_qual <> 'selectauth.uidasuid=user_id'
       ))
  )
  SELECT COUNT(*),
         string_agg(table_name || '.' || policy_name, '; ' ORDER BY table_name, policy_name)
  INTO missing_count, unmatched FROM drift;

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'P1 post-migration policy definition drift: % policies: %',
      missing_count, left(coalesce(unmatched, '?'), 800);
  END IF;

  -- Fresh replay has no policies with these historical names. The live
  -- project has an out-of-band pair, but source migrations never created it.
  -- The earlier rollback fixture synthesizes and deduplicates the pair, and
  -- ROLLBACK must leave ZERO such policies in a canonical fresh database.
  -- A future forward migration adding them must update this explicit contract.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='subscriptions'
        AND policyname IN ('Users can view own subscriptions',
                           'Users can view their own subscription')) <> 0 THEN
    RAISE EXCEPTION 'P1 unexpected inherited subscription policies in fresh replay; reconcile migration provenance';
  END IF;
END
$verify_postmigration$;

SELECT 'p1_service_role_postmigration_passed';
ROLLBACK;

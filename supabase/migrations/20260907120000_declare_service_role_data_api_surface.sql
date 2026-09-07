-- Declare the Data API surface for every table created after the 18 July
-- hardening that never declared its own.
--
-- Deployment #131 failed post-migration with five of these:
--
--   - service role cannot read table: public.shared_links
--   - service role cannot read table: public.user_auth_factors
--   - service role cannot read table: public.user_recovery_codes
--   - service role cannot read retired table: public.audio_assets
--   - service role cannot read retired table: public.daw_sessions
--
-- This is the same fault as 20260727190000_grant_service_role_auth_rate_limits,
-- and for the same reason, quoted from the migration that created the boundary
-- (20260718064853_data_api_privilege_hardening):
--
--   "Existing objects retain their current explicit/legacy grants. New public
--    objects become opt-in so a future migration must declare its Data API
--    surface alongside RLS."
--
--   alter default privileges for role postgres in schema public
--     revoke select, insert, update, delete on tables from anon, authenticated, service_role;
--
-- The boundary is working as designed. What keeps failing is the declaration:
-- a migration adds a table and never says who may reach it, so the table lands
-- with service_role holding everything except the four verbs that matter. It
-- has now happened at least twice -- once on 27 July for one table, and again
-- here for five -- so the second half of this change is a test that fails when
-- a new table arrives undeclared, rather than a third fix after a third deploy.
--
-- Two of these are not cosmetic. public.user_auth_factors and
-- public.user_recovery_codes are read by lib/sonara-two-factor.cjs through the
-- service-role client on every sign-in that checks for a second factor, and
-- public.shared_links is read by routes/sonara-shared-result-routes.cjs. A
-- table the service role cannot select from is a feature that cannot work in
-- production, not merely a gate that is unhappy.
--
-- WHY THE LIST IS 48 AND NOT THE 5 THE DEPLOY NAMED. The deploy log only names
-- tables that are in production now. Whether an individual table lost its
-- grants depends on whether it was really created after 18 July -- several of
-- these migrations use `create table if not exists`, which is a no-op when the
-- table already existed and therefore keeps its legacy grants. That ordering
-- lives in the production database and cannot be read out of this repository,
-- so this migration declares the surface for every candidate instead of the
-- five that happened to surface. Granting a table that already holds the grant
-- changes nothing.
--
-- anon and authenticated are deliberately NOT touched. Some of these tables are
-- public by design -- public_booking_pages, scroll_sites, lead_capture_pages and
-- creator_follows back pages an unauthenticated visitor is meant to load -- so
-- copying the `revoke all from anon, authenticated` half of the 27 July
-- precedent would take those pages down. This migration widens nothing for the
-- browser roles and narrows nothing either; it only declares the server role.
--
-- No customer data is modified by this migration.

DO $$
DECLARE
  table_name text;
  missing_tables text[];
  -- Active tables. Every one of these is already required to exist by
  -- scripts/verify-production-supabase.mjs, so a missing one is a fault worth
  -- raising here rather than skipping quietly.
  undeclared_active constant text[] := ARRAY[
    'accounting_exports',
    'agent_pending_actions',
    'agent_schedules',
    'business_payment_accounts',
    'business_sub_app_records',
    'call_sessions',
    'call_signals',
    'creator_artist_profiles',
    'creator_follows',
    'customer_invoice_lines',
    'customer_invoice_payments',
    'customer_invoices',
    'customers',
    'device_capability_profiles',
    'employee_announcements',
    'employee_tasks',
    'lead_capture_pages',
    'lead_conversations',
    'lead_icp_profiles',
    'lead_routing_rules',
    'location_events',
    'merchant_product_variants',
    'merchant_products',
    'motion_sensor_events',
    'pending_auth_challenges',
    'public_booking_pages',
    'push_subscriptions',
    'quotes',
    'record_change_log',
    'recurring_invoice_lines',
    'recurring_invoices',
    'scroll_sites',
    'shared_links',
    'sonara_prompt_collection_items',
    'sonara_prompt_collections',
    'sonara_prompt_connections',
    'sonara_prompt_import_batches',
    'sonara_prompt_reports',
    'sonara_prompt_runs',
    'sonara_prompt_tags',
    'sonara_prompt_template_tags',
    'sonara_prompt_templates',
    'sonara_prompt_versions',
    'tactile_events',
    'user_auth_factors',
    'user_recovery_codes'
  ];
  -- Retired tables, which production is not required to have. These are granted
  -- only where they survive, because the deploy gate still checks the shape of a
  -- retired table that is present -- and because a table nobody can read is a
  -- table nobody can archive, which is what retirement is waiting on.
  undeclared_retired constant text[] := ARRAY[
    'audio_assets',
    'daw_sessions'
  ];
BEGIN
  SELECT COALESCE(array_agg(expected.name ORDER BY expected.name), '{}'::text[])
  INTO missing_tables
  FROM unnest(undeclared_active) AS expected(name)
  WHERE to_regclass(format('public.%I', expected.name)) IS NULL;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'SONARA Data API surface declaration failed; missing tables: %',
      array_to_string(missing_tables, ', ');
  END IF;

  FOREACH table_name IN ARRAY undeclared_active
  LOOP
    EXECUTE format(
      'grant select, insert, update, delete on table public.%I to service_role',
      table_name
    );
  END LOOP;

  FOREACH table_name IN ARRAY undeclared_retired
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'grant select, insert, update, delete on table public.%I to service_role',
        table_name
      );
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';

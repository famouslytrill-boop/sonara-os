-- Reconcile server-side access for active SONARA extension and control-plane tables.
-- Browser roles remain governed by existing RLS policies and explicit revocations.

DO $$
DECLARE
  table_name text;
  missing_tables text[];
  extension_tables constant text[] := ARRAY[
    'business_channels',
    'business_control_audit_events',
    'business_integration_connections',
    'business_ownership_transfers',
    'business_permission_grants',
    'creator_generation_assets',
    'creator_generation_events',
    'creator_generation_jobs',
    'creator_reference_analyses',
    'creator_voice_consents',
    'growth_audience_segments',
    'growth_contact_consents',
    'growth_content_queue',
    'growth_control_events',
    'growth_conversions',
    'growth_experiment_variants',
    'growth_metric_snapshots',
    'growth_provider_connections',
    'growth_provider_jobs',
    'growth_touchpoints',
    'product_lifecycle_events',
    'product_lifecycle_evidence',
    'product_lifecycle_feedback',
    'product_lifecycle_initiatives',
    'product_lifecycle_iterations',
    'product_lifecycle_requirements',
    'product_lifecycle_stage_reviews'
  ];
BEGIN
  SELECT COALESCE(array_agg(expected.name ORDER BY expected.name), '{}'::text[])
  INTO missing_tables
  FROM unnest(extension_tables) AS expected(name)
  WHERE to_regclass(format('public.%I', expected.name)) IS NULL;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'SONARA extension grant reconciliation failed; missing tables: %',
      array_to_string(missing_tables, ', ');
  END IF;

  FOREACH table_name IN ARRAY extension_tables
  LOOP
    EXECUTE format(
      'grant select, insert, update, delete on table public.%I to service_role',
      table_name
    );
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';

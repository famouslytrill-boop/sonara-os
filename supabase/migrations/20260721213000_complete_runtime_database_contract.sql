-- Complete the canonical SONARA runtime database contract. Every table used by
-- the Express runtime must already exist, have RLS enabled, and be reachable by
-- the server-only service role before this migration can finish.

grant usage on schema public to service_role;

do $$
declare
  contract_table text;
  contract_tables constant text[] := array[
    'profiles','organizations','organization_memberships','user_roles','user_preferences',
    'stripe_customers','purchases','billing_webhook_events','billing_subscriptions','billing_entitlements',
    'support_requests','feedback_reports','support_email_delivery_attempts','service_catalog_items','service_requests',
    'service_request_events','service_deliverables','service_comments','module_outputs','intake_requests',
    'launch_checklist_items','activity_events','business_workspaces','business_memberships','business_employee_invites',
    'business_employee_profiles','business_service_catalog','business_bookings','employee_schedules','business_locations',
    'inventory_items','vendor_accounts','vendor_invoices','recipe_cards','menu_items',
    'customer_records','order_records','vehicle_records','maintenance_logs','waste_logs',
    'creator_assets','creator_releases','creator_artist_systems','creator_song_blueprints','creator_prompt_packs',
    'creator_release_packages','music_projects','growth_campaigns','growth_leads','growth_experiments',
    'provider_registry','feature_flags','workflow_runs','agent_action_logs','sonara_memory_records',
    'entities','entity_memberships','entity_agents','entity_agent_runs','entity_agent_memory',
    'entity_agent_tool_registry','entity_proactive_actions','entity_action_runs','entity_action_approvals','entity_automations',
    'entity_automation_runs','entity_connectors','entity_connector_events','platform_jobs','audit_logs',
    'admin_audit_logs','system_audit_events','db_health_snapshots','observability_events','license_reviews',
    'security_reviews','sonara_formula_groups','sonara_formula_definitions','sonara_formula_results','integration_providers',
    'integration_jobs','user_notifications','sensory_feedback_profiles','sound_cues','haptic_patterns',
    'location_zones'
  ];
begin
  foreach contract_table in array contract_tables
  loop
    if to_regclass(format('public.%I', contract_table)) is null then
      raise exception 'required SONARA contract table public.% is missing', contract_table;
    end if;

    if not exists (
      select 1
      from pg_class classes
      join pg_namespace namespaces on namespaces.oid = classes.relnamespace
      where namespaces.nspname = 'public'
        and classes.relname = contract_table
        and classes.relkind in ('r', 'p')
        and classes.relrowsecurity
    ) then
      raise exception 'required SONARA contract table public.% does not have RLS enabled', contract_table;
    end if;

    execute format(
      'grant select, insert, update, delete on table public.%I to service_role',
      contract_table
    );
  end loop;
end $$;

grant usage, select on all sequences in schema public to service_role;

create or replace function public.sonara_database_contract_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with
  expected_schemas(name) as (
    select unnest(array['public','auth','storage']::text[])
  ),
  expected_tables(name) as (
    select unnest(array[
      'profiles','organizations','organization_memberships','user_roles','user_preferences',
      'stripe_customers','purchases','billing_webhook_events','billing_subscriptions','billing_entitlements',
      'support_requests','feedback_reports','support_email_delivery_attempts','service_catalog_items','service_requests',
      'service_request_events','service_deliverables','service_comments','module_outputs','intake_requests',
      'launch_checklist_items','activity_events','business_workspaces','business_memberships','business_employee_invites',
      'business_employee_profiles','business_service_catalog','business_bookings','employee_schedules','business_locations',
      'inventory_items','vendor_accounts','vendor_invoices','recipe_cards','menu_items',
      'customer_records','order_records','vehicle_records','maintenance_logs','waste_logs',
      'creator_assets','creator_releases','creator_artist_systems','creator_song_blueprints','creator_prompt_packs',
      'creator_release_packages','music_projects','growth_campaigns','growth_leads','growth_experiments',
      'provider_registry','feature_flags','workflow_runs','agent_action_logs','sonara_memory_records',
      'entities','entity_memberships','entity_agents','entity_agent_runs','entity_agent_memory',
      'entity_agent_tool_registry','entity_proactive_actions','entity_action_runs','entity_action_approvals','entity_automations',
      'entity_automation_runs','entity_connectors','entity_connector_events','platform_jobs','audit_logs',
      'admin_audit_logs','system_audit_events','db_health_snapshots','observability_events','license_reviews',
      'security_reviews','sonara_formula_groups','sonara_formula_definitions','sonara_formula_results','integration_providers',
      'integration_jobs','user_notifications','sensory_feedback_profiles','sound_cues','haptic_patterns',
      'location_zones'
    ]::text[])
  ),
  expected_functions(signature) as (
    select unnest(array[
      'public.is_org_member(uuid)',
      'public.has_org_role(uuid,text[])',
      'public.is_admin_or_founder()',
      'public.is_org_owner_or_admin(uuid)',
      'public.sonara_is_org_member(uuid)',
      'public.sonara_has_org_role(uuid,text[])',
      'public.is_entity_member(uuid)',
      'public.has_entity_role(uuid,public.entity_member_role[])',
      'public.can_manage_entity(uuid)',
      'public.sonara_database_contract_snapshot()'
    ]::text[])
  )
  select jsonb_build_object(
    'schemas', (
      select jsonb_agg(
        jsonb_build_object('name', name, 'available', to_regnamespace(name) is not null)
        order by name
      )
      from expected_schemas
    ),
    'tables', (
      select jsonb_agg(
        jsonb_build_object(
          'name', expected_tables.name,
          'available', to_regclass(format('public.%I', expected_tables.name)) is not null,
          'rls_enabled', coalesce(classes.relrowsecurity, false)
        )
        order by expected_tables.name
      )
      from expected_tables
      left join pg_class classes
        on classes.oid = to_regclass(format('public.%I', expected_tables.name))
    ),
    'functions', (
      select jsonb_agg(
        jsonb_build_object('signature', signature, 'available', to_regprocedure(signature) is not null)
        order by signature
      )
      from expected_functions
    )
  );
$function$;

revoke execute on function public.sonara_database_contract_snapshot() from public, anon, authenticated;
grant execute on function public.sonara_database_contract_snapshot() to service_role;

comment on function public.sonara_database_contract_snapshot() is
  'Service-role-only schema, RLS, and authorization-function readiness snapshot for every runtime table. Returns metadata only; never customer rows or secrets.';

do $$
begin
  if has_function_privilege('anon', 'public.sonara_database_contract_snapshot()'::regprocedure, 'execute')
    or has_function_privilege('authenticated', 'public.sonara_database_contract_snapshot()'::regprocedure, 'execute') then
    raise exception 'database contract snapshot is executable by a public Data API role';
  end if;

  if not has_function_privilege('service_role', 'public.sonara_database_contract_snapshot()'::regprocedure, 'execute') then
    raise exception 'service role cannot execute the database contract snapshot';
  end if;
end $$;

notify pgrst, 'reload schema';

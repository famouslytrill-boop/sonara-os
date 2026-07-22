-- Expand the production contract from runtime-only tables to every active
-- table named by the SONARA ecosystem manifest. Retired/legacy database names
-- remain untouched and are not reintroduced into the active product contract.

grant usage on schema public to service_role;

-- Creator Studio declares transcript segments as part of its music workflow,
-- but no prior migration created the table. Keep every record tenant-scoped
-- and reachable only through the server-side service role.
create table if not exists public.audio_transcription_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete set null,
  music_track_id uuid references public.music_tracks(id) on delete set null,
  audio_analysis_report_id uuid references public.audio_analysis_reports(id) on delete set null,
  source_file_url text,
  language_code text not null default 'und',
  segment_index integer not null default 0 check (segment_index >= 0),
  starts_at_ms bigint check (starts_at_ms is null or starts_at_ms >= 0),
  ends_at_ms bigint check (ends_at_ms is null or ends_at_ms >= 0),
  speaker_label text,
  transcript_text text not null,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'completed' check (status in ('queued','processing','completed','failed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at_ms is null or ends_at_ms is null or ends_at_ms >= starts_at_ms)
);

create index if not exists audio_transcription_segments_org_track_segment_idx
  on public.audio_transcription_segments(organization_id, music_track_id, segment_index);
create index if not exists audio_transcription_segments_project_created_idx
  on public.audio_transcription_segments(music_project_id, created_at desc);

alter table public.audio_transcription_segments enable row level security;

revoke all on table public.audio_transcription_segments from public, anon, authenticated;
grant select, insert, update, delete on table public.audio_transcription_segments to service_role;

drop policy if exists "service role manages audio_transcription_segments" on public.audio_transcription_segments;
create policy "service role manages audio_transcription_segments"
  on public.audio_transcription_segments for all to service_role using (true) with check (true);

drop trigger if exists audio_transcription_segments_set_updated_at on public.audio_transcription_segments;
create trigger audio_transcription_segments_set_updated_at
  before update on public.audio_transcription_segments
  for each row execute function public.set_updated_at();

do $$
declare
  contract_table text;
  missing_tables text[];
  tables_without_rls text[];
  contract_tables constant text[] := array[
    'profiles','organizations','organization_memberships','user_roles','user_preferences',
    'sonara_platforms','sonara_platform_pages','sonara_platform_apps','sonara_platform_modules','sonara_platform_publications','sonara_platform_templates',
    'stripe_customers','purchases','billing_webhook_events','billing_subscriptions','billing_entitlements','plans','organization_entitlements',
    'support_requests','feedback_reports','support_email_delivery_attempts','service_catalog_items','service_requests',
    'service_request_events','service_deliverables','service_comments','module_outputs','intake_requests',
    'launch_checklist_items','activity_events','business_workspaces','business_memberships','business_employee_invites',
    'business_employee_profiles','business_service_catalog','business_service_items','business_bookings','business_appointments',
    'employee_schedules','employee_profiles','employee_shifts','employee_time_entries','employee_pay_periods','employee_pay_statements','employee_posts',
    'business_locations','business_assets','inventory_items','vendor_accounts','vendor_invoices','recipe_cards','recipe_ingredients','menu_items',
    'pos_sales_summaries','daily_profit_snapshots','customer_records','order_records','vehicle_records','maintenance_logs','waste_logs',
    'creator_assets','creator_releases','creator_artist_systems','creator_song_blueprints','creator_prompt_packs','creator_quality_checks',
    'creator_release_packages','creator_export_packages','music_tracks','music_stems','daw_export_profiles','music_ai_providers',
    'music_ai_jobs','audio_analysis_reports','audio_transcription_segments','music_projects',
    'growth_campaigns','growth_leads','growth_experiments','automation_rules',
    'provider_registry','feature_flags','workflow_runs','agent_action_logs','sonara_memory_records',
    'entities','entity_memberships','entity_agents','entity_agent_runs','entity_agent_memory',
    'entity_agent_tool_registry','entity_proactive_actions','entity_action_runs','entity_action_approvals','entity_automations',
    'entity_automation_runs','entity_connectors','entity_connector_events','platform_jobs','audit_logs',
    'admin_audit_logs','system_audit_events','db_health_snapshots','observability_events','license_reviews','security_reviews','sonara_control_plane_checks',
    'sonara_formula_groups','sonara_formula_definitions','sonara_formula_variables','sonara_formula_templates','sonara_formula_results',
    'integration_providers','integration_jobs','user_notifications','sensory_feedback_profiles','sound_cues','haptic_patterns','location_zones'
  ];
begin
  select coalesce(array_agg(expected.table_name order by expected.table_name), '{}'::text[])
  into missing_tables
  from unnest(contract_tables) as expected(table_name)
  where to_regclass(format('public.%I', expected.table_name)) is null;

  select coalesce(array_agg(expected.table_name order by expected.table_name), '{}'::text[])
  into tables_without_rls
  from unnest(contract_tables) as expected(table_name)
  where to_regclass(format('public.%I', expected.table_name)) is not null
    and not exists (
      select 1
      from pg_class classes
      join pg_namespace namespaces on namespaces.oid = classes.relnamespace
      where namespaces.nspname = 'public'
        and classes.relname = expected.table_name
        and classes.relkind in ('r', 'p')
        and classes.relrowsecurity
    );

  if cardinality(missing_tables) > 0 or cardinality(tables_without_rls) > 0 then
    raise exception
      'SONARA ecosystem contract preflight failed (missing tables: %; tables without RLS: %)',
      array_to_string(missing_tables, ', '),
      array_to_string(tables_without_rls, ', ');
  end if;

  foreach contract_table in array contract_tables
  loop
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
      'sonara_platforms','sonara_platform_pages','sonara_platform_apps','sonara_platform_modules','sonara_platform_publications','sonara_platform_templates',
      'stripe_customers','purchases','billing_webhook_events','billing_subscriptions','billing_entitlements','plans','organization_entitlements',
      'support_requests','feedback_reports','support_email_delivery_attempts','service_catalog_items','service_requests',
      'service_request_events','service_deliverables','service_comments','module_outputs','intake_requests',
      'launch_checklist_items','activity_events','business_workspaces','business_memberships','business_employee_invites',
      'business_employee_profiles','business_service_catalog','business_service_items','business_bookings','business_appointments',
      'employee_schedules','employee_profiles','employee_shifts','employee_time_entries','employee_pay_periods','employee_pay_statements','employee_posts',
      'business_locations','business_assets','inventory_items','vendor_accounts','vendor_invoices','recipe_cards','recipe_ingredients','menu_items',
      'pos_sales_summaries','daily_profit_snapshots','customer_records','order_records','vehicle_records','maintenance_logs','waste_logs',
      'creator_assets','creator_releases','creator_artist_systems','creator_song_blueprints','creator_prompt_packs','creator_quality_checks',
      'creator_release_packages','creator_export_packages','music_tracks','music_stems','daw_export_profiles','music_ai_providers',
      'music_ai_jobs','audio_analysis_reports','audio_transcription_segments','music_projects',
      'growth_campaigns','growth_leads','growth_experiments','automation_rules',
      'provider_registry','feature_flags','workflow_runs','agent_action_logs','sonara_memory_records',
      'entities','entity_memberships','entity_agents','entity_agent_runs','entity_agent_memory',
      'entity_agent_tool_registry','entity_proactive_actions','entity_action_runs','entity_action_approvals','entity_automations',
      'entity_automation_runs','entity_connectors','entity_connector_events','platform_jobs','audit_logs',
      'admin_audit_logs','system_audit_events','db_health_snapshots','observability_events','license_reviews','security_reviews','sonara_control_plane_checks',
      'sonara_formula_groups','sonara_formula_definitions','sonara_formula_variables','sonara_formula_templates','sonara_formula_results',
      'integration_providers','integration_jobs','user_notifications','sensory_feedback_profiles','sound_cues','haptic_patterns','location_zones'
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
  'Service-role-only schema, RLS, and authorization-function readiness snapshot for every active SONARA ecosystem table. Returns metadata only; never customer rows or secrets.';

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

-- Complete the canonical SONARA runtime database contract. Every table used by
-- the Express runtime must already exist, have RLS enabled, and be reachable by
-- the server-only service role before this migration can finish.

grant usage on schema public to service_role;

-- Some production projects recorded the legacy operations migration without
-- creating these three runtime tables. Restore the original additive schema
-- before enforcing the complete contract below.
create table if not exists public.business_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  service_id uuid references public.business_service_catalog(id) on delete set null,
  customer_id uuid references public.customer_records(id) on delete set null,
  assigned_employee_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled','no_show','archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  role_label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','missed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  asset_id uuid references public.business_assets(id) on delete set null,
  vehicle_id uuid references public.vehicle_records(id) on delete set null,
  service_type text,
  description text,
  vendor text,
  cost_cents integer default 0,
  currency text default 'usd',
  serviced_at date,
  next_due_at date,
  status text not null default 'completed' check (status in ('planned','completed','cancelled','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists business_bookings_organization_starts_at_idx
  on public.business_bookings(organization_id, starts_at desc);
create index if not exists employee_schedules_employee_idx
  on public.employee_schedules(employee_id, starts_at);
create index if not exists employee_schedules_organization_starts_at_idx
  on public.employee_schedules(organization_id, starts_at);
create index if not exists maintenance_logs_organization_serviced_at_idx
  on public.maintenance_logs(organization_id, serviced_at desc);

alter table public.business_bookings enable row level security;
alter table public.employee_schedules enable row level security;
alter table public.maintenance_logs enable row level security;

drop policy if exists "service role manages business_bookings" on public.business_bookings;
create policy "service role manages business_bookings"
  on public.business_bookings for all to service_role using (true) with check (true);

drop policy if exists "service role manages employee_schedules" on public.employee_schedules;
create policy "service role manages employee_schedules"
  on public.employee_schedules for all to service_role using (true) with check (true);

drop policy if exists "service role manages maintenance_logs" on public.maintenance_logs;
create policy "service role manages maintenance_logs"
  on public.maintenance_logs for all to service_role using (true) with check (true);

do $$
declare
  contract_table text;
  missing_tables text[];
  tables_without_rls text[];
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
      'SONARA contract preflight failed (missing tables: %; tables without RLS: %)',
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

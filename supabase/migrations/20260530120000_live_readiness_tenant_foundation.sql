-- SONARA consolidated live-readiness tenant foundation.
-- Append-only, additive, and RLS-first. No destructive drops.

create extension if not exists "pgcrypto";

create table if not exists public.permission_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  permission_key text not null,
  status text not null default 'not_requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  permission_key text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  consent_status text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source text not null,
  status text not null default 'review_required',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_record_id uuid references public.contact_records(id) on delete cascade,
  channel text not null,
  consent_status text not null default 'not_opted_in',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_number_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_record_id uuid references public.contact_records(id) on delete cascade,
  phone text not null,
  consent_status text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_command_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  command_key text not null,
  status text not null default 'draft',
  transcript_redacted text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.media_capture_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  media_type text not null,
  status text not null default 'review_required',
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  business_type text,
  status text not null default 'setup_required',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sub_apps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.business_workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  slug text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.business_sub_app_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sub_app_id uuid not null references public.business_sub_apps(id) on delete cascade,
  module_key text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sub_app_database_schemas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sub_app_id uuid not null references public.business_sub_apps(id) on delete cascade,
  schema_key text not null,
  fields jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sub_app_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sub_app_id uuid not null references public.business_sub_apps(id) on delete cascade,
  page_key text not null,
  title text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sub_app_deployments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sub_app_id uuid not null references public.business_sub_apps(id) on delete cascade,
  status text not null default 'not_deployed',
  deployment_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_key text not null,
  risk_level text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists permission_grants_org_idx on public.permission_grants (organization_id);
create index if not exists permission_audit_logs_org_idx on public.permission_audit_logs (organization_id);
create index if not exists contact_records_org_idx on public.contact_records (organization_id);
create index if not exists contact_import_batches_org_idx on public.contact_import_batches (organization_id);
create index if not exists communication_preferences_org_idx on public.communication_preferences (organization_id);
create index if not exists phone_number_records_org_idx on public.phone_number_records (organization_id);
create index if not exists voice_command_logs_org_idx on public.voice_command_logs (organization_id);
create index if not exists media_capture_records_org_idx on public.media_capture_records (organization_id);
create index if not exists business_workspaces_org_idx on public.business_workspaces (organization_id);
create index if not exists business_sub_apps_org_idx on public.business_sub_apps (organization_id);
create index if not exists business_sub_app_modules_org_idx on public.business_sub_app_modules (organization_id);
create index if not exists business_sub_app_database_schemas_org_idx on public.business_sub_app_database_schemas (organization_id);
create index if not exists business_sub_app_pages_org_idx on public.business_sub_app_pages (organization_id);
create index if not exists business_sub_app_deployments_org_idx on public.business_sub_app_deployments (organization_id);
create index if not exists audit_events_org_idx on public.audit_events (organization_id);

alter table public.permission_grants enable row level security;
alter table public.permission_audit_logs enable row level security;
alter table public.contact_records enable row level security;
alter table public.contact_import_batches enable row level security;
alter table public.communication_preferences enable row level security;
alter table public.phone_number_records enable row level security;
alter table public.voice_command_logs enable row level security;
alter table public.media_capture_records enable row level security;
alter table public.business_workspaces enable row level security;
alter table public.business_sub_apps enable row level security;
alter table public.business_sub_app_modules enable row level security;
alter table public.business_sub_app_database_schemas enable row level security;
alter table public.business_sub_app_pages enable row level security;
alter table public.business_sub_app_deployments enable row level security;
alter table public.audit_events enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'permission_grants',
    'permission_audit_logs',
    'contact_records',
    'contact_import_batches',
    'communication_preferences',
    'phone_number_records',
    'voice_command_logs',
    'media_capture_records',
    'business_workspaces',
    'business_sub_apps',
    'business_sub_app_modules',
    'business_sub_app_database_schemas',
    'business_sub_app_pages',
    'business_sub_app_deployments',
    'audit_events'
  ]
  loop
    execute format('drop policy if exists "org members can read %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "org members can read %1$s" on public.%1$I for select using (
        organization_id is not null
        and exists (
          select 1 from public.organization_memberships memberships
          where memberships.organization_id = %1$I.organization_id
            and memberships.user_id = auth.uid()
            and memberships.status = ''active''
        )
      )',
      table_name
    );

    execute format('drop policy if exists "service role can manage %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "service role can manage %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      table_name
    );
  end loop;
end $$;

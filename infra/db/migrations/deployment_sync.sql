-- Deployment Sync migration.
-- Review before applying to any live database.
-- This stores deployment verification findings only. It must not store raw secrets,
-- cloud tokens, database URLs, webhook secrets, payout data, or API keys.

create extension if not exists pgcrypto;

create table if not exists public.deployment_sync_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'deployment_sync',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.deployment_sync_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deployment_sync_report_id uuid references public.deployment_sync_reports(id) on delete cascade,
  provider text not null,
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.domain_connection_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'domain',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.cloud_provider_connection_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null check (provider in ('github', 'vercel', 'supabase', 'stripe', 'docker', 'rancher')),
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.environment_variable_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'environment',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.paywall_sync_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'paywall',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.auth_sync_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'auth',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.security_sync_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'security',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.deployment_sync_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  provider text not null default 'deployment_sync',
  status text not null check (
    status in ('not_configured', 'configured', 'verified', 'needs_review', 'blocked', 'failed', 'skipped_for_mvp')
  ),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  finding_key text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists deployment_sync_reports_org_created_idx
  on public.deployment_sync_reports (organization_id, created_at desc);
create index if not exists deployment_sync_findings_org_provider_idx
  on public.deployment_sync_findings (organization_id, provider, status);
create index if not exists domain_connection_checks_org_idx
  on public.domain_connection_checks (organization_id, status);
create index if not exists cloud_provider_connection_checks_org_idx
  on public.cloud_provider_connection_checks (organization_id, provider, status);
create index if not exists environment_variable_checks_org_idx
  on public.environment_variable_checks (organization_id, status);
create index if not exists paywall_sync_checks_org_idx
  on public.paywall_sync_checks (organization_id, status);
create index if not exists auth_sync_checks_org_idx
  on public.auth_sync_checks (organization_id, status);
create index if not exists security_sync_checks_org_idx
  on public.security_sync_checks (organization_id, status);
create index if not exists deployment_sync_audit_logs_org_created_idx
  on public.deployment_sync_audit_logs (organization_id, created_at desc);

alter table public.deployment_sync_reports enable row level security;
alter table public.deployment_sync_findings enable row level security;
alter table public.domain_connection_checks enable row level security;
alter table public.cloud_provider_connection_checks enable row level security;
alter table public.environment_variable_checks enable row level security;
alter table public.paywall_sync_checks enable row level security;
alter table public.auth_sync_checks enable row level security;
alter table public.security_sync_checks enable row level security;
alter table public.deployment_sync_audit_logs enable row level security;

create policy "deployment_sync_reports_org_admin"
on public.deployment_sync_reports
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "deployment_sync_findings_org_admin"
on public.deployment_sync_findings
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "domain_connection_checks_org_admin"
on public.domain_connection_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "cloud_provider_connection_checks_org_admin"
on public.cloud_provider_connection_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "environment_variable_checks_org_admin"
on public.environment_variable_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "paywall_sync_checks_org_admin"
on public.paywall_sync_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "auth_sync_checks_org_admin"
on public.auth_sync_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "security_sync_checks_org_admin"
on public.security_sync_checks
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "deployment_sync_audit_logs_org_admin_read"
on public.deployment_sync_audit_logs
for select
using (public.is_org_admin(organization_id));

create policy "deployment_sync_audit_logs_org_admin_insert"
on public.deployment_sync_audit_logs
for insert
with check (public.is_org_admin(organization_id));

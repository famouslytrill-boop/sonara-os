-- Open-Source Intake Registry migration.
-- Review before applying to any live database.
-- External project records are intake metadata only; this migration does not install or vendor code.

create extension if not exists pgcrypto;

create table if not exists public.open_source_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null check (
    integration_status in (
      'not_reviewed',
      'reviewed_reference_only',
      'approved_for_adapter',
      'approved_for_self_hosting',
      'blocked',
      'coming_later',
      'removed'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  constraint open_source_projects_repo_unique unique (organization_id, repo_owner, repo_name)
);

create table if not exists public.open_source_license_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_source_project_id uuid references public.open_source_projects(id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null,
  review_status text not null default 'needs_review',
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.open_source_security_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_source_project_id uuid references public.open_source_projects(id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null,
  review_status text not null default 'needs_review',
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.open_source_product_fit_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_source_project_id uuid references public.open_source_projects(id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null,
  product_fit text[] not null default '{}',
  review_status text not null default 'needs_review',
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.open_source_integration_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_source_project_id uuid references public.open_source_projects(id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null,
  decision_summary text not null,
  decided_by uuid references public.user_profiles(id),
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.open_source_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  normalized_url text not null,
  category text not null,
  use_mode text not null,
  license_risk text not null check (license_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  security_risk text not null check (security_risk in ('low', 'medium', 'high', 'critical', 'unknown')),
  integration_status text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists open_source_projects_org_status_idx
on public.open_source_projects(organization_id, integration_status, created_at desc);

create index if not exists open_source_projects_repo_idx
on public.open_source_projects(repo_owner, repo_name);

create index if not exists open_source_license_reviews_org_idx
on public.open_source_license_reviews(organization_id, license_risk, created_at desc);

create index if not exists open_source_security_reviews_org_idx
on public.open_source_security_reviews(organization_id, security_risk, created_at desc);

create index if not exists open_source_product_fit_reviews_org_idx
on public.open_source_product_fit_reviews(organization_id, created_at desc);

create index if not exists open_source_integration_decisions_org_idx
on public.open_source_integration_decisions(organization_id, integration_status, created_at desc);

create index if not exists open_source_audit_logs_org_idx
on public.open_source_audit_logs(organization_id, created_at desc);

alter table public.open_source_projects enable row level security;
alter table public.open_source_license_reviews enable row level security;
alter table public.open_source_security_reviews enable row level security;
alter table public.open_source_product_fit_reviews enable row level security;
alter table public.open_source_integration_decisions enable row level security;
alter table public.open_source_audit_logs enable row level security;

create policy "open_source_projects_org_members"
on public.open_source_projects
for all
using (public.is_org_member(organization_id))
with check (public.is_org_admin(organization_id));

create policy "open_source_license_reviews_owner_admin"
on public.open_source_license_reviews
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "open_source_security_reviews_owner_admin"
on public.open_source_security_reviews
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "open_source_product_fit_reviews_owner_admin"
on public.open_source_product_fit_reviews
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "open_source_integration_decisions_owner_admin"
on public.open_source_integration_decisions
for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "open_source_audit_logs_owner_admin_read"
on public.open_source_audit_logs
for select
using (public.is_org_admin(organization_id));

create policy "open_source_audit_logs_owner_admin_insert"
on public.open_source_audit_logs
for insert
with check (public.is_org_admin(organization_id));

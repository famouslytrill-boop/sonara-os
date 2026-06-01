-- Prompt Playbook Center migration.
-- Review before applying to any live database.
-- Prompt records are draft-only and must not send or publish generated output automatically.

create extension if not exists pgcrypto;

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_key text not null,
  name text not null,
  product_area text not null,
  category text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'not_required',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.prompt_template_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_area text not null,
  category text not null,
  risk_level text not null default 'low',
  approval_status text not null default 'not_required',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.prompt_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_template_id uuid references public.prompt_templates(id) on delete set null,
  product_area text not null,
  category text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null default 'not_required',
  prompt_preview text,
  output_status text not null default 'draft_only',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.prompt_safety_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_run_id uuid references public.prompt_runs(id) on delete cascade,
  product_area text not null,
  category text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null,
  finding_status text not null check (finding_status in ('allowed', 'owner_review_required', 'blocked')),
  blocked_terms text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.saved_user_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_area text not null,
  category text not null,
  risk_level text not null default 'low',
  approval_status text not null default 'not_required',
  title text not null,
  prompt_body text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.prompt_approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_run_id uuid references public.prompt_runs(id) on delete cascade,
  product_area text not null,
  category text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.user_profiles(id),
  rejected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.prompt_usage_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_run_id uuid references public.prompt_runs(id) on delete set null,
  product_area text not null,
  category text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_status text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists prompt_templates_org_idx on public.prompt_templates (organization_id, category);
create index if not exists prompt_runs_org_idx on public.prompt_runs (organization_id, created_at desc);
create index if not exists prompt_usage_audit_logs_org_idx on public.prompt_usage_audit_logs (organization_id, created_at desc);

alter table public.prompt_templates enable row level security;
alter table public.prompt_template_categories enable row level security;
alter table public.prompt_runs enable row level security;
alter table public.prompt_safety_findings enable row level security;
alter table public.saved_user_prompts enable row level security;
alter table public.prompt_approval_events enable row level security;
alter table public.prompt_usage_audit_logs enable row level security;

create policy "organization members manage prompt templates"
  on public.prompt_templates
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage prompt template categories"
  on public.prompt_template_categories
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage prompt runs"
  on public.prompt_runs
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage prompt safety findings"
  on public.prompt_safety_findings
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage saved prompts"
  on public.saved_user_prompts
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage prompt approval events"
  on public.prompt_approval_events
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members read prompt usage audit logs"
  on public.prompt_usage_audit_logs
  for select
  using (public.is_org_member(organization_id));

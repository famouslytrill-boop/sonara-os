-- Recommendation Transparency migration.
-- Review before applying to any live database.
-- Recommendations are advisory records and must not execute risky actions directly.

create extension if not exists pgcrypto;

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  action_key text not null,
  product_area text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  approval_requirement text not null check (
    approval_requirement in ('no_approval_needed', 'owner_review_required', 'blocked')
  ),
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.recommendation_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete cascade,
  signal_key text not null,
  signal_label text not null,
  signal_weight numeric not null default 0,
  allowed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.recommendation_rankings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete cascade,
  action_key text not null,
  product_area text not null,
  score numeric not null default 0,
  risk_level text not null,
  approval_requirement text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.recommendation_explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete cascade,
  action_key text not null,
  product_area text not null,
  why_suggested text not null,
  expected_business_value text not null,
  data_used text[] not null default '{}',
  data_not_used text[] not null default '{}',
  next_action text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.recommendation_safety_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete cascade,
  action_key text not null,
  product_area text not null,
  risk_level text not null,
  approval_requirement text not null,
  finding_status text not null check (finding_status in ('allowed', 'requires_owner_review', 'blocked')),
  reasons text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ranking_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recommendation_event_id uuid references public.recommendation_events(id) on delete cascade,
  action_key text not null,
  product_area text not null,
  risk_level text not null,
  approval_requirement text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists recommendation_events_org_idx on public.recommendation_events (organization_id, created_at desc);
create index if not exists recommendation_rankings_org_idx on public.recommendation_rankings (organization_id, score desc);
create index if not exists ranking_audit_logs_org_idx on public.ranking_audit_logs (organization_id, created_at desc);

alter table public.recommendation_events enable row level security;
alter table public.recommendation_signals enable row level security;
alter table public.recommendation_rankings enable row level security;
alter table public.recommendation_explanations enable row level security;
alter table public.recommendation_safety_findings enable row level security;
alter table public.ranking_audit_logs enable row level security;

create policy "organization members manage recommendation events"
  on public.recommendation_events
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage recommendation signals"
  on public.recommendation_signals
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage recommendation rankings"
  on public.recommendation_rankings
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage recommendation explanations"
  on public.recommendation_explanations
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members manage recommendation safety findings"
  on public.recommendation_safety_findings
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "organization members read ranking audit logs"
  on public.ranking_audit_logs
  for select
  using (public.is_org_member(organization_id));

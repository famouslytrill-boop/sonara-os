create extension if not exists pgcrypto;

create table if not exists public.provider_registry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  category text not null,
  risk_status text not null default 'review_required',
  integration_status text not null default 'not_configured',
  required_env text[] not null default '{}',
  server_only_env text[] not null default '{}',
  public_env text[] not null default '{}',
  human_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique,
  enabled boolean not null default false,
  owner_review_required boolean not null default true,
  description text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.license_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  subject_name text not null,
  subject_url text,
  license text,
  risk_status text not null default 'review_required',
  reviewer_user_id uuid references auth.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.security_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  subject_name text not null,
  risk_status text not null default 'review_required',
  reviewer_user_id uuid references auth.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  correlation_id text not null,
  event_name text not null,
  risk_level text not null default 'low',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  workflow_key text not null,
  status text not null default 'planned',
  approval_state text not null default 'not_required',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.agent_action_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  agent_key text not null,
  tool_key text not null,
  action text not null,
  risk_level text not null default 'medium',
  approval_state text not null default 'pending',
  result text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists provider_registry_slug_idx on public.provider_registry(slug);
create index if not exists feature_flags_key_idx on public.feature_flags(key);
create index if not exists license_reviews_org_idx on public.license_reviews(organization_id);
create index if not exists security_reviews_org_idx on public.security_reviews(organization_id);
create index if not exists observability_events_org_created_idx on public.observability_events(organization_id, created_at desc);
create index if not exists workflow_runs_org_status_idx on public.workflow_runs(organization_id, status);
create index if not exists agent_action_logs_org_created_idx on public.agent_action_logs(organization_id, created_at desc);

alter table public.provider_registry enable row level security;
alter table public.feature_flags enable row level security;
alter table public.license_reviews enable row level security;
alter table public.security_reviews enable row level security;
alter table public.observability_events enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.agent_action_logs enable row level security;

drop policy if exists "authenticated can read provider registry" on public.provider_registry;
create policy "authenticated can read provider registry" on public.provider_registry
for select using (auth.role() = 'authenticated');

drop policy if exists "service role can manage provider registry" on public.provider_registry;
create policy "service role can manage provider registry" on public.provider_registry
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "authenticated can read feature flags" on public.feature_flags;
create policy "authenticated can read feature flags" on public.feature_flags
for select using (auth.role() = 'authenticated');

drop policy if exists "service role can manage feature flags" on public.feature_flags;
create policy "service role can manage feature flags" on public.feature_flags
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

do $$
declare
  table_name text;
begin
  foreach table_name in array array['license_reviews', 'security_reviews', 'observability_events', 'workflow_runs', 'agent_action_logs']
  loop
    execute format('drop policy if exists "org members can read %1$s" on public.%1$I', table_name);
    execute format($policy$
      create policy "org members can read %1$s" on public.%1$I
      for select using (
        organization_id is not null and exists (
          select 1 from public.organization_memberships memberships
          where memberships.organization_id = %1$I.organization_id
            and memberships.user_id = auth.uid()
            and memberships.status = 'active'
        )
      )
    $policy$, table_name);

    execute format('drop policy if exists "service role can manage %1$s" on public.%1$I', table_name);
    execute format('create policy "service role can manage %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', table_name);
  end loop;
end $$;

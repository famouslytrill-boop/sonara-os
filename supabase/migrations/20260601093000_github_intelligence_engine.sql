create extension if not exists pgcrypto;

create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_name text,
  owner text,
  repo_url text unique,
  official_url text,
  description text,
  category text,
  license text,
  license_risk text default 'review_required',
  commercial_use_status text default 'review_required',
  integration_status text default 'reference_only',
  production_status text default 'not_integrated',
  recommended_action text,
  product_fit text[],
  business_value text,
  marketability_value text,
  profitability_value text,
  utility_value text,
  implementation_difficulty text,
  maintenance_status text default 'unknown',
  security_status text default 'unknown',
  privacy_status text default 'unknown',
  cost_status text default 'unknown',
  feature_flag text,
  score integer default 0,
  stars_count integer,
  forks_count integer,
  open_issues_count integer,
  last_pushed_at timestamptz,
  latest_release text,
  latest_release_at timestamptz,
  owner_review_required boolean default true,
  legal_review_required boolean default true,
  security_review_required boolean default true,
  privacy_review_required boolean default true,
  blocked boolean default false,
  blocked_reason text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.github_repository_categories (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  category text not null,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  review_status text not null default 'pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_license_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  license_risk text not null default 'review_required',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_security_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  security_status text not null default 'review_required',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_privacy_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  privacy_status text not null default 'review_required',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_maintenance_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  maintenance_status text not null default 'unknown',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_business_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  business_value_score integer not null default 0,
  marketability_score integer not null default 0,
  profitability_score integer not null default 0,
  usability_score integer not null default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_product_fit (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  product_name text not null,
  fit_score integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_feature_flags (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  feature_flag text not null,
  enabled boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_watchlist (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  watched_by_user_id uuid references auth.users(id) on delete set null,
  watch_status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_update_events (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_blocklist (
  id uuid primary key default gen_random_uuid(),
  repo_url text,
  signal text not null,
  reason text not null,
  created_at timestamptz default now()
);

create table if not exists public.github_repository_recommendations (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  recommendation text not null,
  status text not null default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_codex_prompts (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  prompt text not null,
  status text not null default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_audit_logs (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  risk_level text not null default 'medium',
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'manual_mode',
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.github_repository_score_history (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.github_repositories(id) on delete cascade,
  score integer not null default 0,
  reason text,
  created_at timestamptz default now()
);

create index if not exists github_repositories_repo_url_idx on public.github_repositories(repo_url);
create index if not exists github_repositories_score_idx on public.github_repositories(score);
create index if not exists github_repositories_blocked_idx on public.github_repositories(blocked);
create index if not exists github_repository_reviews_repo_idx on public.github_repository_reviews(repository_id);
create index if not exists github_repository_audit_logs_repo_idx on public.github_repository_audit_logs(repository_id);
create index if not exists github_repository_sync_jobs_status_idx on public.github_repository_sync_jobs(status);

alter table public.github_repositories enable row level security;
alter table public.github_repository_categories enable row level security;
alter table public.github_repository_reviews enable row level security;
alter table public.github_repository_license_reviews enable row level security;
alter table public.github_repository_security_reviews enable row level security;
alter table public.github_repository_privacy_reviews enable row level security;
alter table public.github_repository_maintenance_reviews enable row level security;
alter table public.github_repository_business_reviews enable row level security;
alter table public.github_repository_product_fit enable row level security;
alter table public.github_repository_feature_flags enable row level security;
alter table public.github_repository_watchlist enable row level security;
alter table public.github_repository_update_events enable row level security;
alter table public.github_repository_blocklist enable row level security;
alter table public.github_repository_recommendations enable row level security;
alter table public.github_repository_codex_prompts enable row level security;
alter table public.github_repository_audit_logs enable row level security;
alter table public.github_repository_sync_jobs enable row level security;
alter table public.github_repository_score_history enable row level security;

drop policy if exists "authenticated can read github repositories" on public.github_repositories;
create policy "authenticated can read github repositories" on public.github_repositories
for select using (auth.role() = 'authenticated');

drop policy if exists "platform admins can manage github repositories" on public.github_repositories;
create policy "platform admins can manage github repositories" on public.github_repositories
for all using (coalesce(auth.jwt() ->> 'app_role', '') in ('platform_owner', 'platform_admin') or auth.role() = 'service_role')
with check (coalesce(auth.jwt() ->> 'app_role', '') in ('platform_owner', 'platform_admin') or auth.role() = 'service_role');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'github_repository_categories',
    'github_repository_reviews',
    'github_repository_license_reviews',
    'github_repository_security_reviews',
    'github_repository_privacy_reviews',
    'github_repository_maintenance_reviews',
    'github_repository_business_reviews',
    'github_repository_product_fit',
    'github_repository_feature_flags',
    'github_repository_watchlist',
    'github_repository_update_events',
    'github_repository_blocklist',
    'github_repository_recommendations',
    'github_repository_codex_prompts',
    'github_repository_audit_logs',
    'github_repository_sync_jobs',
    'github_repository_score_history'
  ]
  loop
    execute format('drop policy if exists "platform admins can manage %1$s" on public.%1$I', table_name);
    execute format('create policy "platform admins can manage %1$s" on public.%1$I for all using (coalesce(auth.jwt() ->> ''app_role'', '''') in (''platform_owner'', ''platform_admin'') or auth.role() = ''service_role'') with check (coalesce(auth.jwt() ->> ''app_role'', '''') in (''platform_owner'', ''platform_admin'') or auth.role() = ''service_role'')', table_name);
  end loop;
end $$;

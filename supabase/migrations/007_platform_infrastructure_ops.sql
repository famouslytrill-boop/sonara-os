create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.system_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source text not null,
  actor_id uuid null,
  actor_email text null,
  entity_type text null,
  entity_id text null,
  severity text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists system_audit_events_created_at_idx
  on public.system_audit_events (created_at desc);

create index if not exists system_audit_events_event_type_idx
  on public.system_audit_events (event_type);

create index if not exists system_audit_events_source_idx
  on public.system_audit_events (source);

create index if not exists system_audit_events_severity_idx
  on public.system_audit_events (severity);

create index if not exists system_audit_events_actor_id_idx
  on public.system_audit_events (actor_id);

comment on table public.system_audit_events is
  'System-level audit events for checkout, webhooks, database operations, exports, login, billing, and admin workflows.';

comment on column public.system_audit_events.metadata is
  'Operational metadata. Never store raw secrets, payment card data, or unredacted credentials.';

create table if not exists public.platform_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'queued',
  priority int not null default 5,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_jobs_status_idx
  on public.platform_jobs (status);

create index if not exists platform_jobs_job_type_idx
  on public.platform_jobs (job_type);

create index if not exists platform_jobs_priority_idx
  on public.platform_jobs (priority);

create index if not exists platform_jobs_created_at_idx
  on public.platform_jobs (created_at desc);

drop trigger if exists set_platform_jobs_updated_at on public.platform_jobs;
create trigger set_platform_jobs_updated_at
  before update on public.platform_jobs
  for each row execute function public.set_updated_at();

comment on table public.platform_jobs is
  'Tracks optional Python/local/CI operations jobs such as exports, analytics, database audits, health checks, and readiness scans.';

create table if not exists public.db_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  check_name text not null,
  status text not null,
  score numeric null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists db_health_snapshots_check_name_idx
  on public.db_health_snapshots (check_name);

create index if not exists db_health_snapshots_status_idx
  on public.db_health_snapshots (status);

create index if not exists db_health_snapshots_created_at_idx
  on public.db_health_snapshots (created_at desc);

comment on table public.db_health_snapshots is
  'Stores database health check results created by local, CI, or trusted operations scripts.';

create table if not exists public.creator_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  session_id text null,
  event_name text not null,
  route text null,
  product_area text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creator_activity_events_user_id_idx
  on public.creator_activity_events (user_id);

create index if not exists creator_activity_events_event_name_idx
  on public.creator_activity_events (event_name);

create index if not exists creator_activity_events_route_idx
  on public.creator_activity_events (route);

create index if not exists creator_activity_events_product_area_idx
  on public.creator_activity_events (product_area);

create index if not exists creator_activity_events_created_at_idx
  on public.creator_activity_events (created_at desc);

comment on table public.creator_activity_events is
  'First-party creator product activity events. Do not store secrets, payment card data, or sensitive private lyrics in metadata.';

alter table public.system_audit_events enable row level security;
alter table public.platform_jobs enable row level security;
alter table public.db_health_snapshots enable row level security;
alter table public.creator_activity_events enable row level security;

drop policy if exists "Users can read own audit events" on public.system_audit_events;
create policy "Users can read own audit events"
  on public.system_audit_events
  for select
  to authenticated
  using (actor_id = auth.uid());

drop policy if exists "Service role can manage audit events" on public.system_audit_events;
drop policy if exists "Service role can manage platform jobs" on public.platform_jobs;
drop policy if exists "Service role can manage db health snapshots" on public.db_health_snapshots;

drop policy if exists "Users can read own creator activity" on public.creator_activity_events;
create policy "Users can read own creator activity"
  on public.creator_activity_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Service role can manage creator activity" on public.creator_activity_events;

-- No anonymous policies are intentionally defined for these tables.
-- The Supabase service role bypasses RLS by design and must remain server-only.
-- Do not add broad public policies to these private operations tables.

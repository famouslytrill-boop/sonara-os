-- SONARA company-wide product lifecycle operating system.
-- Additive, tenant-scoped, evidence-led, studio-neutral, and server-write-controlled.

create extension if not exists pgcrypto;

create table if not exists public.product_lifecycle_initiatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  studio_key text not null check (studio_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  name text not null,
  problem_statement text,
  target_audience text,
  value_proposition text,
  product_goal text,
  lifecycle_stage text not null default 'discover' check (lifecycle_stage in ('discover','validate','plan','build','beta','launch','learn_scale')),
  status text not null default 'active' check (status in ('draft','active','on_hold','pivoting','launched','scaled','stopped','archived')),
  primary_metric text,
  target_metric numeric(18,4),
  budget_cents bigint check (budget_cents is null or budget_cents >= 0),
  target_launch_date date,
  latest_decision text check (latest_decision is null or latest_decision in ('advance','hold','pivot','stop','scale')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_lifecycle_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.product_lifecycle_initiatives(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  evidence_type text not null check (evidence_type in ('interview','survey','market_size','competitor','pricing','regulatory','usability','analytics','security','accessibility','support','other')),
  source text not null,
  summary text not null,
  confidence text not null default 'unknown' check (confidence in ('unknown','low','medium','high','verified')),
  participant_count integer check (participant_count is null or participant_count >= 0),
  evidence_reference text,
  collected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_lifecycle_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.product_lifecycle_initiatives(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  requirement_type text not null check (requirement_type in ('user_story','feature','non_goal','risk','metric','compliance','support','operation')),
  title text not null,
  detail text,
  priority text not null default 'must' check (priority in ('must','should','could','wont')),
  acceptance_criteria text,
  status text not null default 'proposed' check (status in ('proposed','approved','in_progress','done','rejected','deferred')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_lifecycle_iterations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.product_lifecycle_initiatives(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  iteration_number integer not null check (iteration_number > 0),
  goal text not null,
  starts_at date,
  ends_at date,
  status text not null default 'planned' check (status in ('planned','active','review','completed','cancelled')),
  definition_of_done text,
  review_notes text,
  retrospective_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (initiative_id, iteration_number)
);

create table if not exists public.product_lifecycle_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.product_lifecycle_initiatives(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  beta_cohort text,
  category text not null check (category in ('usability','functionality','design','performance','satisfaction','accessibility','security','reliability','pricing','support','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  sentiment text not null default 'neutral' check (sentiment in ('negative','neutral','positive','mixed')),
  summary text not null,
  evidence_reference text,
  status text not null default 'new' check (status in ('new','triaged','planned','resolved','declined','duplicate')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_lifecycle_stage_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.product_lifecycle_initiatives(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  stage text not null check (stage in ('discover','validate','plan','build','beta','launch','learn_scale')),
  decision text not null check (decision in ('advance','hold','pivot','stop','scale')),
  readiness_score integer not null check (readiness_score between 0 and 100),
  checklist jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  rationale text not null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.product_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid references public.product_lifecycle_initiatives(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_status text not null default 'recorded' check (event_status in ('recorded','success','failed','denied','review_required')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_lifecycle_initiatives_org_stage_idx on public.product_lifecycle_initiatives (organization_id, studio_key, lifecycle_stage, updated_at desc);
create index if not exists product_lifecycle_evidence_initiative_idx on public.product_lifecycle_evidence (initiative_id, evidence_type, collected_at desc);
create index if not exists product_lifecycle_requirements_initiative_idx on public.product_lifecycle_requirements (initiative_id, priority, status, updated_at desc);
create index if not exists product_lifecycle_iterations_initiative_idx on public.product_lifecycle_iterations (initiative_id, iteration_number desc);
create index if not exists product_lifecycle_feedback_triage_idx on public.product_lifecycle_feedback (initiative_id, status, severity, created_at desc);
create index if not exists product_lifecycle_reviews_initiative_idx on public.product_lifecycle_stage_reviews (initiative_id, stage, created_at desc);
create index if not exists product_lifecycle_events_initiative_idx on public.product_lifecycle_events (initiative_id, created_at desc);

alter table public.product_lifecycle_initiatives enable row level security;
alter table public.product_lifecycle_evidence enable row level security;
alter table public.product_lifecycle_requirements enable row level security;
alter table public.product_lifecycle_iterations enable row level security;
alter table public.product_lifecycle_feedback enable row level security;
alter table public.product_lifecycle_stage_reviews enable row level security;
alter table public.product_lifecycle_events enable row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'product_lifecycle_initiatives',
    'product_lifecycle_evidence',
    'product_lifecycle_requirements',
    'product_lifecycle_iterations',
    'product_lifecycle_feedback',
    'product_lifecycle_stage_reviews',
    'product_lifecycle_events'
  ]
  loop
    execute format('drop policy if exists "product lifecycle members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "product lifecycle members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      relation_name
    );
    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- Lifecycle writes are mediated by the authenticated SONARA server.
revoke insert, update, delete on public.product_lifecycle_initiatives from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_evidence from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_requirements from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_iterations from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_feedback from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_stage_reviews from anon, authenticated;
revoke insert, update, delete on public.product_lifecycle_events from anon, authenticated;

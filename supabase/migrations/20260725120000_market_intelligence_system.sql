-- SONARA company-wide market intelligence operating system.
-- Evidence-backed, tenant-scoped, server-write-controlled, and linked to Product Lifecycle.

create extension if not exists pgcrypto;

create table if not exists public.market_intelligence_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  studio_key text not null check (studio_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  segment_key text not null,
  name text not null,
  description text,
  customer_type text,
  geography text,
  jobs_to_be_done jsonb not null default '[]'::jsonb,
  pain_points jsonb not null default '[]'::jsonb,
  buying_triggers jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','watch','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, studio_key, segment_key)
);

create table if not exists public.market_intelligence_competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  studio_key text not null check (studio_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  name text not null,
  category text,
  source_url text not null check (source_url ~ '^https://'),
  verified_at timestamptz not null,
  entry_price numeric(18,4) check (entry_price is null or entry_price >= 0),
  currency text not null default 'USD',
  billing_period text not null default 'custom' check (billing_period in ('free','monthly','annual','usage','percentage','custom','mixed')),
  pricing_model text,
  capabilities jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'active' check (status in ('active','watch','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  studio_key text not null check (studio_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  signal_type text not null check (signal_type in ('market_size','customer_need','pricing','competitor','technology','regulation','channel','behavior','risk')),
  title text not null,
  summary text not null,
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  observed_at timestamptz not null,
  expires_at timestamptz,
  confidence text not null check (confidence in ('low','medium','high','authoritative')),
  metric_name text,
  metric_value numeric(24,6),
  metric_unit text,
  geography text,
  segment_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.market_intelligence_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  product_lifecycle_initiative_id uuid references public.product_lifecycle_initiatives(id) on delete set null,
  studio_key text not null check (studio_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  name text not null,
  problem text not null,
  target_segment text not null,
  proposed_value text not null,
  demand_evidence integer not null default 0 check (demand_evidence between 0 and 25),
  willingness_to_pay integer not null default 0 check (willingness_to_pay between 0 and 20),
  strategic_fit integer not null default 0 check (strategic_fit between 0 and 20),
  underserved_need integer not null default 0 check (underserved_need between 0 and 15),
  differentiation integer not null default 0 check (differentiation between 0 and 10),
  channel_access integer not null default 0 check (channel_access between 0 and 10),
  delivery_complexity integer not null default 0 check (delivery_complexity between 0 and 15),
  compliance_risk integer not null default 0 check (compliance_risk between 0 and 15),
  market_score integer not null default 0 check (market_score between 0 and 100),
  recommendation text not null default 'hold' check (recommendation in ('prioritize','validate','watch','hold')),
  state text not null default 'watch' check (state in ('watch','validate','prioritized','building','launched','hold','rejected')),
  owner_name text,
  next_review_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_intelligence_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid not null references public.market_intelligence_opportunities(id) on delete cascade,
  decision text not null check (decision in ('prioritize','validate','watch','hold','reject')),
  rationale text not null,
  market_score integer not null check (market_score between 0 and 100),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.market_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.product_lifecycle_initiatives
  add column if not exists market_opportunity_id uuid references public.market_intelligence_opportunities(id) on delete set null;

create index if not exists market_segments_org_studio_status_idx on public.market_intelligence_segments (organization_id, studio_key, status, updated_at desc);
create index if not exists market_competitors_org_studio_verified_idx on public.market_intelligence_competitors (organization_id, studio_key, verified_at desc);
create index if not exists market_signals_org_studio_observed_idx on public.market_intelligence_signals (organization_id, studio_key, signal_type, observed_at desc);
create index if not exists market_opportunities_org_score_idx on public.market_intelligence_opportunities (organization_id, studio_key, state, market_score desc, updated_at desc);
create index if not exists market_opportunities_lifecycle_idx on public.market_intelligence_opportunities (product_lifecycle_initiative_id) where product_lifecycle_initiative_id is not null;
create index if not exists market_reviews_opportunity_created_idx on public.market_intelligence_reviews (opportunity_id, created_at desc);
create index if not exists market_events_org_created_idx on public.market_intelligence_events (organization_id, created_at desc);

alter table public.market_intelligence_segments enable row level security;
alter table public.market_intelligence_competitors enable row level security;
alter table public.market_intelligence_signals enable row level security;
alter table public.market_intelligence_opportunities enable row level security;
alter table public.market_intelligence_reviews enable row level security;
alter table public.market_intelligence_events enable row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'market_intelligence_segments',
    'market_intelligence_competitors',
    'market_intelligence_signals',
    'market_intelligence_opportunities',
    'market_intelligence_reviews',
    'market_intelligence_events'
  ]
  loop
    execute format('drop policy if exists "market intelligence members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "market intelligence members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      relation_name
    );
    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- Market intelligence writes are mediated by authenticated SONARA server routes.
revoke insert, update, delete on public.market_intelligence_segments from anon, authenticated;
revoke insert, update, delete on public.market_intelligence_competitors from anon, authenticated;
revoke insert, update, delete on public.market_intelligence_signals from anon, authenticated;
revoke insert, update, delete on public.market_intelligence_opportunities from anon, authenticated;
revoke insert, update, delete on public.market_intelligence_reviews from anon, authenticated;
revoke insert, update, delete on public.market_intelligence_events from anon, authenticated;

grant select, insert, update, delete on public.market_intelligence_segments to service_role;
grant select, insert, update, delete on public.market_intelligence_competitors to service_role;
grant select, insert, update, delete on public.market_intelligence_signals to service_role;
grant select, insert, update, delete on public.market_intelligence_opportunities to service_role;
grant select, insert, update, delete on public.market_intelligence_reviews to service_role;
grant select, insert, update, delete on public.market_intelligence_events to service_role;

notify pgrst, 'reload schema';

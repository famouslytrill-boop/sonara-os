-- SONARA Research Lab intake tables.
-- Additive scaffold only. Review in Supabase before production push.

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  source_type text not null,
  source_url text,
  permission_status text not null default 'needs_review',
  crawl_status text not null default 'disabled',
  crawl_depth integer not null default 1,
  rate_limit_note text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.open_source_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null,
  category text not null,
  license text,
  license_risk text not null default 'unknown',
  commercial_use_status text not null default 'needs_review',
  integration_status text not null default 'not_reviewed',
  recommended_action text,
  official_url text,
  repo_url text,
  safety_boundaries jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.tool_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  open_source_tool_id uuid references public.open_source_tools(id) on delete cascade,
  review_type text not null,
  status text not null default 'needs_review',
  reviewer_role text,
  decision text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.research_sources enable row level security;
alter table public.open_source_tools enable row level security;
alter table public.tool_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'research_sources'
      and policyname = 'org members can read research sources'
  ) then
    create policy "org members can read research sources"
      on public.research_sources
      for select
      using (
        exists (
          select 1 from public.organization_memberships memberships
          where memberships.organization_id = research_sources.organization_id
            and memberships.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'open_source_tools'
      and policyname = 'org members can read open source tools'
  ) then
    create policy "org members can read open source tools"
      on public.open_source_tools
      for select
      using (
        exists (
          select 1 from public.organization_memberships memberships
          where memberships.organization_id = open_source_tools.organization_id
            and memberships.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tool_reviews'
      and policyname = 'org members can read tool reviews'
  ) then
    create policy "org members can read tool reviews"
      on public.tool_reviews
      for select
      using (
        exists (
          select 1 from public.organization_memberships memberships
          where memberships.organization_id = tool_reviews.organization_id
            and memberships.user_id = auth.uid()
        )
      );
  end if;
end $$;

comment on table public.research_sources is
  'User-authorized or public research source intake records. Live crawling remains disabled until reviewed.';

comment on table public.open_source_tools is
  'Governed external project intake candidates. A row does not mean code is copied, installed, or approved.';

comment on table public.tool_reviews is
  'License, security, safety, commercial-use, maintenance, and product-fit review notes for external tools.';

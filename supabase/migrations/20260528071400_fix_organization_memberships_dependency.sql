-- SONARA organization membership prerequisite.
-- This migration is intentionally ordered before the Research Lab intake migration
-- because those RLS policies reference public.organization_memberships.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text,
  owner_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.organizations
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists slug text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists organizations_slug_unique_idx
  on public.organizations (slug)
  where slug is not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  unique (organization_id, user_id)
);

alter table public.organization_memberships
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists role text not null default 'member',
  add column if not exists status text not null default 'active';

create index if not exists organization_memberships_organization_id_idx
  on public.organization_memberships (organization_id);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index if not exists organization_memberships_status_idx
  on public.organization_memberships (status);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

drop policy if exists "users can read organizations through active membership" on public.organizations;
create policy "users can read organizations through active membership"
  on public.organizations
  for select
  using (
    exists (
      select 1
      from public.organization_memberships memberships
      where memberships.organization_id = organizations.id
        and memberships.user_id = auth.uid()
        and memberships.status = 'active'
    )
  );

drop policy if exists "service role can manage organizations" on public.organizations;
create policy "service role can manage organizations"
  on public.organizations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "users can read own organization memberships" on public.organization_memberships;
create policy "users can read own organization memberships"
  on public.organization_memberships
  for select
  using (
    user_id = auth.uid()
    and status = 'active'
  );

drop policy if exists "service role can manage organization memberships" on public.organization_memberships;
create policy "service role can manage organization memberships"
  on public.organization_memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

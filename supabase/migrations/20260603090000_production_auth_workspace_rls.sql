-- Production auth/workspace bootstrap and RLS hardening.
-- Append-only: do not edit historical migrations or schema_migrations rows.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  owner_id uuid references auth.users(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.organizations
  add column if not exists slug text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists organizations_slug_unique_idx
  on public.organizations (slug)
  where slug is not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_memberships
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_memberships_role_allowed_chk'
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_role_allowed_chk
      check (role in ('owner','admin','developer','support','business_owner','creator','agency','member','viewer'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organization_memberships_status_allowed_chk'
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_status_allowed_chk
      check (status in ('active','invited','suspended'));
  end if;
end $$;

create index if not exists organization_memberships_user_status_idx
  on public.organization_memberships (user_id, status);

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = auth.uid()
      and memberships.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = auth.uid()
      and memberships.status = 'active'
      and memberships.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_owner_or_admin(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(_org_id, array['owner','admin']);
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles
  for select
  using (id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "service role can manage profiles" on public.profiles;
create policy "service role can manage profiles"
  on public.profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "members can read their organizations" on public.organizations;
create policy "members can read their organizations"
  on public.organizations
  for select
  using (public.is_org_member(id) or auth.role() = 'service_role');

drop policy if exists "owners and admins can update organizations" on public.organizations;
create policy "owners and admins can update organizations"
  on public.organizations
  for update
  using (public.is_org_owner_or_admin(id))
  with check (public.is_org_owner_or_admin(id));

drop policy if exists "service role can manage organizations" on public.organizations;
create policy "service role can manage organizations"
  on public.organizations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "users can read organization memberships" on public.organization_memberships;
create policy "users can read organization memberships"
  on public.organization_memberships
  for select
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id)
    or auth.role() = 'service_role'
  );

drop policy if exists "owners and admins can manage organization memberships" on public.organization_memberships;
create policy "owners and admins can manage organization memberships"
  on public.organization_memberships
  for all
  using (public.is_org_owner_or_admin(organization_id))
  with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists "service role can manage organization memberships" on public.organization_memberships;
create policy "service role can manage organization memberships"
  on public.organization_memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'bookings',
    'payments',
    'files',
    'reviews',
    'campaigns',
    'research_snapshots',
    'business_profiles',
    'creator_profiles',
    'growth_workspaces',
    'products',
    'integrations'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "org members can read %1$s" on public.%1$I', table_name);
      execute format('create policy "org members can read %1$s" on public.%1$I for select using (public.is_org_member(organization_id) or auth.role() = ''service_role'')', table_name);
      execute format('drop policy if exists "active org members can write %1$s" on public.%1$I', table_name);
      execute format('create policy "active org members can write %1$s" on public.%1$I for insert with check (public.is_org_member(organization_id))', table_name);
      execute format('drop policy if exists "owners admins members can update %1$s" on public.%1$I', table_name);
      execute format('create policy "owners admins members can update %1$s" on public.%1$I for update using (public.has_org_role(organization_id, array[''owner'',''admin'',''member''])) with check (public.has_org_role(organization_id, array[''owner'',''admin'',''member'']))', table_name);
      execute format('drop policy if exists "service role can manage %1$s" on public.%1$I', table_name);
      execute format('create policy "service role can manage %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', table_name);
    end if;
  end loop;
end $$;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  risk_level text not null default 'low',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.audit_logs enable row level security;

drop policy if exists "owners and admins can read audit logs" on public.audit_logs;
create policy "owners and admins can read audit logs"
  on public.audit_logs
  for select
  using (organization_id is not null and public.is_org_owner_or_admin(organization_id));

drop policy if exists "service role can manage audit logs" on public.audit_logs;
create policy "service role can manage audit logs"
  on public.audit_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

do $$
declare
  table_name text;
begin
  foreach table_name in array array['subscriptions', 'billing_customers', 'webhook_events']
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists "org members can read %1$s" on public.%1$I', table_name);
      execute format('create policy "org members can read %1$s" on public.%1$I for select using (organization_id is not null and public.is_org_member(organization_id))', table_name);
      execute format('drop policy if exists "service role can manage %1$s" on public.%1$I', table_name);
      execute format('create policy "service role can manage %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', table_name);
    end if;
  end loop;
end $$;

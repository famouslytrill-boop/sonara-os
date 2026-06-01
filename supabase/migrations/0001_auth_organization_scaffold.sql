-- SONARA One auth and organization scaffold.
-- Review before applying to any live Supabase project.
-- Service-role keys must never be exposed client-side.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key,
  display_name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null check (kind in ('business', 'creator-studio', 'agency', 'internal')),
  status text not null default 'setup' check (status in ('active', 'setup', 'suspended', 'archived')),
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer', 'developer', 'support')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'removed')),
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.user_profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_org_idx on public.organization_members(organization_id);
create index if not exists audit_logs_org_created_at_idx on public.audit_logs(organization_id, created_at desc);

alter table public.user_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_logs enable row level security;

-- RLS helper convention:
-- auth.uid() must match public.user_profiles.id after Supabase auth is wired.

create policy "profiles_select_own"
on public.user_profiles
for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.user_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_member"
on public.organizations
for select
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy "organizations_update_owner_admin"
on public.organizations
for update
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  )
);

create policy "memberships_select_same_org"
on public.organization_members
for select
using (
  exists (
    select 1
    from public.organization_members viewer_membership
    where viewer_membership.organization_id = organization_members.organization_id
      and viewer_membership.user_id = auth.uid()
      and viewer_membership.status = 'active'
  )
);

create policy "memberships_manage_owner_admin"
on public.organization_members
for all
using (
  exists (
    select 1
    from public.organization_members manager_membership
    where manager_membership.organization_id = organization_members.organization_id
      and manager_membership.user_id = auth.uid()
      and manager_membership.status = 'active'
      and manager_membership.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_members manager_membership
    where manager_membership.organization_id = organization_members.organization_id
      and manager_membership.user_id = auth.uid()
      and manager_membership.status = 'active'
      and manager_membership.role in ('owner', 'admin')
  )
);

create policy "audit_logs_select_admin"
on public.audit_logs
for select
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = audit_logs.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'developer', 'support')
  )
);

create policy "audit_logs_insert_member"
on public.audit_logs
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = audit_logs.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

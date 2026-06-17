-- SONARA Industries Business Builder employee portal foundation.
-- Schema-only migration. No seed users, real emails, passwords, tokens, API keys, webhook secrets, or provider credentials.
-- Employee passwords are owned by Supabase Auth. Invite records store token_hash only, never raw invite tokens.

create extension if not exists pgcrypto;

create table if not exists public.business_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  status text not null default 'active' check (status in ('active', 'disabled', 'pending')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.business_employee_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
  invited_email text not null,
  invited_name text null,
  role text not null check (role in ('manager', 'employee')),
  permissions text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_by_user_id uuid null references auth.users(id) on delete set null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz null
);

alter table public.business_workspaces
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.business_memberships
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists workspace_id uuid references public.business_workspaces(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now();

alter table public.business_employee_invites
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists workspace_id uuid references public.business_workspaces(id) on delete cascade,
  add column if not exists invited_email text,
  add column if not exists invited_name text null,
  add column if not exists role text,
  add column if not exists permissions text[] not null default '{}'::text[],
  add column if not exists status text not null default 'pending',
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists created_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists accepted_at timestamptz null;

create unique index if not exists business_workspaces_org_name_key
on public.business_workspaces(organization_id, lower(name));

create index if not exists business_workspaces_owner_idx
on public.business_workspaces(owner_user_id);

create index if not exists business_memberships_user_idx
on public.business_memberships(user_id);

create index if not exists business_memberships_workspace_role_idx
on public.business_memberships(workspace_id, role);

create unique index if not exists business_memberships_workspace_user_key
on public.business_memberships(workspace_id, user_id);

create unique index if not exists business_employee_invites_token_hash_key
on public.business_employee_invites(token_hash);

create index if not exists business_employee_invites_workspace_status_idx
on public.business_employee_invites(workspace_id, status);

create index if not exists business_employee_invites_email_idx
on public.business_employee_invites(lower(invited_email));

alter table public.business_workspaces enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_employee_invites enable row level security;

grant select on public.business_workspaces to authenticated;
grant select on public.business_memberships to authenticated;
grant select, insert, update on public.business_employee_invites to authenticated;
grant select, insert, update, delete on public.business_workspaces to service_role;
grant select, insert, update, delete on public.business_memberships to service_role;
grant select, insert, update, delete on public.business_employee_invites to service_role;

drop policy if exists "business_workspaces_member_select"
on public.business_workspaces;

create policy "business_workspaces_member_select"
on public.business_workspaces
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_workspaces.id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
  )
);

drop policy if exists "business_memberships_self_or_manager_select"
on public.business_memberships;

create policy "business_memberships_self_or_manager_select"
on public.business_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_memberships.workspace_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "business_employee_invites_manager_select"
on public.business_employee_invites;

create policy "business_employee_invites_manager_select"
on public.business_employee_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_employee_invites.workspace_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "business_employee_invites_manager_insert"
on public.business_employee_invites;

create policy "business_employee_invites_manager_insert"
on public.business_employee_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_employee_invites.workspace_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "business_employee_invites_manager_update"
on public.business_employee_invites;

create policy "business_employee_invites_manager_update"
on public.business_employee_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_employee_invites.workspace_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.business_memberships bm
    where bm.workspace_id = business_employee_invites.workspace_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'manager')
  )
);

drop policy if exists "service_role_business_workspaces_all"
on public.business_workspaces;

create policy "service_role_business_workspaces_all"
on public.business_workspaces
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_business_memberships_all"
on public.business_memberships;

create policy "service_role_business_memberships_all"
on public.business_memberships
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_business_employee_invites_all"
on public.business_employee_invites;

create policy "service_role_business_employee_invites_all"
on public.business_employee_invites
for all
to service_role
using (true)
with check (true);

drop trigger if exists business_workspaces_set_updated_at
on public.business_workspaces;

create trigger business_workspaces_set_updated_at
before update on public.business_workspaces
for each row execute function public.set_updated_at();

comment on table public.business_workspaces is 'Organization-scoped Business Builder workspaces. Contains no provider credentials.';
comment on table public.business_memberships is 'Business Builder membership metadata linked to Supabase Auth users. Contains no passwords.';
comment on table public.business_employee_invites is 'Business Builder employee invite metadata. Stores token_hash only and never raw invite tokens or passwords.';

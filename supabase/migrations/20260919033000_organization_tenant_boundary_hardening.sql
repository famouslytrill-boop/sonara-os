-- Canonical organization / tenant authorization hardening.
--
-- Production drift reintroduced an older organization_members authorization
-- source even though the application schema uses organization_memberships.
-- This migration makes the canonical membership table authoritative again,
-- narrows Data API grants on the organization root tables, and quarantines the
-- legacy table when it exists. It is intentionally additive/non-destructive:
-- no tenant/customer rows are deleted and the legacy table is not dropped.

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  );
$$;

-- Keep the historical scalar overload because live policies/functions may
-- still call has_org_role(uuid, text). It must resolve against the same
-- canonical membership source and active-status rule as the array overload.
create or replace function public.has_org_role(target_organization_id uuid, target_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and memberships.role = target_role
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
      and memberships.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_owner_or_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(target_organization_id, array['owner','admin']::text[]);
$$;

-- Policy helpers are intentionally callable by authenticated users because RLS
-- evaluates them as that caller. PUBLIC/anon execution is unnecessary.
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.is_org_owner_or_admin(uuid) from public;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated, service_role;

-- Data API least privilege for the organization authority tables. The server
-- service role retains full access; signed-in users receive only operations
-- backed by explicit RLS policies; anon receives no direct table privileges.
revoke all privileges on table public.organizations from anon, authenticated;
revoke all privileges on table public.organization_memberships from anon, authenticated;
revoke all privileges on table public.business_memberships from anon, authenticated;

grant select, update on table public.organizations to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.business_memberships to authenticated;

grant all privileges on table public.organizations to service_role;
grant all privileges on table public.organization_memberships to service_role;
grant all privileges on table public.business_memberships to service_role;

-- Collapse the organization root policies to explicit authenticated/service
-- roles instead of broad PUBLIC policies guarded indirectly by auth.role().
drop policy if exists "members can read their organizations" on public.organizations;
drop policy if exists "users can read organizations through active membership" on public.organizations;
drop policy if exists "organizations_member_select" on public.organizations;
create policy "organizations_member_select"
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

drop policy if exists "owners and admins can update organizations" on public.organizations;
drop policy if exists "organizations_owner_update" on public.organizations;
create policy "organizations_owner_update"
  on public.organizations
  for update
  to authenticated
  using (public.is_org_owner_or_admin(id))
  with check (public.is_org_owner_or_admin(id));

drop policy if exists "service role can manage organizations" on public.organizations;
create policy "service_role_organizations_all"
  on public.organizations
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "users can read organization memberships" on public.organization_memberships;
drop policy if exists "users can read own organization memberships" on public.organization_memberships;
create policy "organization_memberships_member_select"
  on public.organization_memberships
  for select
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and status = 'active'
    )
    or public.is_org_member(organization_id)
  );

-- Membership mutation stays server-authoritative. This avoids giving a tenant
-- member a direct Data API path for role/status changes; owner/admin workflows
-- still go through audited server code using the service role.
drop policy if exists "owners and admins can manage organization memberships" on public.organization_memberships;
drop policy if exists "memberships_manage_owner_admin" on public.organization_memberships;
drop policy if exists "service role can manage organization memberships" on public.organization_memberships;
create policy "service_role_organization_memberships_all"
  on public.organization_memberships
  for all
  to service_role
  using (true)
  with check (true);

-- The authorization row must not be able to name organization A while pointing
-- at a workspace owned by organization B. A UUID primary-key FK proves only
-- that the workspace exists; this composite FK proves that it exists inside
-- the same tenant. Keep the original workspace_id FK as well -- this is an
-- additive tenant-integrity constraint.
create unique index if not exists business_workspaces_organization_id_id_uidx
  on public.business_workspaces (organization_id, id);

do $tenant_fk$
begin
  if to_regclass('public.business_memberships') is not null
     and to_regclass('public.business_workspaces') is not null
     and not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.business_memberships'::regclass
         and conname = 'business_memberships_org_workspace_fkey'
     ) then
    alter table public.business_memberships
      add constraint business_memberships_org_workspace_fkey
      foreign key (organization_id, workspace_id)
      references public.business_workspaces (organization_id, id)
      on delete cascade
      not valid;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.business_memberships'::regclass
      and conname = 'business_memberships_org_workspace_fkey'
      and not convalidated
  ) then
    alter table public.business_memberships
      validate constraint business_memberships_org_workspace_fkey;
  end if;
end
$tenant_fk$;

-- Production contains an older empty organization_members table from a prior
-- schema generation. Do not drop it here because undeclared legacy functions
-- may still depend on it; remove its direct customer-facing privileges instead.
do $legacy$
begin
  if to_regclass('public.organization_members') is not null then
    execute 'revoke all privileges on table public.organization_members from anon, authenticated';
    execute 'grant all privileges on table public.organization_members to service_role';
  end if;
end
$legacy$;

-- Migration-time assertions: drift back to the legacy identity source or broad
-- anonymous organization access must make the migration fail loudly.
do $assert$
declare
  member_definition text;
  scalar_role_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.is_org_member(uuid)'))
    into member_definition;
  select pg_get_functiondef(to_regprocedure('public.has_org_role(uuid,text)'))
    into scalar_role_definition;

  if member_definition is null
     or member_definition not like '%public.organization_memberships%'
     or member_definition not like '%status = ''active''%'
     or member_definition ~ 'public\.organization_members([^h]|$)' then
    raise exception 'tenant hardening failed: is_org_member is not canonical';
  end if;

  if scalar_role_definition is null
     or scalar_role_definition not like '%public.organization_memberships%'
     or scalar_role_definition not like '%status = ''active''%'
     or scalar_role_definition ~ 'public\.organization_members([^h]|$)' then
    raise exception 'tenant hardening failed: scalar has_org_role is not canonical';
  end if;

  if has_table_privilege('anon', 'public.organizations', 'select')
     or has_table_privilege('anon', 'public.organization_memberships', 'select')
     or has_table_privilege('anon', 'public.business_memberships', 'select') then
    raise exception 'tenant hardening failed: anon still has organization authority table access';
  end if;

  if has_table_privilege('authenticated', 'public.organization_memberships', 'insert')
     or has_table_privilege('authenticated', 'public.organization_memberships', 'update')
     or has_table_privilege('authenticated', 'public.organization_memberships', 'delete') then
    raise exception 'tenant hardening failed: authenticated can mutate organization memberships directly';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.business_memberships'::regclass
      and conname = 'business_memberships_org_workspace_fkey'
      and contype = 'f'
      and convalidated
      and pg_get_constraintdef(oid) like
        'FOREIGN KEY (organization_id, workspace_id) REFERENCES business_workspaces(organization_id, id)%'
  ) then
    raise exception 'tenant hardening failed: business membership can cross organization workspace boundary';
  end if;
end
$assert$;

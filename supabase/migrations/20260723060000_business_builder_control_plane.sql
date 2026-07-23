-- SONARA Business Builder control plane.
-- Additive, tenant-scoped, RLS-first, and compatible with the existing operations tables.

create extension if not exists pgcrypto;

alter table public.business_workspaces
  add column if not exists acquisition_mode text not null default 'created',
  add column if not exists legal_name text,
  add column if not exists public_name text,
  add column if not exists industry text,
  add column if not exists description text,
  add column if not exists website_url text,
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists currency_code text not null default 'usd',
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists version integer not null default 1;

create table if not exists public.business_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  channel_type text not null check (channel_type in ('website','online_store','marketplace','social','phone','email','physical_location','mobile','other')),
  name text not null,
  url text,
  status text not null default 'active' check (status in ('active','inactive','setup_required','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.business_permission_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  role_key text not null default 'viewer' check (role_key in ('owner','administrator','manager','employee','accountant','marketing','contractor','viewer')),
  permission_key text not null,
  location_id uuid references public.business_locations(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, permission_key, location_id)
);

create table if not exists public.business_ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  to_email text not null,
  to_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired','rejected')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_control_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid references public.business_workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  outcome text not null default 'success' check (outcome in ('success','denied','failed','setup_required')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Attach existing operational records to a specific business while preserving organization scope.
alter table public.business_locations add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.business_employee_profiles add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.business_service_catalog add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.business_bookings add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.business_assets add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.inventory_items add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.customer_records add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.order_records add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;
alter table public.organization_integrations add column if not exists business_id uuid references public.business_workspaces(id) on delete cascade;

create index if not exists business_workspaces_org_active_idx on public.business_workspaces (organization_id, created_at desc) where deleted_at is null;
create index if not exists business_channels_business_idx on public.business_channels (business_id, created_at desc);
create index if not exists business_permission_grants_lookup_idx on public.business_permission_grants (business_id, user_id, permission_key, status);
create index if not exists business_ownership_transfers_business_idx on public.business_ownership_transfers (business_id, status, created_at desc);
create index if not exists business_control_audit_business_idx on public.business_control_audit_events (business_id, created_at desc);
create index if not exists business_locations_business_idx on public.business_locations (business_id, created_at desc);
create index if not exists business_employee_profiles_business_idx on public.business_employee_profiles (business_id, created_at desc);
create index if not exists business_service_catalog_business_idx on public.business_service_catalog (business_id, created_at desc);
create index if not exists business_bookings_business_idx on public.business_bookings (business_id, created_at desc);
create index if not exists business_assets_business_idx on public.business_assets (business_id, created_at desc);
create index if not exists inventory_items_business_idx on public.inventory_items (business_id, created_at desc);
create index if not exists customer_records_business_idx on public.customer_records (business_id, created_at desc);
create index if not exists order_records_business_idx on public.order_records (business_id, created_at desc);
create index if not exists organization_integrations_business_idx on public.organization_integrations (business_id, created_at desc);

alter table public.business_channels enable row level security;
alter table public.business_permission_grants enable row level security;
alter table public.business_ownership_transfers enable row level security;
alter table public.business_control_audit_events enable row level security;

-- Organization members may read business control records. Owner/admin mutations are allowed through RLS;
-- the Express control plane also performs explicit resource and permission checks before service-role writes.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'business_channels',
    'business_permission_grants',
    'business_ownership_transfers',
    'business_control_audit_events'
  ]
  loop
    execute format('drop policy if exists "org members read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "org members read %1$s" on public.%1$I for select using (public.sonara_is_org_member(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "org owners manage %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "org owners manage %1$s" on public.%1$I for all using (public.is_org_owner_or_admin(organization_id)) with check (public.is_org_owner_or_admin(organization_id))',
      relation_name
    );

    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      relation_name
    );
  end loop;
end $$;

-- Existing operations tables retain their current policies. Add explicit organization-member reads and
-- owner/admin writes for the business-specific control path without removing existing policies.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'business_workspaces',
    'business_locations',
    'business_employee_profiles',
    'business_service_catalog',
    'business_bookings',
    'business_assets',
    'inventory_items',
    'customer_records',
    'order_records',
    'organization_integrations'
  ]
  loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('drop policy if exists "business control org read %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "business control org read %1$s" on public.%1$I for select using (organization_id is not null and public.sonara_is_org_member(organization_id))',
      relation_name
    );
    execute format('drop policy if exists "business control owner manage %1$s" on public.%1$I', relation_name);
    execute format(
      'create policy "business control owner manage %1$s" on public.%1$I for all using (organization_id is not null and public.is_org_owner_or_admin(organization_id)) with check (organization_id is not null and public.is_org_owner_or_admin(organization_id))',
      relation_name
    );
  end loop;
end $$;

comment on table public.business_channels is 'Physical and online channels controlled by one Business Builder workspace.';
comment on table public.business_permission_grants is 'Granular business, module, action, and optional location permissions.';
comment on table public.business_ownership_transfers is 'Auditable ownership-transfer requests; acceptance must be explicitly completed.';
comment on table public.business_control_audit_events is 'Append-only control-plane activity evidence for customer business administration.';
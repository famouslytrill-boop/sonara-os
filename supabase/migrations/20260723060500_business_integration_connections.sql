-- Business-scoped provider connections. Secret material is never stored here.
create table if not exists public.business_integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  organization_integration_id uuid references public.organization_integrations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  provider_key text not null,
  display_name text,
  connection_mode text not null default 'manual' check (connection_mode in ('api','oauth','manual','webhook','export')),
  connection_status text not null default 'setup_required' check (connection_status in ('not_connected','connected','setup_required','error','disabled')),
  capabilities jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  credential_reference text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider_key)
);

create index if not exists business_integration_connections_business_idx
  on public.business_integration_connections (business_id, connection_status, created_at desc);

alter table public.business_integration_connections enable row level security;

drop policy if exists "org members read business integration connections" on public.business_integration_connections;
create policy "org members read business integration connections"
  on public.business_integration_connections for select
  using (public.sonara_is_org_member(organization_id));

drop policy if exists "org owners manage business integration connections" on public.business_integration_connections;
create policy "org owners manage business integration connections"
  on public.business_integration_connections for all
  using (public.is_org_owner_or_admin(organization_id))
  with check (public.is_org_owner_or_admin(organization_id));

drop policy if exists "service role manages business integration connections" on public.business_integration_connections;
create policy "service role manages business integration connections"
  on public.business_integration_connections for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke select (credential_reference) on public.business_integration_connections from anon, authenticated;
comment on column public.business_integration_connections.credential_reference is 'Opaque server-side credential/vault reference only; never returned by Business Builder APIs.';
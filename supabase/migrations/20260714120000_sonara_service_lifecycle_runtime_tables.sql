-- SONARA Software-in-a-Service lifecycle and runtime alignment tables.
-- Additive and schema-only. Contains no seed users, emails, passwords, API keys,
-- webhook secrets, service-role keys, or provider credentials.
--
-- Two goals:
-- 1) Create the service lifecycle tables required by the platform upgrade:
--    service_catalog_items, service_requests, service_request_events,
--    service_deliverables, service_comments.
-- 2) Create tables server.js already reads/writes at runtime but that no prior
--    migration created: module_outputs, billing_subscriptions,
--    billing_entitlements, billing_webhook_events, user_roles,
--    business_memberships, business_employee_invites.
--
-- Reused equivalents (NOT re-created here, by design):
--   customer_workspaces  -> organizations
--   workspace_memberships -> organization_memberships
--   service_tasks         -> launch_checklist_items / employee_tasks
--   service_files         -> files / creator_assets

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Service lifecycle
-- ---------------------------------------------------------------------------

create table if not exists public.service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  product_key text not null default 'general',
  name text not null,
  summary text,
  price_note text,
  status text not null default 'active',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  product_key text not null default 'general',
  service_key text,
  service_name text not null,
  summary text,
  details text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_request_events (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid references public.service_requests(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete set null,
  product_key text not null default 'general',
  title text not null,
  notes text,
  status text not null default 'preparing',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  service_request_id uuid references public.service_requests(id) on delete cascade,
  service_deliverable_id uuid references public.service_deliverables(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Runtime alignment: tables server.js expects but no migration created
-- ---------------------------------------------------------------------------

create table if not exists public.module_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  product_key text not null,
  module_key text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_ref text,
  provider_subscription_ref text not null,
  plan_slug text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_ref)
);

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  entitlement_key text not null,
  status text not null default 'disabled',
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entitlement_key)
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text,
  livemode boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'processed',
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.business_employee_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid not null,
  invited_email text not null,
  invited_name text,
  role text not null default 'employee',
  permissions text[] not null default '{}'::text[],
  status text not null default 'pending',
  token_hash text not null,
  expires_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists service_catalog_items_status_idx on public.service_catalog_items(status);
create index if not exists service_catalog_items_product_key_idx on public.service_catalog_items(product_key);
create index if not exists service_requests_organization_id_idx on public.service_requests(organization_id);
create index if not exists service_requests_status_idx on public.service_requests(status);
create index if not exists service_requests_created_at_idx on public.service_requests(created_at desc);
create index if not exists service_request_events_request_id_idx on public.service_request_events(service_request_id);
create index if not exists service_request_events_organization_id_idx on public.service_request_events(organization_id);
create index if not exists service_deliverables_organization_id_idx on public.service_deliverables(organization_id);
create index if not exists service_deliverables_request_id_idx on public.service_deliverables(service_request_id);
create index if not exists service_deliverables_status_idx on public.service_deliverables(status);
create index if not exists service_comments_organization_id_idx on public.service_comments(organization_id);
create index if not exists service_comments_request_id_idx on public.service_comments(service_request_id);
create index if not exists module_outputs_organization_id_idx on public.module_outputs(organization_id);
create index if not exists module_outputs_product_module_idx on public.module_outputs(product_key, module_key);
create index if not exists billing_subscriptions_organization_id_idx on public.billing_subscriptions(organization_id);
create index if not exists billing_subscriptions_status_idx on public.billing_subscriptions(status);
create index if not exists billing_entitlements_organization_id_idx on public.billing_entitlements(organization_id);
create index if not exists billing_webhook_events_event_type_idx on public.billing_webhook_events(event_type);
create index if not exists billing_webhook_events_created_at_idx on public.billing_webhook_events(created_at desc);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists business_memberships_user_id_idx on public.business_memberships(user_id);
create index if not exists business_memberships_workspace_id_idx on public.business_memberships(workspace_id);
create index if not exists business_employee_invites_workspace_id_idx on public.business_employee_invites(workspace_id);
create index if not exists business_employee_invites_token_hash_idx on public.business_employee_invites(token_hash);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.service_catalog_items to anon, authenticated;
grant select on public.service_requests to authenticated;
grant select on public.service_request_events to authenticated;
grant select on public.service_deliverables to authenticated;
grant select, insert on public.service_comments to authenticated;
grant select on public.module_outputs to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_entitlements to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.business_memberships to authenticated;

grant select, insert, update, delete on public.service_catalog_items to service_role;
grant select, insert, update, delete on public.service_requests to service_role;
grant select, insert, update, delete on public.service_request_events to service_role;
grant select, insert, update, delete on public.service_deliverables to service_role;
grant select, insert, update, delete on public.service_comments to service_role;
grant select, insert, update, delete on public.module_outputs to service_role;
grant select, insert, update, delete on public.billing_subscriptions to service_role;
grant select, insert, update, delete on public.billing_entitlements to service_role;
grant select, insert, update, delete on public.billing_webhook_events to service_role;
grant select, insert, update, delete on public.user_roles to service_role;
grant select, insert, update, delete on public.business_memberships to service_role;
grant select, insert, update, delete on public.business_employee_invites to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.service_catalog_items enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;
alter table public.service_deliverables enable row level security;
alter table public.service_comments enable row level security;
alter table public.module_outputs enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.user_roles enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_employee_invites enable row level security;

drop policy if exists "anyone can read active catalog items" on public.service_catalog_items;
create policy "anyone can read active catalog items"
  on public.service_catalog_items
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "service role can manage catalog items" on public.service_catalog_items;
create policy "service role can manage catalog items"
  on public.service_catalog_items
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read service requests" on public.service_requests;
create policy "members can read service requests"
  on public.service_requests
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage service requests" on public.service_requests;
create policy "service role can manage service requests"
  on public.service_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read service request events" on public.service_request_events;
create policy "members can read service request events"
  on public.service_request_events
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage service request events" on public.service_request_events;
create policy "service role can manage service request events"
  on public.service_request_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read service deliverables" on public.service_deliverables;
create policy "members can read service deliverables"
  on public.service_deliverables
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage service deliverables" on public.service_deliverables;
create policy "service role can manage service deliverables"
  on public.service_deliverables
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read service comments" on public.service_comments;
create policy "members can read service comments"
  on public.service_comments
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "members can create service comments" on public.service_comments;
create policy "members can create service comments"
  on public.service_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists "service role can manage service comments" on public.service_comments;
create policy "service role can manage service comments"
  on public.service_comments
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read module outputs" on public.module_outputs;
create policy "members can read module outputs"
  on public.module_outputs
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage module outputs" on public.module_outputs;
create policy "service role can manage module outputs"
  on public.module_outputs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read billing subscriptions" on public.billing_subscriptions;
create policy "members can read billing subscriptions"
  on public.billing_subscriptions
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage billing subscriptions" on public.billing_subscriptions;
create policy "service role can manage billing subscriptions"
  on public.billing_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read billing entitlements" on public.billing_entitlements;
create policy "members can read billing entitlements"
  on public.billing_entitlements
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage billing entitlements" on public.billing_entitlements;
create policy "service role can manage billing entitlements"
  on public.billing_entitlements
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage billing webhook events" on public.billing_webhook_events;
create policy "service role can manage billing webhook events"
  on public.billing_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "users can read own roles" on public.user_roles;
create policy "users can read own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "service role can manage user roles" on public.user_roles;
create policy "service role can manage user roles"
  on public.user_roles
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "users can read own business memberships" on public.business_memberships;
create policy "users can read own business memberships"
  on public.business_memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "service role can manage business memberships" on public.business_memberships;
create policy "service role can manage business memberships"
  on public.business_memberships
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage business employee invites" on public.business_employee_invites;
create policy "service role can manage business employee invites"
  on public.business_employee_invites
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

comment on table public.service_catalog_items is 'Published Software-in-a-Service catalog entries. No pricing secrets, only public copy.';
comment on table public.service_requests is 'Customer service requests scoped to organizations, tracked by status.';
comment on table public.service_request_events is 'Status and audit events for service requests. Payloads must not contain secrets.';
comment on table public.service_deliverables is 'Operator-published deliverables linked to organizations and optional requests.';
comment on table public.service_comments is 'Comments on service requests or deliverables. No secrets.';
comment on table public.module_outputs is 'Free/paid tool outputs saved per organization. Written by server-side service role.';
comment on table public.billing_subscriptions is 'Subscription state written only by verified Stripe webhook processing.';
comment on table public.billing_entitlements is 'Entitlement state derived from verified billing events. Paid access source of truth.';
comment on table public.billing_webhook_events is 'Stripe webhook audit rows. Payload comes from verified events only.';
comment on table public.user_roles is 'Role grants used for owner/admin override checks.';
comment on table public.business_memberships is 'Business Builder workspace memberships for employee access.';
comment on table public.business_employee_invites is 'Employee invite records. Stores token_hash only, never raw tokens or passwords.';

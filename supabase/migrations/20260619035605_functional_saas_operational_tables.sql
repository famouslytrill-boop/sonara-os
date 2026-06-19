-- Functional SONARA SaaS operational tables.
-- Additive and schema-only. Contains no seed users, emails, passwords, API keys,
-- webhook secrets, service-role keys, or provider credentials.

create extension if not exists "pgcrypto";

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  product_key text,
  price_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  industry text,
  budget text,
  timeline text,
  goals text,
  current_website text,
  needed_services text[] not null default '{}'::text[],
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.launch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category text,
  title text not null,
  description text,
  status text not null default 'todo',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.launch_checklist_items
  add column if not exists updated_at timestamptz not null default now();

create index if not exists stripe_customers_user_id_idx on public.stripe_customers(user_id);
create index if not exists stripe_customers_organization_id_idx on public.stripe_customers(organization_id);
create index if not exists purchases_user_id_idx on public.purchases(user_id);
create index if not exists purchases_organization_id_idx on public.purchases(organization_id);
create index if not exists purchases_status_idx on public.purchases(status);
create index if not exists intake_requests_organization_id_idx on public.intake_requests(organization_id);
create index if not exists intake_requests_user_id_idx on public.intake_requests(user_id);
create index if not exists intake_requests_created_at_idx on public.intake_requests(created_at desc);
create index if not exists launch_checklist_items_organization_id_idx on public.launch_checklist_items(organization_id);
create index if not exists launch_checklist_items_user_id_idx on public.launch_checklist_items(user_id);
create index if not exists launch_checklist_items_status_idx on public.launch_checklist_items(status);
create index if not exists activity_events_organization_id_idx on public.activity_events(organization_id);
create index if not exists activity_events_user_id_idx on public.activity_events(user_id);
create index if not exists activity_events_created_at_idx on public.activity_events(created_at desc);
create index if not exists admin_audit_logs_actor_id_idx on public.admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);

grant select, insert, update, delete on public.intake_requests to authenticated;
grant select, insert, update, delete on public.launch_checklist_items to authenticated;
grant select on public.activity_events to authenticated;
grant select on public.stripe_customers to authenticated;
grant select on public.purchases to authenticated;
grant select, insert, update, delete on public.stripe_customers to service_role;
grant select, insert, update, delete on public.purchases to service_role;
grant select, insert, update, delete on public.intake_requests to service_role;
grant select, insert, update, delete on public.launch_checklist_items to service_role;
grant select, insert, update, delete on public.activity_events to service_role;
grant select, insert, update, delete on public.admin_audit_logs to service_role;

alter table public.stripe_customers enable row level security;
alter table public.purchases enable row level security;
alter table public.intake_requests enable row level security;
alter table public.launch_checklist_items enable row level security;
alter table public.activity_events enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "members can read stripe customers" on public.stripe_customers;
create policy "members can read stripe customers"
  on public.stripe_customers
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage stripe customers" on public.stripe_customers;
create policy "service role can manage stripe customers"
  on public.stripe_customers
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read purchases" on public.purchases;
create policy "members can read purchases"
  on public.purchases
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage purchases" on public.purchases;
create policy "service role can manage purchases"
  on public.purchases
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read intake requests" on public.intake_requests;
create policy "members can read intake requests"
  on public.intake_requests
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "members can create intake requests" on public.intake_requests;
create policy "members can create intake requests"
  on public.intake_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists "owners and admins can update intake requests" on public.intake_requests;
create policy "owners and admins can update intake requests"
  on public.intake_requests
  for update
  to authenticated
  using (organization_id is not null and public.is_org_owner_or_admin(organization_id))
  with check (organization_id is not null and public.is_org_owner_or_admin(organization_id));

drop policy if exists "service role can manage intake requests" on public.intake_requests;
create policy "service role can manage intake requests"
  on public.intake_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read launch checklist items" on public.launch_checklist_items;
create policy "members can read launch checklist items"
  on public.launch_checklist_items
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "members can create launch checklist items" on public.launch_checklist_items;
create policy "members can create launch checklist items"
  on public.launch_checklist_items
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists "members can update launch checklist items" on public.launch_checklist_items;
create policy "members can update launch checklist items"
  on public.launch_checklist_items
  for update
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "members can delete launch checklist items" on public.launch_checklist_items;
create policy "members can delete launch checklist items"
  on public.launch_checklist_items
  for delete
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage launch checklist items" on public.launch_checklist_items;
create policy "service role can manage launch checklist items"
  on public.launch_checklist_items
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "members can read activity events" on public.activity_events;
create policy "members can read activity events"
  on public.activity_events
  for select
  to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists "service role can manage activity events" on public.activity_events;
create policy "service role can manage activity events"
  on public.activity_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage admin audit logs" on public.admin_audit_logs;
create policy "service role can manage admin audit logs"
  on public.admin_audit_logs
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.stripe_customers is 'Stripe customer references only. No Stripe API keys or credentials are stored.';
comment on table public.purchases is 'Stripe one-time purchase records created from verified checkout/webhook processing.';
comment on table public.intake_requests is 'Business Builder intake requests scoped to organizations.';
comment on table public.launch_checklist_items is 'Launch checklist items scoped to organizations and users.';
comment on table public.activity_events is 'Operational activity events. Payloads must not contain secrets.';
comment on table public.admin_audit_logs is 'Admin action audit records. Contains no passwords, tokens, or provider secrets.';

-- SONARA Industries platform accounts, modules, and usage.
-- Schema-only migration. No seed users, real emails, tokens, API keys, SQL dumps, or service-role keys.
-- Payment provider references stored by these tables are identifiers, not credentials.
-- service_role policies grant server-side permissions; they are not secrets.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.product_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_key text not null check (product_key in ('business_builder', 'creator_studio', 'growth_studio')),
  status text not null default 'setup_required' check (status in ('setup_required', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_key)
);

create table if not exists public.product_modules (
  id uuid primary key default gen_random_uuid(),
  product_key text not null check (product_key in ('business_builder', 'creator_studio', 'growth_studio')),
  module_key text not null,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_key, module_key)
);

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  email text,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'paused', 'closed')),
  notes text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  product_key text not null check (product_key in ('business_builder', 'creator_studio', 'growth_studio')),
  title text not null,
  offer_type text,
  audience text,
  price_idea text,
  deliverables jsonb not null default '[]'::jsonb,
  proof_points jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  reference_id text not null unique,
  name text not null,
  email text not null,
  service_interest text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  asset_type text not null,
  platform text,
  status text not null default 'draft',
  rights_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  offer_type text not null check (offer_type in ('digital_product', 'service', 'catalog_bundle', 'subscription', 'release_package')),
  title text not null,
  audience text,
  deliverables jsonb not null default '[]'::jsonb,
  price_idea text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  goal text not null,
  audience text not null,
  offer text,
  channel text,
  timeline text,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  source text,
  consent_status text not null default 'unknown',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  product_key text not null check (product_key in ('business_builder', 'creator_studio', 'growth_studio')),
  module_key text not null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_ref)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_ref text not null,
  provider_subscription_ref text not null,
  plan_slug text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_ref)
);

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  entitlement_key text not null,
  status text not null default 'active',
  source text not null default 'billing',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entitlement_key)
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  livemode boolean not null default false,
  processing_status text not null default 'received',
  processed_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  reference_id text not null unique,
  category text not null,
  requester_email text,
  message_preview text not null,
  consent_accepted boolean not null default false,
  email_delivery_status text not null default 'pending_email',
  email_error_summary text,
  email_retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  delivery_status text not null,
  provider text not null default 'resend',
  sanitized_error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations(owner_user_id);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists product_workspaces_org_idx on public.product_workspaces(organization_id);
create index if not exists customer_records_org_idx on public.customer_records(organization_id, status);
create index if not exists offer_records_org_product_idx on public.offer_records(organization_id, product_key);
create index if not exists intake_requests_org_status_idx on public.intake_requests(organization_id, status);
create index if not exists creator_assets_org_status_idx on public.creator_assets(organization_id, status);
create index if not exists growth_campaigns_org_idx on public.growth_campaigns(organization_id, created_at desc);
create index if not exists growth_leads_org_idx on public.growth_leads(organization_id, created_at desc);
create index if not exists module_outputs_product_idx on public.module_outputs(product_key, module_key, created_at desc);
create index if not exists audit_events_org_idx on public.audit_events(organization_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.product_workspaces enable row level security;
alter table public.product_modules enable row level security;
alter table public.customer_records enable row level security;
alter table public.offer_records enable row level security;
alter table public.intake_requests enable row level security;
alter table public.creator_assets enable row level security;
alter table public.creator_offers enable row level security;
alter table public.growth_campaigns enable row level security;
alter table public.growth_leads enable row level security;
alter table public.module_outputs enable row level security;
alter table public.audit_events enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.support_requests enable row level security;
alter table public.support_email_delivery_attempts enable row level security;

create policy "profiles_self_select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_self_update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "organizations_owner_select" on public.organizations for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "organization_members_self_select" on public.organization_members for select to authenticated using (user_id = (select auth.uid()));

create policy "product_modules_authenticated_select" on public.product_modules for select to authenticated using (is_active = true);

create policy "service_role_profiles_all" on public.profiles for all to service_role using (true) with check (true);
create policy "service_role_organizations_all" on public.organizations for all to service_role using (true) with check (true);
create policy "service_role_members_all" on public.organization_members for all to service_role using (true) with check (true);
create policy "service_role_product_workspaces_all" on public.product_workspaces for all to service_role using (true) with check (true);
create policy "service_role_product_modules_all" on public.product_modules for all to service_role using (true) with check (true);
create policy "service_role_customer_records_all" on public.customer_records for all to service_role using (true) with check (true);
create policy "service_role_offer_records_all" on public.offer_records for all to service_role using (true) with check (true);
create policy "service_role_intake_requests_all" on public.intake_requests for all to service_role using (true) with check (true);
create policy "service_role_creator_assets_all" on public.creator_assets for all to service_role using (true) with check (true);
create policy "service_role_creator_offers_all" on public.creator_offers for all to service_role using (true) with check (true);
create policy "service_role_growth_campaigns_all" on public.growth_campaigns for all to service_role using (true) with check (true);
create policy "service_role_growth_leads_all" on public.growth_leads for all to service_role using (true) with check (true);
create policy "service_role_module_outputs_all" on public.module_outputs for all to service_role using (true) with check (true);
create policy "service_role_audit_events_all" on public.audit_events for all to service_role using (true) with check (true);
create policy "service_role_billing_customers_all" on public.billing_customers for all to service_role using (true) with check (true);
create policy "service_role_billing_subscriptions_all" on public.billing_subscriptions for all to service_role using (true) with check (true);
create policy "service_role_billing_entitlements_all" on public.billing_entitlements for all to service_role using (true) with check (true);
create policy "service_role_billing_webhook_events_all" on public.billing_webhook_events for all to service_role using (true) with check (true);
create policy "service_role_support_requests_all" on public.support_requests for all to service_role using (true) with check (true);
create policy "service_role_support_attempts_all" on public.support_email_delivery_attempts for all to service_role using (true) with check (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'organizations', 'product_workspaces', 'product_modules',
    'customer_records', 'offer_records', 'intake_requests', 'creator_assets',
    'creator_offers', 'growth_campaigns', 'growth_leads', 'billing_customers',
    'billing_subscriptions', 'billing_entitlements', 'billing_webhook_events',
    'support_requests'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = table_name || '_set_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
    end if;
  end loop;
end;
$$;

insert into public.product_modules (product_key, module_key, title, description)
values
  ('business_builder', 'offer_builder', 'Offer Builder', 'Structured offer drafting for service businesses.'),
  ('business_builder', 'intake_queue', 'Intake & Request Queue', 'Validated request capture and review flow.'),
  ('business_builder', 'customer_records', 'Customer Records', 'Customer record organization and notes.'),
  ('creator_studio', 'asset_catalog', 'Asset Catalog', 'Creator asset and rights notes.'),
  ('creator_studio', 'creator_offers', 'Creator Offers', 'Creator product and service offer drafts.'),
  ('growth_studio', 'campaign_workspace', 'Campaign Workspace', 'Consent-aware campaign planning.'),
  ('growth_studio', 'lead_follow_up', 'Lead & Customer Follow-Up', 'Consent-safe follow-up planning.')
on conflict (product_key, module_key) do update
set title = excluded.title,
    description = excluded.description,
    is_active = true;

comment on table public.module_outputs is 'Deterministic module outputs from SONARA product tools. Stores no provider secrets.';
comment on table public.billing_customers is 'Stripe customer references only; not payment credentials.';
comment on table public.billing_webhook_events is 'Signed webhook audit and idempotency records. Webhook secrets are never stored here.';

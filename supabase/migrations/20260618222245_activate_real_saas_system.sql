-- Activate SONARA Industries SaaS schema.
-- Schema-only migration: no auth.users inserts, no provider credentials, no seed emails,
-- no raw invite tokens, and no payment secrets.
-- Stripe/Supabase/OpenAI/Resend references stored here are provider identifiers or
-- operational metadata only; they are not API keys or credentials.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'business_admin', 'customer', 'employee', 'member')),
  organization_id uuid references public.organizations(id) on delete cascade,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role, organization_id, app_key)
);

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  app_key text not null unique check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'hidden', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid(),
  app_key text not null check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  module_key text not null,
  name text not null,
  description text,
  access_level text not null default 'free' check (access_level in ('free', 'paid', 'owner')),
  status text not null default 'active' check (status in ('active', 'hidden', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_key, module_key)
);

create table if not exists public.module_access_rules (
  id uuid primary key default gen_random_uuid(),
  app_key text not null check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  module_key text not null,
  required_access text not null check (required_access in ('free', 'paid', 'owner')),
  required_entitlement_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_key, module_key)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  stripe_price_id text,
  lookup_key text not null unique,
  currency text not null default 'usd',
  unit_amount integer,
  interval text check (interval in ('month', 'year', 'one_time')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  stripe_checkout_session_id text unique,
  status text not null default 'pending',
  amount_total integer,
  currency text default 'usd',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  status text not null,
  amount integer,
  currency text default 'usd',
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  mode text not null check (mode in ('payment', 'subscription', 'setup')),
  status text not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_key text not null check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'setup', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_key text not null check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, app_key)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_health_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('ok', 'warning', 'failed', 'received')),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  business_name text not null,
  summary text,
  audience text,
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  price_note text,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  status text not null default 'prospect',
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  customer_id uuid references public.business_customers(id) on delete set null,
  title text not null,
  amount integer,
  currency text default 'usd',
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  customer_id uuid references public.business_customers(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'open',
  due_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  document_type text not null default 'note',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_launch_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_marketing_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_operations_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email text not null,
  name text,
  role text not null default 'employee' check (role in ('business_admin', 'manager', 'employee')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_employee_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  invited_name text,
  role text not null default 'employee' check (role in ('manager', 'employee')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  name text,
  email text,
  message text not null,
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  app_key text not null check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  checklist_key text not null,
  status text not null default 'draft',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  project_id uuid references public.creator_projects(id) on delete set null,
  title text not null,
  release_date date,
  status text not null default 'draft',
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  asset_type text not null default 'other',
  rights_notes text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_content_calendar (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  scheduled_for date,
  channel text,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_production_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  status text not null default 'open',
  due_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  export_type text not null default 'document',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  consent_status text not null default 'unknown' check (consent_status in ('unknown', 'opted_in', 'opted_out')),
  source text,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  channel text not null default 'email',
  subject text,
  body text not null,
  status text not null default 'draft',
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  title text not null,
  plan jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  export_type text not null default 'document',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  job_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  model text,
  input jsonb not null default '{}'::jsonb,
  error_summary text,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.ai_jobs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  output_type text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  title text not null,
  document_type text not null,
  body text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  template_key text not null unique,
  title text not null,
  status text not null default 'active',
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  app_key text check (app_key in ('business_builder', 'creator_studio', 'growth_studio')),
  tool_key text not null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'resend',
  provider_message_id text,
  event_type text not null,
  status text not null default 'received',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  to_email text not null,
  subject text not null,
  status text not null default 'queued',
  provider text not null default 'resend',
  provider_message_id text,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.user_roles
      where user_id = (select auth.uid())
        and organization_id is null
        and role in ('owner', 'admin')
      order by case role when 'owner' then 1 when 'admin' then 2 else 3 end
      limit 1
    ),
    'customer'
  );
$$;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles role_record
    where role_record.user_id = (select auth.uid())
      and role_record.organization_id is null
      and role_record.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.organization_members member
      where member.organization_id = target_organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    )
    or exists (
      select 1
      from public.user_roles role_record
      where role_record.organization_id = target_organization_id
        and role_record.user_id = (select auth.uid())
        and role_record.role in ('business_admin', 'customer', 'employee', 'member')
    );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.organization_members member
      where member.organization_id = target_organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin', 'developer', 'support')
    )
    or exists (
      select 1
      from public.user_roles role_record
      where role_record.organization_id = target_organization_id
        and role_record.user_id = (select auth.uid())
        and role_record.role = 'business_admin'
    );
$$;

create or replace function public.has_paid_access(target_organization_id uuid, target_app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.billing_entitlements entitlement
      where entitlement.organization_id = target_organization_id
        and entitlement.status = 'active'
        and (
          entitlement.entitlement_key = target_app
          or entitlement.entitlement_key = target_app || ':all'
        )
        and (entitlement.expires_at is null or entitlement.expires_at > now())
    )
    or exists (
      select 1
      from public.subscriptions subscription
      where subscription.organization_id = target_organization_id
        and subscription.app_key = target_app
        and subscription.status in ('active', 'trialing')
    )
    or exists (
      select 1
      from public.billing_subscriptions subscription
      where subscription.organization_id = target_organization_id
        and subscription.status in ('active', 'trialing')
        and coalesce(subscription.metadata->>'app_key', target_app) = target_app
    );
$$;

create or replace function public.can_access_module(
  target_organization_id uuid,
  target_app text,
  target_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_global_admin() then true
    when not public.is_org_member(target_organization_id) then false
    when exists (
      select 1
      from public.module_access_rules rule
      where rule.app_key = target_app
        and rule.module_key = target_module_key
        and rule.required_access = 'owner'
    ) then false
    when exists (
      select 1
      from public.module_access_rules rule
      where rule.app_key = target_app
        and rule.module_key = target_module_key
        and rule.required_access = 'paid'
    ) then public.has_paid_access(target_organization_id, target_app)
    else true
  end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_global_admin() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.has_paid_access(uuid, text) from public;
revoke all on function public.can_access_module(uuid, text, text) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_global_admin() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.has_paid_access(uuid, text) to authenticated;
grant execute on function public.can_access_module(uuid, text, text) to authenticated;

create index if not exists user_roles_user_role_idx on public.user_roles(user_id, role);
create index if not exists user_roles_org_idx on public.user_roles(organization_id, role);
create index if not exists workspaces_org_app_idx on public.workspaces(organization_id, app_key);
create index if not exists subscriptions_org_app_status_idx on public.subscriptions(organization_id, app_key, status);
create index if not exists orders_org_status_idx on public.orders(organization_id, status, created_at desc);
create index if not exists payments_org_status_idx on public.payments(organization_id, status, created_at desc);
create index if not exists checkout_sessions_stripe_idx on public.checkout_sessions(stripe_checkout_session_id);
create index if not exists activities_org_created_idx on public.activities(organization_id, created_at desc);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists system_health_events_source_created_idx on public.system_health_events(source, created_at desc);

grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.user_roles to service_role;
grant select on public.products to anon, authenticated;
grant select on public.prices to anon, authenticated;
grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.prices to service_role;
grant select on public.admin_audit_logs to authenticated;
grant select, insert on public.admin_audit_logs to service_role;
grant select on public.system_health_events to authenticated;
grant select, insert on public.system_health_events to service_role;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences to service_role;

do $$
declare
  table_name text;
  table_names text[] := array[
    'profiles',
    'user_roles',
    'apps',
    'app_modules',
    'module_access_rules',
    'products',
    'prices',
    'subscriptions',
    'orders',
    'payments',
    'checkout_sessions',
    'workspaces',
    'app_settings',
    'activities',
    'admin_audit_logs',
    'system_health_events',
    'business_profiles',
    'business_plans',
    'business_offers',
    'business_products',
    'business_services',
    'business_customers',
    'business_invoices',
    'business_orders',
    'business_tasks',
    'business_documents',
    'business_launch_checklists',
    'business_marketing_plans',
    'business_operations_checklists',
    'business_employees',
    'business_employee_invites',
    'intake_submissions',
    'checklist_submissions',
    'creator_projects',
    'creator_releases',
    'creator_assets',
    'creator_content_calendar',
    'creator_briefs',
    'creator_production_notes',
    'creator_campaigns',
    'creator_tasks',
    'creator_exports',
    'leads',
    'lead_notes',
    'follow_ups',
    'content_plans',
    'growth_analytics_events',
    'campaign_exports',
    'ai_jobs',
    'ai_outputs',
    'generated_documents',
    'prompt_templates',
    'tool_runs',
    'email_events',
    'outbound_emails',
    'notification_preferences'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
  table_names text[] := array[
    'business_profiles',
    'business_plans',
    'business_offers',
    'business_products',
    'business_services',
    'business_customers',
    'business_invoices',
    'business_orders',
    'business_tasks',
    'business_documents',
    'business_launch_checklists',
    'business_marketing_plans',
    'business_operations_checklists',
    'business_employees',
    'business_employee_invites',
    'intake_submissions',
    'checklist_submissions',
    'workspaces',
    'creator_projects',
    'creator_releases',
    'creator_assets',
    'creator_content_calendar',
    'creator_briefs',
    'creator_production_notes',
    'creator_campaigns',
    'creator_tasks',
    'creator_exports',
    'leads',
    'lead_notes',
    'follow_ups',
    'content_plans',
    'growth_analytics_events',
    'campaign_exports',
    'ai_jobs',
    'ai_outputs',
    'generated_documents',
    'tool_runs',
    'outbound_emails'
  ];
begin
  foreach table_name in array table_names loop
    execute format('create index if not exists %I on public.%I(organization_id, created_at desc)', table_name || '_org_created_idx', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      table_name || '_member_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_member_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_org_member(organization_id) and (created_by is null or created_by = (select auth.uid())))',
      table_name || '_member_insert',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (current_user = ''service_role'') with check (current_user = ''service_role'')',
      table_name || '_service_role_all',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
  table_names text[] := array[
    'subscriptions',
    'orders',
    'payments',
    'checkout_sessions',
    'app_settings',
    'activities',
    'email_events'
  ];
begin
  foreach table_name in array table_names loop
    execute format('create index if not exists %I on public.%I(organization_id, created_at desc)', table_name || '_org_created_idx', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id is not null and public.is_org_admin(organization_id)) with check (organization_id is not null and public.is_org_admin(organization_id))',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id is not null and public.is_org_member(organization_id))',
      table_name || '_member_select',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (current_user = ''service_role'') with check (current_user = ''service_role'')',
      table_name || '_service_role_all',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "profiles_owner_self" on public.profiles;
create policy "profiles_owner_self" on public.profiles
for all to authenticated
using (id = (select auth.uid()) or public.is_global_admin())
with check (id = (select auth.uid()) or public.is_global_admin());

drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select" on public.user_roles
for select to authenticated
using (user_id = (select auth.uid()) or public.is_global_admin());

drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all" on public.user_roles
for all to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "user_roles_service_role_all" on public.user_roles;
create policy "user_roles_service_role_all" on public.user_roles
for all to service_role
using (current_user = 'service_role')
with check (current_user = 'service_role');

drop policy if exists "products_public_active" on public.products;
create policy "products_public_active" on public.products
for select to anon, authenticated
using (status = 'active');

drop policy if exists "prices_public_active" on public.prices;
create policy "prices_public_active" on public.prices
for select to anon, authenticated
using (
  active
  and exists (
    select 1
    from public.products product
    where product.id = prices.product_id
      and product.status = 'active'
  )
);

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products
for all to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "prices_admin_all" on public.prices;
create policy "prices_admin_all" on public.prices
for all to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

do $$
declare
  table_name text;
  table_names text[] := array[
    'apps',
    'app_modules',
    'module_access_rules',
    'prompt_templates'
  ];
begin
  foreach table_name in array table_names loop
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_public_select', table_name);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (%s)',
      table_name || '_public_select',
      table_name,
      case table_name
        when 'apps' then 'status = ''active'''
        when 'app_modules' then 'status = ''active'''
        when 'prompt_templates' then 'status = ''active'''
        else 'required_access in (''free'', ''paid'', ''owner'')'
      end
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_global_admin()) with check (public.is_global_admin())',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
    execute format(
      'create policy %I on public.%I for all to service_role using (current_user = ''service_role'') with check (current_user = ''service_role'')',
      table_name || '_service_role_all',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "notification_preferences_owner_all" on public.notification_preferences;
create policy "notification_preferences_owner_all" on public.notification_preferences
for all to authenticated
using (user_id = (select auth.uid()) or public.is_global_admin())
with check (user_id = (select auth.uid()) or public.is_global_admin());

drop policy if exists "notification_preferences_service_role_all" on public.notification_preferences;
create policy "notification_preferences_service_role_all" on public.notification_preferences
for all to service_role
using (current_user = 'service_role')
with check (current_user = 'service_role');

drop policy if exists "admin_audit_logs_admin_select" on public.admin_audit_logs;
create policy "admin_audit_logs_admin_select" on public.admin_audit_logs
for select to authenticated
using (public.is_global_admin());

drop policy if exists "admin_audit_logs_service_role_all" on public.admin_audit_logs;
create policy "admin_audit_logs_service_role_all" on public.admin_audit_logs
for all to service_role
using (current_user = 'service_role')
with check (current_user = 'service_role');

drop policy if exists "system_health_events_admin_select" on public.system_health_events;
create policy "system_health_events_admin_select" on public.system_health_events
for select to authenticated
using (public.is_global_admin());

drop policy if exists "system_health_events_service_role_all" on public.system_health_events;
create policy "system_health_events_service_role_all" on public.system_health_events
for all to service_role
using (current_user = 'service_role')
with check (current_user = 'service_role');

do $$
declare
  table_name text;
  table_names text[] := array[
    'profiles',
    'user_roles',
    'apps',
    'app_modules',
    'module_access_rules',
    'products',
    'prices',
    'subscriptions',
    'orders',
    'payments',
    'checkout_sessions',
    'workspaces',
    'app_settings',
    'business_profiles',
    'business_plans',
    'business_offers',
    'business_products',
    'business_services',
    'business_customers',
    'business_invoices',
    'business_orders',
    'business_tasks',
    'business_documents',
    'business_launch_checklists',
    'business_marketing_plans',
    'business_operations_checklists',
    'business_employees',
    'business_employee_invites',
    'intake_submissions',
    'checklist_submissions',
    'creator_projects',
    'creator_releases',
    'creator_assets',
    'creator_content_calendar',
    'creator_briefs',
    'creator_production_notes',
    'creator_campaigns',
    'creator_tasks',
    'creator_exports',
    'leads',
    'follow_ups',
    'content_plans',
    'campaign_exports',
    'ai_jobs',
    'generated_documents',
    'tool_runs',
    'outbound_emails',
    'notification_preferences'
  ];
begin
  foreach table_name in array table_names loop
    if not exists (
      select 1
      from pg_trigger
      where tgname = table_name || '_set_updated_at'
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        table_name || '_set_updated_at',
        table_name
      );
    end if;
  end loop;
end;
$$;

comment on table public.user_roles is 'Durable role assignments. No passwords or secrets are stored here.';
comment on table public.business_employee_invites is 'Employee invitation metadata. Stores token_hash only; raw invite tokens must never be stored.';
comment on table public.checkout_sessions is 'Stripe Checkout Session references and metadata only. Does not store Stripe keys.';
comment on table public.payments is 'Payment result records from verified provider events. Does not store card data or credentials.';
comment on table public.ai_jobs is 'Server-side AI job audit records. Does not store provider API keys.';
comment on table public.outbound_emails is 'Outbound email audit records. Does not store Resend API keys.';

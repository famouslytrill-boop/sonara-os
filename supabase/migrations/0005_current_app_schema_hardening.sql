-- SONARA Industries current app schema hardening.
-- Apply after 0004_support_email_delivery_status.sql.
-- Schema-only migration: no seed data, auth user data, provider credentials, or private payload dumps.

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

comment on function public.set_updated_at()
is 'Maintains updated_at timestamps for mutable SONARA application tables.';

do $$
declare
  table_name text;
  trigger_name text;
  table_names text[] := array[
    'user_profiles',
    'organizations',
    'organization_members',
    'customer_records',
    'proof_profiles',
    'payment_options',
    'booking_links',
    'smart_intake_forms',
    'offers',
    'reviews',
    'money_path_events',
    'files_records',
    'external_connections',
    'feature_flags',
    'approval_events',
    'agent_sessions',
    'agent_tools',
    'agent_tasks',
    'growth_tactics',
    'growth_experiments',
    'growth_checklists',
    'growth_checklist_items',
    'campaigns',
    'campaign_contacts',
    'campaign_messages',
    'outreach_approvals',
    'vector_documents',
    'support_requests'
  ];
begin
  foreach table_name in array table_names loop
    trigger_name := table_name || '_set_updated_at';

    if to_regclass('public.' || table_name) is not null
      and not exists (
        select 1
        from pg_trigger
        where tgname = trigger_name
      )
    then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        trigger_name,
        table_name
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null,
  livemode boolean not null default false,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processed', 'ignored', 'failed')
  ),
  processed_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  provider_customer_ref text not null,
  provider_subscription_ref text not null,
  plan_slug text not null,
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
  ),
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
  status text not null default 'active' check (status in ('active', 'disabled', 'expired')),
  source text not null default 'billing' check (source in ('billing', 'manual_review')),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entitlement_key)
);

create index if not exists billing_webhook_events_provider_status_idx
on public.billing_webhook_events(provider, processing_status, created_at desc);

create index if not exists billing_webhook_events_org_created_idx
on public.billing_webhook_events(organization_id, created_at desc);

create index if not exists billing_subscriptions_org_status_idx
on public.billing_subscriptions(organization_id, status);

create index if not exists billing_subscriptions_provider_customer_idx
on public.billing_subscriptions(provider, provider_customer_ref);

create index if not exists billing_entitlements_org_status_idx
on public.billing_entitlements(organization_id, status);

do $$
declare
  table_name text;
  trigger_name text;
  table_names text[] := array[
    'billing_webhook_events',
    'billing_subscriptions',
    'billing_entitlements'
  ];
begin
  foreach table_name in array table_names loop
    trigger_name := table_name || '_set_updated_at';

    if not exists (
      select 1
      from pg_trigger
      where tgname = trigger_name
    )
    then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        trigger_name,
        table_name
      );
    end if;
  end loop;
end;
$$;

grant select on public.billing_webhook_events to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_entitlements to authenticated;

grant select, insert, update on public.billing_webhook_events to service_role;
grant select, insert, update on public.billing_subscriptions to service_role;
grant select, insert, update on public.billing_entitlements to service_role;

alter table public.billing_webhook_events enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_entitlements enable row level security;

create policy "billing_webhook_events_org_admin_select" on public.billing_webhook_events
for select to authenticated
using (
  organization_id is not null
  and public.is_org_admin(organization_id)
);

create policy "billing_webhook_events_service_role_all" on public.billing_webhook_events
for all to service_role
using (true)
with check (true);

create policy "billing_subscriptions_org_admin_select" on public.billing_subscriptions
for select to authenticated
using (public.is_org_admin(organization_id));

create policy "billing_subscriptions_service_role_all" on public.billing_subscriptions
for all to service_role
using (true)
with check (true);

create policy "billing_entitlements_org_member_select" on public.billing_entitlements
for select to authenticated
using (public.is_org_member(organization_id));

create policy "billing_entitlements_service_role_all" on public.billing_entitlements
for all to service_role
using (true)
with check (true);

comment on table public.billing_webhook_events
is 'Idempotency and processing audit records for signed billing webhook events. Stores references only, not secrets.';

comment on table public.billing_subscriptions
is 'Organization-scoped subscription state synchronized from billing provider webhooks. Stores provider references only, not keys.';

comment on table public.billing_entitlements
is 'Organization-scoped entitlement state derived from subscription or manual review decisions.';

comment on column public.billing_webhook_events.provider_event_id
is 'Provider event identifier used for idempotency. This is not a webhook secret.';

comment on column public.billing_subscriptions.provider_customer_ref
is 'Provider customer identifier. This is not a secret or payment credential.';

comment on column public.billing_subscriptions.provider_subscription_ref
is 'Provider subscription identifier. This is not a secret or payment credential.';

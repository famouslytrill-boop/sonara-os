-- SONARA Industries billing webhook integrity and admin audit hardening.
-- Schema-only migration. No seed users, real emails, tokens, API keys, webhook secrets, or provider credentials.
-- Provider event/customer/subscription references are identifiers, not secrets.

create extension if not exists pgcrypto;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  livemode boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  processed_at timestamptz null,
  error_summary text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_webhook_events
  add column if not exists organization_id uuid null references public.organizations(id) on delete set null,
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_event_id text,
  add column if not exists event_type text,
  add column if not exists livemode boolean not null default false,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists processing_status text not null default 'received',
  add column if not exists processed_at timestamptz null,
  add column if not exists error_summary text null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists billing_webhook_events_provider_event_id_key
on public.billing_webhook_events(provider, provider_event_id);

create index if not exists billing_webhook_events_created_at_idx
on public.billing_webhook_events(created_at desc);

create index if not exists billing_webhook_events_type_created_idx
on public.billing_webhook_events(event_type, created_at desc);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  action text not null,
  target_type text null,
  target_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_created_at_idx
on public.admin_audit_events(created_at desc);

create index if not exists admin_audit_events_action_created_idx
on public.admin_audit_events(action, created_at desc);

alter table public.billing_webhook_events enable row level security;
alter table public.admin_audit_events enable row level security;

grant select, insert, update on public.billing_webhook_events to service_role;
grant select, insert on public.admin_audit_events to service_role;

drop policy if exists "billing_webhook_events_service_role_all"
on public.billing_webhook_events;

create policy "billing_webhook_events_service_role_all"
on public.billing_webhook_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "admin_audit_events_service_role_all"
on public.admin_audit_events;

create policy "admin_audit_events_service_role_all"
on public.admin_audit_events
for all
to service_role
using (true)
with check (true);

comment on table public.billing_webhook_events is 'Stripe webhook audit and idempotency table. Payloads are event payloads, not webhook secrets.';
comment on table public.admin_audit_events is 'Server-side admin access/action audit table. Contains no admin tokens or provider credentials.';

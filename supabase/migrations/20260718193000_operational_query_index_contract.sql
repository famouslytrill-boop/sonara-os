-- SONARA operational query and billing-subscription compatibility contract.
--
-- Evidence basis:
-- - root Express/PostgREST runtime filters active memberships by user
-- - Stripe webhook synchronization writes organization-scoped provider records
-- - paid entitlement checks filter by organization, active status, and plan key
-- - customer service/catalog/module screens filter by tenant/product and sort by time
-- - Business Builder manager and pending-invite paths filter by workspace/status
--
-- Migrations 40 and 41 are already present in the production ledger. The first
-- guarded production attempt of this migration proved that an older
-- billing_subscriptions table predated the canonical table-definition migration
-- and lacked organization_id. Reconcile only the additive columns required by
-- the current server contract before creating operational indexes.
-- This migration creates no new table, user, provider connection, public grant,
-- RLS bypass, seed account, or autonomous executor.

alter table public.billing_subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_customer_ref text,
  add column if not exists provider_subscription_ref text,
  add column if not exists plan_slug text,
  add column if not exists status text not null default 'incomplete',
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Preserve useful identifiers from older compatible column names when they
-- exist. No organization relationship is guessed or fabricated.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_subscriptions' and column_name = 'stripe_subscription_id'
  ) then
    execute 'update public.billing_subscriptions set provider_subscription_ref = stripe_subscription_id where provider_subscription_ref is null and stripe_subscription_id is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_subscriptions' and column_name = 'stripe_customer_id'
  ) then
    execute 'update public.billing_subscriptions set provider_customer_ref = stripe_customer_id where provider_customer_ref is null and stripe_customer_id is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_subscriptions' and column_name = 'plan_key'
  ) then
    execute 'update public.billing_subscriptions set plan_slug = plan_key where plan_slug is null and plan_key is not null';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_subscriptions' and column_name = 'tier'
  ) then
    execute 'update public.billing_subscriptions set plan_slug = tier where plan_slug is null and tier is not null';
  end if;
end $$;

create unique index if not exists billing_subscriptions_provider_subscription_key
  on public.billing_subscriptions (provider, provider_subscription_ref);

create index if not exists organization_memberships_active_user_created_idx
  on public.organization_memberships (user_id, created_at, organization_id)
  where status = 'active';

create index if not exists business_memberships_active_manager_lookup_idx
  on public.business_memberships (user_id, created_at, workspace_id)
  where status = 'active' and role in ('owner', 'manager');

create index if not exists billing_subscriptions_active_org_plan_idx
  on public.billing_subscriptions (organization_id, plan_slug)
  where status in ('active', 'trialing');

create index if not exists service_catalog_items_active_product_name_idx
  on public.service_catalog_items (product_key, name)
  where status = 'active';

create index if not exists service_requests_org_product_created_idx
  on public.service_requests (organization_id, product_key, created_at desc);

create index if not exists service_deliverables_org_product_updated_idx
  on public.service_deliverables (organization_id, product_key, updated_at desc);

create index if not exists module_outputs_org_product_module_created_idx
  on public.module_outputs (organization_id, product_key, module_key, created_at desc);

create index if not exists business_employee_invites_pending_workspace_created_idx
  on public.business_employee_invites (workspace_id, created_at desc)
  where status = 'pending';

comment on index public.billing_subscriptions_provider_subscription_key is
  'Supports idempotent Stripe subscription upserts across the reconciled legacy/canonical schema.';
comment on index public.organization_memberships_active_user_created_idx is
  'Supports deterministic active customer-organization resolution by authenticated user.';
comment on index public.business_memberships_active_manager_lookup_idx is
  'Supports deterministic active Business Builder owner/manager authorization, with optional workspace filtering.';
comment on index public.billing_subscriptions_active_org_plan_idx is
  'Supports persisted active/trialing paid-entitlement checks by organization and plan.';
comment on index public.service_catalog_items_active_product_name_idx is
  'Supports active product catalog listing ordered by service name.';
comment on index public.service_requests_org_product_created_idx is
  'Supports tenant/product request history ordered newest first.';
comment on index public.service_deliverables_org_product_updated_idx is
  'Supports tenant/product deliverable history ordered by latest update.';
comment on index public.module_outputs_org_product_module_created_idx is
  'Supports tenant/product/module output history ordered newest first.';
comment on index public.business_employee_invites_pending_workspace_created_idx is
  'Supports pending Business Builder invite queues by workspace.';

do $$
declare
  required_column text;
  required_index text;
  required_columns constant text[] := array[
    'organization_id',
    'provider',
    'provider_customer_ref',
    'provider_subscription_ref',
    'plan_slug',
    'status',
    'current_period_end',
    'cancel_at_period_end',
    'metadata',
    'created_at',
    'updated_at'
  ];
  required_indexes constant text[] := array[
    'billing_subscriptions_provider_subscription_key',
    'organization_memberships_active_user_created_idx',
    'business_memberships_active_manager_lookup_idx',
    'billing_subscriptions_active_org_plan_idx',
    'service_catalog_items_active_product_name_idx',
    'service_requests_org_product_created_idx',
    'service_deliverables_org_product_updated_idx',
    'module_outputs_org_product_module_created_idx',
    'business_employee_invites_pending_workspace_created_idx'
  ];
begin
  foreach required_column in array required_columns
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'billing_subscriptions'
        and column_name = required_column
    ) then
      raise exception 'required billing_subscriptions column public.billing_subscriptions.% is missing', required_column;
    end if;
  end loop;

  foreach required_index in array required_indexes
  loop
    if to_regclass(format('public.%I', required_index)) is null then
      raise exception 'required SONARA operational index public.% is missing', required_index;
    end if;

    if not exists (
      select 1
      from pg_index indexes
      where indexes.indexrelid = to_regclass(format('public.%I', required_index))
        and indexes.indisvalid
        and indexes.indisready
    ) then
      raise exception 'required SONARA operational index public.% is not valid and ready', required_index;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- SONARA operational query index contract.
--
-- Evidence basis:
-- - root Express/PostgREST runtime filters active memberships by user
-- - paid entitlement checks filter by organization, active status, and plan key
-- - customer service/catalog/module screens filter by tenant/product and sort by time
-- - Business Builder manager and pending-invite paths filter by workspace/status
--
-- This migration adds no tables, rows, users, providers, autonomous execution,
-- secrets, public grants, or RLS bypasses. Apply to hosted production only after
-- migrations 40 and 41, owner review, and a maintenance-window/index-advisor check.

create index if not exists organization_memberships_active_user_created_idx
  on public.organization_memberships (user_id, created_at, organization_id)
  where status = 'active';

create index if not exists business_memberships_active_manager_lookup_idx
  on public.business_memberships (user_id, workspace_id, created_at)
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

comment on index public.organization_memberships_active_user_created_idx is
  'Supports deterministic active customer-organization resolution by authenticated user.';
comment on index public.business_memberships_active_manager_lookup_idx is
  'Supports active Business Builder owner/manager authorization with optional workspace scope.';
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
  required_index text;
  required_indexes constant text[] := array[
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

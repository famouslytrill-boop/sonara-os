-- Enforce the production boundary for the 2026 SONARA recommended product catalog.
-- Paid catalog execution stays disabled until a real production entitlement test is recorded.
-- Planned, validation-required, and setup-required products can never execute directly.

alter table public.service_catalog_items
  add column if not exists entitlement_integration_verified boolean not null default false,
  add column if not exists execution_enabled boolean not null default false;

update public.service_catalog_items
set
  entitlement_integration_verified = case
    when product_type = 'software_product' and plan_floor = 'free' then true
    when product_type = 'software_product' then false
    else entitlement_integration_verified
  end,
  execution_enabled = case
    when product_type = 'software_product'
      and plan_floor = 'free'
      and lifecycle_status in ('active', 'beta')
      then true
    when product_type = 'software_product' then false
    else execution_enabled
  end,
  updated_at = now()
where service_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_catalog_items_execution_lifecycle_check'
  ) then
    alter table public.service_catalog_items
      add constraint service_catalog_items_execution_lifecycle_check
      check (
        execution_enabled = false
        or lifecycle_status in ('active', 'beta')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_catalog_items_execution_entitlement_check'
  ) then
    alter table public.service_catalog_items
      add constraint service_catalog_items_execution_entitlement_check
      check (
        execution_enabled = false
        or plan_floor = 'free'
        or entitlement_integration_verified = true
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_catalog_items_paid_verification_check'
  ) then
    alter table public.service_catalog_items
      add constraint service_catalog_items_paid_verification_check
      check (
        product_type <> 'software_product'
        or plan_floor = 'free'
        or execution_enabled = false
        or entitlement_integration_verified = true
      );
  end if;
end $$;

create index if not exists service_catalog_items_execution_boundary_idx
  on public.service_catalog_items(product_type, lifecycle_status, plan_floor, entitlement_integration_verified, execution_enabled)
  where service_key is not null;

do $$
declare
  catalog_total integer;
  parent_total integer;
  business_total integer;
  creator_total integer;
  growth_total integer;
begin
  select count(*) into catalog_total
  from public.service_catalog_items
  where product_type = 'software_product'
    and service_key is not null
    and metadata ->> 'catalogVersion' = '2026-07-25';

  select count(*) into parent_total
  from public.service_catalog_items
  where product_type = 'software_product'
    and product_key = 'sonara_industries'
    and metadata ->> 'catalogVersion' = '2026-07-25';

  select count(*) into business_total
  from public.service_catalog_items
  where product_type = 'software_product'
    and product_key = 'business_builder'
    and metadata ->> 'catalogVersion' = '2026-07-25';

  select count(*) into creator_total
  from public.service_catalog_items
  where product_type = 'software_product'
    and product_key = 'creator_studio'
    and metadata ->> 'catalogVersion' = '2026-07-25';

  select count(*) into growth_total
  from public.service_catalog_items
  where product_type = 'software_product'
    and product_key = 'growth_studio'
    and metadata ->> 'catalogVersion' = '2026-07-25';

  if catalog_total <> 34 then
    raise exception 'Recommended product catalog must contain exactly 34 records; found %', catalog_total;
  end if;

  if parent_total <> 10 or business_total <> 8 or creator_total <> 8 or growth_total <> 8 then
    raise exception 'Recommended product catalog company counts are invalid: parent %, business %, creator %, growth %',
      parent_total, business_total, creator_total, growth_total;
  end if;

  if exists (
    select 1 from public.service_catalog_items
    where product_type = 'software_product'
      and lifecycle_status in ('planned', 'validation_required', 'setup_required')
      and execution_enabled = true
  ) then
    raise exception 'Restricted lifecycle products cannot have execution enabled';
  end if;

  if exists (
    select 1 from public.service_catalog_items
    where product_type = 'software_product'
      and plan_floor <> 'free'
      and entitlement_integration_verified = false
      and execution_enabled = true
  ) then
    raise exception 'Paid products cannot execute before entitlement integration verification';
  end if;
end $$;

comment on column public.service_catalog_items.entitlement_integration_verified is
  'True only after the product plan floor has passed a real production entitlement access test.';
comment on column public.service_catalog_items.execution_enabled is
  'Direct catalog execution flag. Database constraints keep restricted lifecycle and unverified paid products disabled.';

notify pgrst, 'reload schema';

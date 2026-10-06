-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Stock is consumed at fulfillment, not reserved at checkout. Historical lines
-- have no snapshot and must not silently consume a newly linked inventory item.
begin;

alter table public.merchant_order_lines
  add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete restrict,
  add column if not exists inventory_snapshot_at timestamptz;

create or replace function public.snapshot_merchant_order_inventory()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
  v_item uuid;
begin
  -- Lock the order first, the same ordering as fulfillment. A late line cannot
  -- be inserted into an order while fulfillment reads its existing lines.
  select organization_id into v_org from public.merchant_orders
    where id = new.order_id and status = 'placed' for update;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'order_missing';
  end if;
  if new.variant_id is not null then
    select inventory_item_id into v_item from public.merchant_product_variants
      where id = new.variant_id and organization_id = new.organization_id for share;
    if not found then raise exception 'inventory_unavailable'; end if;
    if v_item is not null and not exists (
      select 1 from public.inventory_items
        where id = v_item and organization_id = new.organization_id and status = 'active'
    ) then raise exception 'inventory_unavailable'; end if;
  end if;
  -- Posted snapshot fields are ignored, just like posted prices are ignored.
  new.inventory_item_id := v_item;
  new.inventory_snapshot_at := now();
  return new;
end;
$$;
revoke all on function public.snapshot_merchant_order_inventory() from public, anon, authenticated;
grant execute on function public.snapshot_merchant_order_inventory() to service_role;
create trigger merchant_order_lines_snapshot_stock before insert on public.merchant_order_lines
  for each row execute function public.snapshot_merchant_order_inventory();

-- A frozen line cannot be repointed after a buyer agrees to it. Cancellations
-- keep the original lines; returns require a separate owner-reviewed workflow.
revoke update, delete on public.merchant_order_lines from service_role;

create table if not exists public.merchant_order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null unique references public.merchant_orders(id),
  fulfilled_by uuid not null references auth.users(id),
  fulfilled_at timestamptz not null default now(),
  stock_changes jsonb not null check (jsonb_typeof(stock_changes) = 'array')
);
create index if not exists merchant_order_fulfillments_org_idx
  on public.merchant_order_fulfillments(organization_id, fulfilled_at desc);
alter table public.merchant_order_fulfillments enable row level security;
revoke all on public.merchant_order_fulfillments from public, anon, authenticated, service_role;
grant select, insert on public.merchant_order_fulfillments to service_role;
create policy merchant_order_fulfillments_service on public.merchant_order_fulfillments
  for all to service_role using (true) with check (true);

create or replace function public.transition_merchant_order(
  p_organization_id uuid, p_order_id uuid, p_actor_id uuid,
  p_status text, p_reason text, p_require_paid boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.merchant_orders%rowtype;
  v_item public.inventory_items%rowtype;
  v_line record;
  v_changes jsonb := '[]'::jsonb;
  v_receipt uuid;
begin
  if p_actor_id is null then raise exception 'order_missing'; end if;
  select * into v_order from public.merchant_orders
    where id = p_order_id and organization_id = p_organization_id for update;
  if not found then raise exception 'order_missing'; end if;
  if p_status is null or p_status not in ('placed','confirmed','fulfilled','cancelled') then
    raise exception 'status_unknown';
  end if;
  if v_order.status = p_status then
    select id into v_receipt from public.merchant_order_fulfillments
      where order_id = p_order_id and organization_id = p_organization_id;
    return jsonb_build_object('ok', true, 'status', p_status, 'noop', true, 'fulfillment_id', v_receipt);
  end if;
  if not ((v_order.status = 'placed' and p_status in ('confirmed','cancelled'))
       or (v_order.status = 'confirmed' and p_status in ('fulfilled','cancelled'))) then
    raise exception 'status_transition_invalid';
  end if;
  if p_status = 'fulfilled' then
    if (coalesce(p_require_paid, true) or v_order.stripe_account_id is not null
        or v_order.checkout_session_id is not null)
      and (v_order.payment_state is distinct from 'paid' or v_order.amount_paid_cents < v_order.subtotal_cents
           or v_order.amount_paid_cents is null or coalesce(v_order.refunded_cents, 0) > 0) then
      raise exception 'payment_not_ready';
    end if;
    if not exists (select 1 from public.merchant_order_lines where order_id = p_order_id)
      then raise exception 'order_lines_missing'; end if;
    if exists (select 1 from public.merchant_order_lines where order_id = p_order_id
      and (organization_id <> p_organization_id or inventory_snapshot_at is null)) then
      raise exception 'inventory_snapshot_missing';
    end if;
    -- Sum shared stock across variants and lock in UUID order to avoid deadlocks
    -- when two orders contain the same items in a different line order.
    for v_line in select inventory_item_id, sum(quantity) as quantity
      from public.merchant_order_lines where order_id = p_order_id
        and organization_id = p_organization_id and inventory_item_id is not null
      group by inventory_item_id order by inventory_item_id
    loop
      select * into v_item from public.inventory_items
        where id = v_line.inventory_item_id and organization_id = p_organization_id for update;
      if not found or v_item.status <> 'active' or v_item.quantity is null
        or v_item.quantity::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'inventory_unavailable';
      end if;
      if v_item.quantity < v_line.quantity then raise exception 'stock_insufficient'; end if;
      update public.inventory_items set quantity = quantity - v_line.quantity, updated_at = now()
        where id = v_item.id and organization_id = p_organization_id;
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'inventory_item_id', v_item.id, 'name', v_item.name, 'quantity', v_line.quantity,
        'before', v_item.quantity, 'after', v_item.quantity - v_line.quantity,
        'unit', v_item.unit, 'unit_cost_cents', v_item.cost_cents));
    end loop;
    insert into public.merchant_order_fulfillments(organization_id, order_id, fulfilled_by, stock_changes)
      values (p_organization_id, p_order_id, p_actor_id, v_changes) returning id into v_receipt;
  end if;
  update public.merchant_orders set status = p_status, updated_at = now(),
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_status = 'cancelled' then nullif(left(trim(p_reason), 2000), '') else cancellation_reason end
    where id = p_order_id and organization_id = p_organization_id;
  return jsonb_build_object('ok', true, 'status', p_status, 'noop', false, 'fulfillment_id', v_receipt);
end;
$$;
revoke all on function public.transition_merchant_order(uuid,uuid,uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.transition_merchant_order(uuid,uuid,uuid,text,text,boolean) to service_role;
commit;

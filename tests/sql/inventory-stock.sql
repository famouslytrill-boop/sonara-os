-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Executed only in the disposable migration replay database.
--
-- Stock held by orders (20261006040000) and consumed by fulfilment
-- (20261006035501), and moved by jobs: holds, shortages, retries, a fulfilled
-- order consuming its hold once, a cancelled one releasing it, job use and
-- return, archived items, tenancy, privileges.
begin;
insert into auth.users(id, email) values ('20000000-0000-4000-8000-0000000000aa', 'stock-probe@example.invalid');
insert into public.organizations(id, name) values
  ('20000000-0000-4000-8000-000000000001', 'Stock probe A'),
  ('20000000-0000-4000-8000-000000000002', 'Stock probe B');
insert into public.inventory_items(id, organization_id, name, quantity, status) values
  ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'Mug', 5, 'active'),
  ('20000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-000000000001', 'Cable (m)', 10, 'active');
insert into public.merchant_products(id, organization_id, name, status) values
  ('20000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001', 'Mug', 'active'),
  ('20000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-000000000001', 'Sticker', 'active');
insert into public.merchant_product_variants(id, organization_id, product_id, variant_name, price_cents, currency, inventory_item_id, status) values
  ('20000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000b1', 'Large', 1200, 'usd', '20000000-0000-4000-8000-0000000000a1', 'active'),
  ('20000000-0000-4000-8000-0000000000c2', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000b2', 'Round', 200, 'usd', null, 'active');

-- Four orders: 3 mugs + a sticker; 2 mugs; 1 mug; 1 mug (for the archived case).
insert into public.merchant_orders(id, organization_id, buyer_name, buyer_email, subtotal_cents, currency) values
  ('20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-000000000001', 'A', 'a@example.com', 3800, 'usd'),
  ('20000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-000000000001', 'B', 'b@example.com', 2400, 'usd'),
  ('20000000-0000-4000-8000-0000000000d3', '20000000-0000-4000-8000-000000000001', 'C', 'c@example.com', 1200, 'usd'),
  ('20000000-0000-4000-8000-0000000000d4', '20000000-0000-4000-8000-000000000001', 'D', 'd@example.com', 1200, 'usd');
-- Each line freezes its stock link as it is inserted (20261006035501).
insert into public.merchant_order_lines(id, organization_id, order_id, variant_id, description, quantity, unit_price_cents, line_total_cents, currency) values
  ('20000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 3, 1200, 3600, 'usd'),
  ('20000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000c2', 'Sticker — Round', 1, 200, 200, 'usd'),
  ('20000000-0000-4000-8000-0000000000e3', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 2, 1200, 2400, 'usd'),
  ('20000000-0000-4000-8000-0000000000e4', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d3', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 1, 1200, 1200, 'usd'),
  ('20000000-0000-4000-8000-0000000000e5', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d4', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 1, 1200, 1200, 'usd');

insert into public.business_work_orders(id, organization_id, title) values
  ('20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-000000000001', 'Rewire the shop');
insert into public.business_work_order_materials(id, organization_id, work_order_id, inventory_item_id, quantity_used, material_status) values
  ('20000000-0000-4000-8000-0000000000f2', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000a2', 12, 'used'),
  ('20000000-0000-4000-8000-0000000000f3', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000a2', 3, 'returned'),
  ('20000000-0000-4000-8000-0000000000f4', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000a2', 4, 'planned');

do $$
declare
  org uuid := '20000000-0000-4000-8000-000000000001';
  other_org uuid := '20000000-0000-4000-8000-000000000002';
  actor uuid := '20000000-0000-4000-8000-0000000000aa';
  mug uuid := '20000000-0000-4000-8000-0000000000a1';
  r jsonb;
  qty numeric;
  held numeric;
  refused boolean;
begin
  -- 3 of 5 mugs held; the sticker is untracked and does not block.
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d1');
  if r->>'code' <> 'reserved' or (r->>'held')::int <> 1 or (r->>'untracked')::int <> 1 then raise exception 'first hold: %', r; end if;
  -- A retry holds nothing more.
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d1');
  if r->>'code' <> 'already_reserved' then raise exception 'retry held twice: %', r; end if;
  -- 2 of the remaining 2 held.
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d2');
  if r->>'code' <> 'reserved' then raise exception 'second hold: %', r; end if;
  -- None left: the third is refused, writes nothing, and says what is short.
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d3');
  if r->>'code' <> 'insufficient_stock' or (r->'shortages'->0->>'available')::numeric <> 0 or (r->'shortages'->0->>'needed')::numeric <> 1 then
    raise exception 'oversold: %', r;
  end if;
  if exists (select 1 from public.inventory_reservations where source_id = '20000000-0000-4000-8000-0000000000e4') then raise exception 'a refused order held stock'; end if;
  -- Holding never moved on hand.
  select quantity into qty from public.inventory_items where id = mug;
  if qty <> 5 then raise exception 'a hold moved on hand to %', qty; end if;

  -- Another business cannot hold this order, and is told it does not exist.
  r := public.inventory_order_hold(other_org, '20000000-0000-4000-8000-0000000000d1');
  if r->>'code' <> 'order_not_found' then raise exception 'cross tenant hold: %', r; end if;
  r := public.inventory_material_stock(other_org, '20000000-0000-4000-8000-0000000000f2');
  if r->>'code' <> 'material_not_found' then raise exception 'cross tenant material: %', r; end if;

  -- Cancelling the second order through the status function gives its 2 back in
  -- the same transaction; the third now fits.
  perform public.transition_merchant_order(org, '20000000-0000-4000-8000-0000000000d2', actor, 'cancelled', 'changed mind', false);
  if exists (select 1 from public.inventory_reservations where source_id = '20000000-0000-4000-8000-0000000000e3' and state <> 'released') then
    raise exception 'a cancelled order kept its hold';
  end if;
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d2');
  if r->>'code' <> 'order_not_open' then raise exception 'a cancelled order was held again: %', r; end if;
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d3');
  if r->>'code' <> 'reserved' then raise exception 'released stock not available: %', r; end if;

  -- Fulfilling the first takes 3 off the shelf once -- in transition_merchant_order,
  -- not here -- and its hold is settled as consumed in the same transaction.
  perform public.transition_merchant_order(org, '20000000-0000-4000-8000-0000000000d1', actor, 'confirmed', '', false);
  perform public.transition_merchant_order(org, '20000000-0000-4000-8000-0000000000d1', actor, 'fulfilled', '', false);
  perform public.transition_merchant_order(org, '20000000-0000-4000-8000-0000000000d1', actor, 'fulfilled', '', false);
  select quantity into qty from public.inventory_items where id = mug;
  if qty <> 2 then raise exception 'on hand after fulfilment is %, expected 2 (taken off once, not twice)', qty; end if;
  if not exists (select 1 from public.inventory_reservations where source_id = '20000000-0000-4000-8000-0000000000e1' and state = 'consumed' and settled_at is not null) then
    raise exception 'a fulfilled order kept its hold, so available would count it twice';
  end if;
  select coalesce(sum(quantity), 0) into held from public.inventory_reservations where inventory_item_id = mug and state = 'held';
  if held <> 1 then raise exception 'held is %, expected 1 (the third order)', held; end if;

  -- A fulfilled order cannot be cancelled, so shipped stock is never given back.
  refused := false;
  begin
    perform public.transition_merchant_order(org, '20000000-0000-4000-8000-0000000000d1', actor, 'cancelled', '', false);
  exception when others then refused := sqlerrm = 'status_transition_invalid';
  end;
  if not refused then raise exception 'a fulfilled order was cancelled'; end if;

  -- A job used 12 m of a 10 m reel: recorded, and on hand goes below zero
  -- rather than the job being refused. Then 3 m came back. A planned line moves nothing.
  r := public.inventory_material_stock(org, '20000000-0000-4000-8000-0000000000f2');
  if r->>'code' <> 'consumed' or (r->>'onHand')::numeric <> -2 then raise exception 'job use: %', r; end if;
  r := public.inventory_material_stock(org, '20000000-0000-4000-8000-0000000000f2');
  if r->>'code' <> 'already_recorded' then raise exception 'job use recorded twice: %', r; end if;
  r := public.inventory_material_stock(org, '20000000-0000-4000-8000-0000000000f3');
  if r->>'code' <> 'returned' or (r->>'onHand')::numeric <> 1 then raise exception 'job return: %', r; end if;
  r := public.inventory_material_stock(org, '20000000-0000-4000-8000-0000000000f4');
  if r->>'code' <> 'not_a_stock_movement' then raise exception 'planned material moved stock: %', r; end if;

  -- An archived stock item cannot be sold from, even by an order placed before.
  update public.inventory_items set status = 'archived' where id = mug;
  r := public.inventory_order_hold(org, '20000000-0000-4000-8000-0000000000d4');
  if r->>'code' <> 'insufficient_stock' then raise exception 'held from an archived item: %', r; end if;

  -- The record of a sale cannot be deleted, and clients cannot move stock.
  if has_table_privilege('service_role', 'public.inventory_reservations', 'DELETE') then raise exception 'stock history can be deleted'; end if;
  if has_function_privilege('authenticated', 'public.inventory_order_hold(uuid,uuid)', 'EXECUTE') then raise exception 'clients can hold stock'; end if;
end $$;
select 'stock_holds_ships_releases_and_isolates';
rollback;

-- Executed only in the disposable migration replay database.
--
-- Stock moving with orders and jobs: holds, shortages, fulfilment, release,
-- retries, untracked lines, jobs using and returning material, and tenancy.
begin;
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

-- Three orders: 3 mugs + a sticker; 2 mugs; 1 more mug.
insert into public.merchant_orders(id, organization_id, buyer_name, buyer_email, subtotal_cents, currency) values
  ('20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-000000000001', 'A', 'a@example.com', 3800, 'usd'),
  ('20000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-000000000001', 'B', 'b@example.com', 2400, 'usd'),
  ('20000000-0000-4000-8000-0000000000d3', '20000000-0000-4000-8000-000000000001', 'C', 'c@example.com', 1200, 'usd');
insert into public.merchant_order_lines(id, organization_id, order_id, variant_id, description, quantity, unit_price_cents, line_total_cents, currency) values
  ('20000000-0000-4000-8000-0000000000e1', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 3, 1200, 3600, 'usd'),
  ('20000000-0000-4000-8000-0000000000e2', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000c2', 'Sticker — Round', 1, 200, 200, 'usd'),
  ('20000000-0000-4000-8000-0000000000e3', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d2', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 2, 1200, 2400, 'usd'),
  ('20000000-0000-4000-8000-0000000000e4', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000d3', '20000000-0000-4000-8000-0000000000c1', 'Mug — Large', 1, 1200, 1200, 'usd');

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
  mug uuid := '20000000-0000-4000-8000-0000000000a1';
  cable uuid := '20000000-0000-4000-8000-0000000000a2';
  r jsonb;
  qty numeric;
  held numeric;
begin
  -- 3 of 5 mugs held; the sticker is untracked and does not block.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d1', 'reserve');
  if r->>'code' <> 'reserved' or (r->>'held')::int <> 1 or (r->>'untracked')::int <> 1 then raise exception 'first reserve: %', r; end if;
  -- A retry holds nothing more.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d1', 'reserve');
  if r->>'code' <> 'already_reserved' then raise exception 'retry reserved twice: %', r; end if;
  -- 2 of the remaining 2 held.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d2', 'reserve');
  if r->>'code' <> 'reserved' then raise exception 'second reserve: %', r; end if;
  -- None left: the third is refused, writes nothing, and says what is short.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d3', 'reserve');
  if r->>'code' <> 'insufficient_stock' or (r->'shortages'->0->>'available')::numeric <> 0 or (r->'shortages'->0->>'needed')::numeric <> 1 then
    raise exception 'oversold: %', r;
  end if;
  if exists (select 1 from public.inventory_reservations where source_id = '20000000-0000-4000-8000-0000000000e4') then raise exception 'a refused order held stock'; end if;
  -- Holding never moved on hand.
  select quantity into qty from public.inventory_items where id = mug;
  if qty <> 5 then raise exception 'a hold moved on hand to %', qty; end if;

  -- Another business cannot touch this order, and is told it does not exist.
  r := public.inventory_order_stock(other_org, '20000000-0000-4000-8000-0000000000d1', 'fulfil');
  if r->>'code' <> 'order_not_found' then raise exception 'cross tenant fulfil: %', r; end if;
  r := public.inventory_material_stock(other_org, '20000000-0000-4000-8000-0000000000f2');
  if r->>'code' <> 'material_not_found' then raise exception 'cross tenant material: %', r; end if;

  -- Cancelling the second order gives its 2 back; the third now fits.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d2', 'release');
  if (r->>'released')::int <> 1 then raise exception 'release: %', r; end if;
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d3', 'reserve');
  if r->>'code' <> 'reserved' then raise exception 'released stock not available: %', r; end if;

  -- Fulfilling the first takes 3 off the shelf, once.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d1', 'fulfil');
  if (r->>'consumed')::int <> 1 then raise exception 'fulfil: %', r; end if;
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d1', 'fulfil');
  if (r->>'consumed')::int <> 0 then raise exception 'fulfilled twice: %', r; end if;
  select quantity into qty from public.inventory_items where id = mug;
  if qty <> 2 then raise exception 'on hand after fulfilment is %, expected 2', qty; end if;
  -- Releasing a fulfilled order gives nothing back: the goods have left.
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d1', 'release');
  if (r->>'released')::int <> 0 then raise exception 'shipped stock released: %', r; end if;
  select coalesce(sum(quantity), 0) into held from public.inventory_reservations where inventory_item_id = mug and state = 'held';
  if held <> 1 then raise exception 'held is %, expected 1 (the third order)', held; end if;

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

  -- A cancelled order reinstated holds again, subject to stock: d2 needs 2 and
  -- 2 are available (2 on hand, d3's hold released below first).
  update public.inventory_reservations set state = 'released', settled_at = now()
   where source_id = '20000000-0000-4000-8000-0000000000e4';
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d2', 'reserve');
  if r->>'code' <> 'reserved' or (r->>'held')::int <> 1 then raise exception 'reinstated order not held again: %', r; end if;
  select coalesce(sum(quantity), 0) into held from public.inventory_reservations where inventory_item_id = mug and state = 'held';
  if held <> 2 then raise exception 'held after reinstatement is %, expected 2', held; end if;

  -- An archived stock item cannot be sold from.
  update public.inventory_items set status = 'archived' where id = mug;
  update public.inventory_reservations set state = 'released', settled_at = now() where inventory_item_id = mug and state = 'held';
  r := public.inventory_order_stock(org, '20000000-0000-4000-8000-0000000000d2', 'reserve');
  if r->>'code' <> 'insufficient_stock' then raise exception 'sold from an archived item: %', r; end if;

  -- The record of a sale cannot be deleted, and clients cannot move stock.
  if has_table_privilege('service_role', 'public.inventory_reservations', 'DELETE') then raise exception 'stock history can be deleted'; end if;
  if has_function_privilege('authenticated', 'public.inventory_order_stock(uuid,uuid,text)', 'EXECUTE') then raise exception 'clients can move stock'; end if;
end $$;
select 'stock_holds_ships_releases_and_isolates';
rollback;

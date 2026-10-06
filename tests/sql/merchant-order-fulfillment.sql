-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Executed against the real replayed schema; no public fixture tables or mocks.
begin;
create function pg_temp.require_true(value boolean, label text) returns void
  language plpgsql as $$ begin if value is not true then raise exception 'fulfillment probe failed: %', label; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void
  language plpgsql as $$ begin
    begin execute command; raise exception 'expected error %', expected;
    exception when others then if sqlerrm <> expected then raise; end if; end;
  end $$;

insert into auth.users(id, email) values ('20000000-0000-4000-8000-000000000001', 'fulfillment@example.invalid');
insert into public.organizations(id, name) values
  ('20000000-0000-4000-8000-000000000002', 'Fulfillment probe'),
  ('20000000-0000-4000-8000-000000000003', 'Other fulfillment tenant');
insert into public.inventory_items(id, organization_id, name, quantity, unit, cost_cents) values
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'Shared stock', 10, 'each', 100),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', 'Second stock', 1, 'each', 200),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', 'Other tenant stock', 99, 'each', 300);
insert into public.merchant_products(id, organization_id, name, status) values
  ('20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000002', 'Product', 'active');
insert into public.merchant_product_variants(id, organization_id, product_id, variant_name, inventory_item_id) values
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000020', 'First', '20000000-0000-4000-8000-000000000010'),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000020', 'Also first', '20000000-0000-4000-8000-000000000010'),
  ('20000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000020', 'Second', '20000000-0000-4000-8000-000000000011');
insert into public.merchant_orders(id, organization_id, buyer_name, buyer_email, subtotal_cents) select
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '20000000-0000-4000-8000-000000000002', 'Buyer', 'buyer@example.invalid', 500
  from generate_series(30, 36) n;
set local role service_role;
insert into public.merchant_order_lines(organization_id, order_id, variant_id, description, quantity, unit_price_cents, line_total_cents, currency, inventory_item_id) values
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000030', '20000000-0000-4000-8000-000000000021', 'First', 2, 100, 200, 'usd', '20000000-0000-4000-8000-000000000012'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000030', '20000000-0000-4000-8000-000000000022', 'Also first', 3, 100, 300, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000021', 'First', 1, 100, 100, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000023', 'Second', 2, 100, 200, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000021', 'First', 1, 100, 100, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000033', null, 'Untracked', 1, 100, 100, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000035', '20000000-0000-4000-8000-000000000021', 'Historical', 1, 100, 100, 'usd', null),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000036', '20000000-0000-4000-8000-000000000021', 'Receipt failure', 1, 100, 100, 'usd', null);
reset role;
-- Repoint the catalogue after purchase; the frozen link must win.
update public.merchant_product_variants set inventory_item_id = '20000000-0000-4000-8000-000000000011'
  where id in ('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000022');
select pg_temp.require_true((select bool_and(inventory_item_id = '20000000-0000-4000-8000-000000000010')
  from public.merchant_order_lines where order_id = '20000000-0000-4000-8000-000000000030'), 'snapshot ignores posted links');
update public.merchant_orders set status = 'confirmed' where id <> '20000000-0000-4000-8000-000000000030'
  and organization_id = '20000000-0000-4000-8000-000000000002';
update public.merchant_order_lines set inventory_snapshot_at = null where order_id = '20000000-0000-4000-8000-000000000035';
set local role service_role;
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'status_transition_invalid');
select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','confirmed','',false);
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'order_missing');
select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','fulfilled','',false);
select pg_temp.require_true((public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','fulfilled','',false)->>'noop')::boolean, 'retry no-op');
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','20000000-0000-4000-8000-000000000001','cancelled','',false)$q$, 'status_transition_invalid');
select pg_temp.require_true((select quantity = 5 from public.inventory_items where id = '20000000-0000-4000-8000-000000000010'), 'one combined deduction');
select pg_temp.require_true((select (stock_changes->0->>'quantity')::numeric = 5 and (stock_changes->0->>'before')::numeric = 10 and (stock_changes->0->>'after')::numeric = 5
  from public.merchant_order_fulfillments where order_id = '20000000-0000-4000-8000-000000000030'), 'stock receipt');
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000031','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'stock_insufficient');
select pg_temp.require_true((select quantity = 5 from public.inventory_items where id = '20000000-0000-4000-8000-000000000010'), 'earlier line rolled back');
select pg_temp.require_true((select status = 'confirmed' from public.merchant_orders where id = '20000000-0000-4000-8000-000000000031'), 'status rolled back');
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000032','20000000-0000-4000-8000-000000000001','fulfilled','',true)$q$, 'payment_not_ready');
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000034','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'order_lines_missing');
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000035','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'inventory_snapshot_missing');
do $$ begin
  begin
    perform public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000036','20000000-0000-4000-8000-000000000099','fulfilled','',false);
    raise exception 'receipt should fail';
  exception when foreign_key_violation then null; end;
end $$;
select pg_temp.require_true((select quantity = 5 from public.inventory_items where id = '20000000-0000-4000-8000-000000000010'), 'receipt failure rolls back stock');
select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000033','20000000-0000-4000-8000-000000000001','fulfilled','',false);
select pg_temp.require_true((select stock_changes = '[]'::jsonb from public.merchant_order_fulfillments where order_id = '20000000-0000-4000-8000-000000000033'), 'untracked receipt');
reset role;
update public.merchant_orders set payment_state = 'paid', amount_paid_cents = 500, paid_at = now(), stripe_account_id = 'acct_fulfillment123', refunded_cents = 1
  where id = '20000000-0000-4000-8000-000000000032';
set local role service_role;
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000032','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'payment_not_ready');
reset role;
update public.merchant_orders set refunded_cents = 0 where id = '20000000-0000-4000-8000-000000000032';
set local role service_role;
select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000032','20000000-0000-4000-8000-000000000001','fulfilled','',true);
select pg_temp.require_true((select quantity = 4 from public.inventory_items where id = '20000000-0000-4000-8000-000000000010'), 'paid order consumes frozen stock');
select pg_temp.require_true((select quantity = 99 from public.inventory_items where id = '20000000-0000-4000-8000-000000000012'), 'other tenant unchanged');
reset role;
-- Cross-tenant catalogue links and late line insertion fail before any stock
-- mutation. An archived item in a frozen snapshot is refused at fulfillment.
insert into public.merchant_orders(id, organization_id, buyer_name, buyer_email, subtotal_cents) values
  ('20000000-0000-4000-8000-000000000037','20000000-0000-4000-8000-000000000002','Buyer','buyer@example.invalid',100);
update public.merchant_product_variants set inventory_item_id = '20000000-0000-4000-8000-000000000012'
  where id = '20000000-0000-4000-8000-000000000021';
set local role service_role;
select pg_temp.expect_error($q$insert into public.merchant_order_lines(organization_id,order_id,variant_id,description,quantity,unit_price_cents,line_total_cents,currency)
 values('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000037','20000000-0000-4000-8000-000000000021','Cross tenant',1,100,100,'usd')$q$, 'inventory_unavailable');
select pg_temp.expect_error($q$insert into public.merchant_order_lines(organization_id,order_id,description,quantity,unit_price_cents,line_total_cents,currency)
 values('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000030','Late line',1,100,100,'usd')$q$, 'order_missing');
reset role;
update public.inventory_items set status = 'archived' where id = '20000000-0000-4000-8000-000000000010';
set local role service_role;
select pg_temp.expect_error($q$select public.transition_merchant_order('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000036','20000000-0000-4000-8000-000000000001','fulfilled','',false)$q$, 'inventory_unavailable');
reset role;
select pg_temp.require_true(not has_function_privilege('anon', 'public.transition_merchant_order(uuid,uuid,uuid,text,text,boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.transition_merchant_order(uuid,uuid,uuid,text,text,boolean)', 'execute'), 'RPC private');
select pg_temp.require_true(not has_table_privilege('service_role', 'public.merchant_order_fulfillments', 'update')
  and not has_table_privilege('service_role', 'public.merchant_order_fulfillments', 'delete')
  and not has_table_privilege('service_role', 'public.merchant_order_lines', 'update'), 'receipt and lines immutable');
select 'merchant_fulfillment_snapshots_consumes_retries_and_rolls_back';
rollback;

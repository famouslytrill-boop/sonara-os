-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Committed only inside the disposable native replay cluster.
insert into auth.users(id, email) values ('21000000-0000-4000-8000-000000000001', 'concurrency@example.invalid');
insert into public.organizations(id, name) values ('21000000-0000-4000-8000-000000000002', 'Fulfillment concurrency');
insert into public.inventory_items(id, organization_id, name, quantity) values
  ('21000000-0000-4000-8000-000000000010','21000000-0000-4000-8000-000000000002','Duplicate-click stock',3),
  ('21000000-0000-4000-8000-000000000011','21000000-0000-4000-8000-000000000002','Scarce stock',3);
insert into public.merchant_products(id, organization_id, name) values
  ('21000000-0000-4000-8000-000000000020','21000000-0000-4000-8000-000000000002','Concurrent goods');
insert into public.merchant_product_variants(id,organization_id,product_id,variant_name,inventory_item_id) values
  ('21000000-0000-4000-8000-000000000021','21000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000020','Duplicate','21000000-0000-4000-8000-000000000010'),
  ('21000000-0000-4000-8000-000000000022','21000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000020','Scarce','21000000-0000-4000-8000-000000000011');
insert into public.merchant_orders(id,organization_id,buyer_name,buyer_email,subtotal_cents) select
  ('21000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  '21000000-0000-4000-8000-000000000002','Buyer','buyer@example.invalid',200 from generate_series(30,32) n;
insert into public.merchant_order_lines(organization_id,order_id,variant_id,description,quantity,unit_price_cents,line_total_cents,currency) select
  '21000000-0000-4000-8000-000000000002',('21000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  case when n = 30 then '21000000-0000-4000-8000-000000000021'::uuid else '21000000-0000-4000-8000-000000000022'::uuid end,
  'Goods',2,100,200,'usd' from generate_series(30,32) n;
update public.merchant_orders set status = 'confirmed' where organization_id = '21000000-0000-4000-8000-000000000002';
select 'merchant_fulfillment_concurrency_ready';

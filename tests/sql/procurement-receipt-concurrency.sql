-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Persistent synthetic records inside the disposable native migration replay
-- cluster. Two independent psql sessions race on each purchase order below.
insert into auth.users(id,email)
  values('24000000-0000-4000-8000-000000000001','procurement-race@example.invalid');
insert into public.organizations(id,name)
  values('24000000-0000-4000-8000-000000000002','Procurement concurrency fixture');
insert into public.inventory_items(id,organization_id,name,quantity,unit,status)
  values('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000002','Shared receipt stock',0,'each','active');
insert into public.purchase_orders(id,organization_id,status,approval_status,approval_decided_at) values
  ('24000000-0000-4000-8000-000000000020','24000000-0000-4000-8000-000000000002','sent','approved',now()),
  ('24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000002','sent','approved',now());
insert into public.purchase_order_lines(id,organization_id,purchase_order_id,inventory_item_id,item_name,quantity_ordered,quantity_received,unit) values
  ('24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000020','24000000-0000-4000-8000-000000000010','Duplicate-click goods',2,0,'each'),
  ('24000000-0000-4000-8000-000000000031','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000010','Over-receipt attempt',3,0,'each');
select 'procurement_receipt_concurrency_ready';

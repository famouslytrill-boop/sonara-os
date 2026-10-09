-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Synthetic persistent fixture *inside disposable migration replay only*.
insert into auth.users(id,email) values
 ('26000000-0000-4000-8000-000000000001','adjustment-actor@example.invalid'),
 ('26000000-0000-4000-8000-000000000002','adjustment-reviewer@example.invalid');
insert into public.organizations(id,name) values
 ('26000000-0000-4000-8000-000000000003','Version race fixture');
insert into public.organization_memberships(organization_id,user_id,role,status) values
 ('26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000001','manager','active'),
 ('26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000002','owner','active');
insert into public.inventory_items(id,organization_id,name,quantity,unit,status) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000003','Concurrent stock',10,'each','active');
insert into public.inventory_stock_count_requests(
    id,organization_id,inventory_item_id,actor_user_id,idempotency_key,
    reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity
  ) values
  ('26000000-0000-4000-8000-000000000131','26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000001','concurrent-dup-001','cycle_count',0,'each',null,8),
  ('26000000-0000-4000-8000-000000000132','26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000001','concurrent-race-002','cycle_count',1,'each',null,7),
  ('26000000-0000-4000-8000-000000000133','26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000001','concurrent-race-003','cycle_count',1,'each',null,6);
insert into public.inventory_stock_adjustment_approvals(
  id,stock_count_request_id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values
 ('26000000-0000-4000-8000-000000000031','26000000-0000-4000-8000-000000000131','26000000-0000-4000-8000-000000000003',
  '26000000-0000-4000-8000-000000000010',
  '26000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000002',
  'concurrent-dup-001','cycle_count',0,'each',null,8,'approved'),
 ('26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000132','26000000-0000-4000-8000-000000000003',
  '26000000-0000-4000-8000-000000000010',
  '26000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000002',
  'concurrent-race-002','cycle_count',1,'each',null,7,'approved'),
 ('26000000-0000-4000-8000-000000000033','26000000-0000-4000-8000-000000000133','26000000-0000-4000-8000-000000000003',
  '26000000-0000-4000-8000-000000000010',
  '26000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000002',
  'concurrent-race-003','cycle_count',1,'each',null,6,'approved');
select 'stock_adjustment_concurrency_ready';

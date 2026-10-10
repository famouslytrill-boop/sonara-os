-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Disposable replay only. Commit a legitimate but UNATTRIBUTED stock update,
-- leaving a recorded event which does not represent an approved adjustment.
begin;
set local role service_role;
update public.inventory_items set quantity=5
  where id='26000000-0000-4000-8000-000000000010'
    and organization_id='26000000-0000-4000-8000-000000000003';
insert into public.inventory_stock_count_requests(
    id,organization_id,inventory_item_id,actor_user_id,idempotency_key,
    reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity
  ) values
  ('26000000-0000-4000-8000-000000000134','26000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000001','cross-txn-spoof-001','cycle_count',2,'each',null,5);
insert into public.inventory_stock_adjustment_approvals(
    id,stock_count_request_id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
    idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision)
values (
    '26000000-0000-4000-8000-000000000034','26000000-0000-4000-8000-000000000134',
    '26000000-0000-4000-8000-000000000003',
    '26000000-0000-4000-8000-000000000010',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000002',
    'cross-txn-spoof-001','cycle_count',2,'each',null,5,'approved');
commit;
select 'cross_tx_seeded_' || count(*)::text from public.inventory_stock_events
  where inventory_item_id='26000000-0000-4000-8000-000000000010'
    and version_after=3 and balance_after=5;

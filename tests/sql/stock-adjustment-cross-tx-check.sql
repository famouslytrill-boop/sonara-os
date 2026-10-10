-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Second, separate psql connection and transaction. Direct privileged
-- insertion of the prior committed event must NOT impersonate a stock
-- adjustment, even when IDs, versions, balances and approval all line up.
begin;
set local role service_role;
do $proof$
declare
  blocked boolean := false;
begin
  begin
    insert into public.inventory_stock_adjustments(
      organization_id,inventory_item_id,stock_event_id,approval_id,
      actor_user_id,reviewer_user_id,idempotency_key,reason,
      stock_version_before,stock_version_after,balance_before,
      balance_after,delta_quantity,held_quantity_at_post)
    select
      '26000000-0000-4000-8000-000000000003',
      '26000000-0000-4000-8000-000000000010',e.id,
      '26000000-0000-4000-8000-000000000034',
      '26000000-0000-4000-8000-000000000001',
      '26000000-0000-4000-8000-000000000002',
      'cross-txn-spoof-001','cycle_count',e.version_before,
      e.version_after,e.balance_before,e.balance_after,e.delta_quantity,0
    from public.inventory_stock_events e
    where e.inventory_item_id='26000000-0000-4000-8000-000000000010'
      and e.version_after=3;
  exception when others then
    blocked := sqlerrm = 'stock_adjustment_event_lineage_invalid';
  end;
  if not blocked then
    raise exception 'cross_transaction_adjustment_forgery_not_blocked';
  end if;
end;
$proof$;
select 'cross_tx_spoof_blocked_' || count(*)::text
  from public.inventory_stock_adjustments
  where organization_id='26000000-0000-4000-8000-000000000003';
rollback;

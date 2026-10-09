-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Runs ONLY in disposable native PostgreSQL migration replay; all changes rolled back.
begin;
create function pg_temp.require_true(v boolean, label text) returns void language plpgsql
  as $test$ begin if v is not true then raise exception 'stock journal: %', label; end if; end $test$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql
  as $test$ begin
    begin execute command; raise exception 'did_not_fail';
    exception when others then
      if sqlerrm<>expected then raise exception 'expected %, received %',expected,sqlerrm; end if;
    end;
  end $test$;

insert into auth.users(id,email) values
  ('25000000-0000-4000-8000-000000000001','counted@example.invalid'),
  ('25000000-0000-4000-8000-000000000002','reviewer@example.invalid');
insert into public.organizations(id,name) values
  ('25000000-0000-4000-8000-000000000003','Stock adjustment tenant'),
  ('25000000-0000-4000-8000-000000000004','Unrelated tenant');
insert into public.organization_memberships(organization_id,user_id,role,status) values
  ('25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000001','manager','active'),
  ('25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000002','owner','active');

insert into public.inventory_items(id,organization_id,name,quantity,unit,status) values
  ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000003','Tracked stock',10,'each','active'),
  ('25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000004','Foreign stock',5,'each','active');

select pg_temp.require_true(
  (select stock_version=0 from public.inventory_items where id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=1 from public.inventory_stock_events
      where inventory_item_id='25000000-0000-4000-8000-000000000010'
        and source='opening_snapshot' and balance_before=10 and balance_after=10 and delta_quantity=0),
  'opening quantity is explicitly a snapshot, not a historical receipt');

select pg_temp.require_true(
  not has_function_privilege('anon','public.sonara_apply_stock_count_adjustment(uuid,uuid,uuid,uuid,text,text,bigint,numeric,uuid)','execute')
  and not has_function_privilege('authenticated','public.sonara_apply_stock_count_adjustment(uuid,uuid,uuid,uuid,text,text,bigint,numeric,uuid)','execute')
  and not has_table_privilege('authenticated','public.inventory_stock_events','select')
  and not has_table_privilege('authenticated','public.inventory_stock_adjustment_approvals','insert')
  and not has_table_privilege('authenticated','public.inventory_stock_adjustments','select')
  and not has_table_privilege('service_role','public.inventory_stock_adjustments','delete')
  and not has_table_privilege('service_role','public.inventory_stock_events','insert'),
  'closed to browser and append-only even to service role');

set local role service_role;
insert into public.inventory_reservations(organization_id,inventory_item_id,source,source_id,quantity,state)
  values ('25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
          'merchant_order_line','25000000-0000-4000-8000-000000000020',3,'held');

-- Missing reviewer approval must be rejected before touching stock.
select pg_temp.expect_error($q$select public.sonara_apply_stock_count_adjustment(
  '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-001','cycle_count',0,8,'25000000-0000-4000-8000-000000000031')$q$,
  'stock_adjustment_approval_evidence_missing');

insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values(
  '25000000-0000-4000-8000-000000000031','25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-001','cycle_count',0,'each',null,8,'approved');

select pg_temp.require_true(
  (public.sonara_apply_stock_count_adjustment(
    '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
    '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
    'stock-req-001','cycle_count',0,8,'25000000-0000-4000-8000-000000000031')->>'code')='adjustment_recorded',
  'approved adjustment posts once');
select pg_temp.require_true(
  (select quantity=8 and stock_version=1 from public.inventory_items
   where id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=2 from public.inventory_stock_events
   where inventory_item_id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=1 from public.inventory_stock_adjustments
   where organization_id='25000000-0000-4000-8000-000000000003'
     and balance_before=10 and balance_after=8 and delta_quantity=-2 and held_quantity_at_post=3),
  'stock, version and both ledgers atomic');

select pg_temp.require_true(
  (public.sonara_apply_stock_count_adjustment(
    '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
    '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
    'stock-req-001','cycle_count',0,8,'25000000-0000-4000-8000-000000000031')->>'code')='already_recorded',
  'identical retry does not repost');
select pg_temp.expect_error($q$select public.sonara_apply_stock_count_adjustment(
  '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-001','cycle_count',0,9,'25000000-0000-4000-8000-000000000031')$q$,
  'stock_adjustment_approval_evidence_missing');

-- A second reviewer and a valid quantity do not constitute product quarantine,
-- recall, supplier correction, or return evidence. Those workflows are blocked.
insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values(
  '25000000-0000-4000-8000-000000000036',
  '25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000002',
  'stock-loss-006','damaged',1,'each',null,7,'approved');
select pg_temp.expect_error($q$select public.sonara_apply_stock_count_adjustment(
  '25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000002',
  'stock-loss-006','damaged',1,7,'25000000-0000-4000-8000-000000000036'
)$q$, 'stock_custody_evidence_required');
select pg_temp.require_true(
  (select quantity=8 and stock_version=1 from public.inventory_items
   where id='25000000-0000-4000-8000-000000000010'),
  'unaudited damage must not move sellable stock');

-- Real queue and owner approval must not allow an older stock snapshot.
insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values(
  '25000000-0000-4000-8000-000000000032','25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-002','cycle_count',0,'each',null,7,'approved');
select pg_temp.expect_error($q$select public.sonara_apply_stock_count_adjustment(
  '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-002','cycle_count',0,7,'25000000-0000-4000-8000-000000000032')$q$,
  'stock_version_conflict');

-- Existing work-order/checkout writers still update quantity; all changes
-- receive a version and unattributed journal record until cutover is complete.
update public.inventory_items set quantity=7
  where id='25000000-0000-4000-8000-000000000010';
select pg_temp.require_true(
  (select stock_version=2 from public.inventory_items
     where id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=3 from public.inventory_stock_events
     where inventory_item_id='25000000-0000-4000-8000-000000000010'),
  'unattributed direct quantity write is still visible and versioned');
select pg_temp.expect_error($q$update public.inventory_items set stock_version=99
  where id='25000000-0000-4000-8000-000000000010'$q$,
  'inventory_stock_version_managed_by_database');
select pg_temp.expect_error($q$update public.inventory_items
  set organization_id='25000000-0000-4000-8000-000000000004'
  where id='25000000-0000-4000-8000-000000000010'$q$,
  'inventory_tenant_reassignment_forbidden');

-- Even an unchanged physical count must check corrupted prior reservations.
update public.inventory_reservations set quantity=8
  where organization_id='25000000-0000-4000-8000-000000000003'
    and inventory_item_id='25000000-0000-4000-8000-000000000010';
insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values(
  '25000000-0000-4000-8000-000000000033','25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-003','cycle_count',2,'each',null,7,'approved');
select pg_temp.expect_error($q$select public.sonara_apply_stock_count_adjustment(
  '25000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-req-003','cycle_count',2,7,'25000000-0000-4000-8000-000000000033')$q$,
  'stock_adjustment_violates_holds');


-- A previously recorded unattributed edit must NOT be relabelled as a
-- reviewer-authorized correction via a new privileged INSERT.
update public.inventory_reservations set quantity=3
  where organization_id='25000000-0000-4000-8000-000000000003'
    and inventory_item_id='25000000-0000-4000-8000-000000000010';
update public.inventory_items set quantity=6
  where id='25000000-0000-4000-8000-000000000010';
insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision) values(
  '25000000-0000-4000-8000-000000000034','25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000002',
  'stock-fake-004','cycle_count',1,'each',null,7,'approved');
select pg_temp.expect_error($q$
  insert into public.inventory_stock_adjustments(
    organization_id,inventory_item_id,stock_event_id,approval_id,
    actor_user_id,reviewer_user_id,idempotency_key,reason,
    stock_version_before,stock_version_after,balance_before,balance_after,
    delta_quantity,held_quantity_at_post)
  select '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000010',e.id,
    '25000000-0000-4000-8000-000000000034',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    'stock-fake-004','cycle_count',1,2,8,7,-1,3
  from public.inventory_stock_events e
    where e.inventory_item_id='25000000-0000-4000-8000-000000000010'
      and e.version_after=2
$q$, 'stock_adjustment_current_item_mismatch');
select pg_temp.require_true(
  (select quantity=6 and stock_version=3 from public.inventory_items
    where id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=1 from public.inventory_stock_adjustments
    where organization_id='25000000-0000-4000-8000-000000000003'),
  'privileged forged historical adjustment did not post');



-- Attack 2: even in the SAME transaction as a change, an approval created
-- after that movement must not retroactively label the movement as approved.
-- Also show callers cannot forge approved_at='2001...' to backdate consent.
update public.inventory_items set quantity=5
  where id='25000000-0000-4000-8000-000000000010';
select pg_sleep(0.005);
insert into public.inventory_stock_adjustment_approvals(
  id,organization_id,inventory_item_id,actor_user_id,reviewer_user_id,
  idempotency_key,reason,expected_stock_version,expected_unit,expected_location_id,counted_quantity,decision,
  approved_at
) values(
  '25000000-0000-4000-8000-000000000035',
  '25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000002',
  'stock-fake-005','cycle_count',3,'each',null,5,'approved','2001-01-01T00:00:00Z');
select pg_temp.require_true(
  (select approved_at > '2026-01-01T00:00:00Z'::timestamptz
   from public.inventory_stock_adjustment_approvals
   where id='25000000-0000-4000-8000-000000000035'),
  'approval timestamp cannot be backdated by the supplied payload');
select pg_temp.expect_error($q$
  insert into public.inventory_stock_adjustments(
    organization_id,inventory_item_id,stock_event_id,approval_id,
    actor_user_id,reviewer_user_id,idempotency_key,reason,
    stock_version_before,stock_version_after,balance_before,balance_after,
    delta_quantity,held_quantity_at_post)
  select '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000010',e.id,
    '25000000-0000-4000-8000-000000000035',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    'stock-fake-005','cycle_count',3,4,6,5,-1,3
  from public.inventory_stock_events e
    where e.inventory_item_id='25000000-0000-4000-8000-000000000010'
      and e.version_after=4
$q$, 'stock_adjustment_approval_lineage_invalid');
select pg_temp.require_true(
  (select quantity=5 and stock_version=4 from public.inventory_items
   where id='25000000-0000-4000-8000-000000000010')
  and (select count(*)=1 from public.inventory_stock_adjustments
    where organization_id='25000000-0000-4000-8000-000000000003'),
  'post-factum approval did not rewrite the ledger');


reset role;
select pg_temp.require_true(
  (select quantity=5 from public.inventory_items
   where id='25000000-0000-4000-8000-000000000011'),
  'foreign tenant untouched');
select 'stock_version_journal_approvals_and_holds_passed';
rollback;

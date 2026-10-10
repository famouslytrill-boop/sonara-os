-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
-- Executed ONLY against a throwaway PostgreSQL migration replay cluster.
begin;
create function pg_temp.require_true(value boolean, label text) returns void
  language plpgsql as $test$ begin if value is not true then raise exception 'procurement replay assertion failed: %', label; end if; end $test$;
create function pg_temp.expect_error(command text, expected text) returns void
  language plpgsql as $test$ begin
    begin
      execute command;
      raise exception 'did_not_fail';
    exception when others then
      if sqlerrm <> expected then raise exception 'expected %; got %', expected, sqlerrm; end if;
    end;
  end $test$;

insert into auth.users(id, email)
  values ('23000000-0000-4000-8000-000000000001', 'receipt-actor@example.invalid');
insert into public.organizations(id,name) values
  ('23000000-0000-4000-8000-000000000002','Receiving org A'),
  ('23000000-0000-4000-8000-000000000003','Receiving org B');

insert into public.inventory_items(id,organization_id,name,quantity,unit,status) values
  ('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000002','Cases',2,'each','active'),
  ('23000000-0000-4000-8000-000000000011','23000000-0000-4000-8000-000000000002','Rejectable cases',0,'each','active'),
  ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000003','Private stock',8,'each','active');

insert into public.purchase_orders(id,organization_id,status,approval_status,approval_decided_at,approval_decided_by,approval_version) values
  ('23000000-0000-4000-8000-000000000020','23000000-0000-4000-8000-000000000002','sent','approved',now(),'23000000-0000-4000-8000-000000000001',2),
  ('23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000002','sent','approved',now(),'23000000-0000-4000-8000-000000000001',2),
  ('23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000002','sent' ,'pending',null,null,0),
  ('23000000-0000-4000-8000-000000000023','23000000-0000-4000-8000-000000000003','sent','approved',now(),'23000000-0000-4000-8000-000000000001',2);
insert into public.purchase_order_lines(id,organization_id,purchase_order_id,inventory_item_id,item_name,quantity_ordered,quantity_received,unit) values
  ('23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020','23000000-0000-4000-8000-000000000010','Cases',10,0,'each'),
  ('23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000011','Rejectable cases',5,0,'each'),
  ('23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000010','Pending approval',1,0,'each'),
  ('23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000023','23000000-0000-4000-8000-000000000012','Tenant B',2,0,'each');

select pg_temp.require_true(
  not has_function_privilege('anon','public.sonara_receive_purchase_order_line(uuid,uuid,uuid,uuid,text,text,text,numeric,numeric)','execute')
  and not has_function_privilege('authenticated','public.sonara_receive_purchase_order_line(uuid,uuid,uuid,uuid,text,text,text,numeric,numeric)','execute')
  and not has_table_privilege('authenticated','public.procurement_receipt_entries','insert')
  and not has_table_privilege('anon','public.inventory_procurement_receipt_ledger','select'), 'browser cannot post receipts');

set local role service_role;
select pg_temp.require_true(
  (public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a001','LOT-A','each',3,0)->>'code')='receipt_recorded', 'first receipt posts');

select pg_temp.require_true(
  (select quantity=5 from public.inventory_items where id='23000000-0000-4000-8000-000000000010'), 'first receipt inventory +3');

select pg_temp.require_true(
  (public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a001','LOT-A','each',3,0)->>'code')='already_recorded', 'idempotent retry');

select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a001','LOT-A','each',2,0)$q$, 'receipt_idempotency_conflict');

select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a002','LOT-A','each',1,0)$q$, 'purchase_order_missing');

select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000022',
    '23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000001',
    'receive-a003','LOT-A','each',1,0)$q$, 'purchase_order_not_receivable');

-- A forged 'approved' string with no approver/version evidence must fail.
update public.purchase_orders set approval_status='approved',
  approval_decided_at=now(), approval_decided_by=null, approval_version=1
  where id='23000000-0000-4000-8000-000000000022';
select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000022',
    '23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000001',
    'receive-a009','LOT-A','each',1,0)$q$, 'purchase_order_approval_evidence_missing');

select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a004','LOT-A','kg',1,0)$q$, 'purchase_order_line_invalid');

select pg_temp.expect_error($q$select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a005','LOT-A','each',8,0)$q$, 'receipt_exceeds_ordered_quantity');

select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000030','23000000-0000-4000-8000-000000000001',
    'receive-a006','LOT-A','each',7,0);
select pg_temp.require_true(
  (select status='received' from public.purchase_orders where id='23000000-0000-4000-8000-000000000020')
  and (select quantity=12 from public.inventory_items where id='23000000-0000-4000-8000-000000000010')
  and (select count(*)=2 from public.inventory_procurement_receipt_ledger
       where organization_id='23000000-0000-4000-8000-000000000002'), 'full PO exactly once');

-- Rejects are physical evidence, not usable stock. The PO stays partial
-- until a supplier exception/replacement workflow is explicitly approved.
select public.sonara_receive_purchase_order_line(
    '23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000021',
    '23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000001',
    'receive-b001','LOT-B','each',2,1);
select pg_temp.require_true(
  (select quantity=2 from public.inventory_items where id='23000000-0000-4000-8000-000000000011')
  and (select quantity_received=2 from public.purchase_order_lines where id='23000000-0000-4000-8000-000000000031')
  and (select status='partially_received' from public.purchase_orders where id='23000000-0000-4000-8000-000000000021')
  and (select rejected_quantity=1 from public.procurement_receipt_entries where idempotency_key='receive-b001'),
  'rejection quarantined from usable stock');

-- Direct forged multi-tenant reference must also fail, even for service_role.
select pg_temp.expect_error($q$insert into public.procurement_receipt_entries(
  organization_id,purchase_order_id,purchase_order_line_id,inventory_item_id,actor_user_id,
  idempotency_key,lot_code,unit,accepted_quantity,rejected_quantity,prior_line_accepted,after_line_accepted)
  values('23000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000023',
    '23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000012',
    '23000000-0000-4000-8000-000000000001','forge-00001','LOT-B','each',1,0,0,1)$q$,
  'procurement_receipt_tenant_lineage_invalid');

select pg_temp.require_true(
  (select quantity=8 from public.inventory_items where id='23000000-0000-4000-8000-000000000012')
  and (select count(*)=3 from public.procurement_receipt_entries
       where organization_id='23000000-0000-4000-8000-000000000002'),
  'other tenant unchanged and three receipts only');

select 'procurement_receipt_atomic_retries_tenant_isolation';
rollback;

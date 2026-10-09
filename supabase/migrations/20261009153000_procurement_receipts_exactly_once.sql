-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- Draft, append-only receiving contract. Not production-activated by this PR.
-- Existing purchase_orders / purchase_order_lines / inventory_items are the
-- authority; this migration introduces an immutable receipt/stock delta trail.
-- It deliberately does NOT pretend to backfill historic stock operations.
--
-- The caller must resolve tenant, actor role and approved purchase authority
-- server-side. No browser call to this service-role-only RPC is permitted.
begin;

create table public.procurement_receipt_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id),
  purchase_order_line_id uuid not null references public.purchase_order_lines(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128 and idempotency_key = btrim(idempotency_key)),
  lot_code text not null check (char_length(btrim(lot_code)) between 1 and 80),
  unit text not null check (char_length(btrim(unit)) between 1 and 32),
  accepted_quantity numeric(12,3) not null check (accepted_quantity >= 0 and accepted_quantity::text not in ('NaN','Infinity','-Infinity')),
  rejected_quantity numeric(12,3) not null check (rejected_quantity >= 0 and rejected_quantity::text not in ('NaN','Infinity','-Infinity')),
  prior_line_accepted numeric(12,3) not null check (prior_line_accepted >= 0),
  after_line_accepted numeric(12,3) not null check (after_line_accepted >= prior_line_accepted),
  created_at timestamptz not null default now(),
  constraint procurement_receipt_nonempty check (accepted_quantity + rejected_quantity > 0),
  constraint procurement_receipt_progress check (after_line_accepted = prior_line_accepted + accepted_quantity),
  constraint procurement_receipt_unique_request unique (organization_id, idempotency_key)
);
create index procurement_receipt_line_idx
  on public.procurement_receipt_entries(organization_id, purchase_order_line_id, created_at);

-- The ledger records ONLY receiving stock changes; a complete stock ledger
-- requires separate audited integrations for storefront, jobs, transfers, etc.
create table public.inventory_procurement_receipt_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_id uuid not null unique references public.procurement_receipt_entries(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  lot_code text not null,
  unit text not null,
  delta_quantity numeric(12,3) not null check (delta_quantity > 0),
  balance_before numeric not null,
  balance_after numeric not null,
  created_at timestamptz not null default now(),
  constraint inventory_procurement_balance_invariant check (
    balance_before >= 0 and balance_after = balance_before + delta_quantity
    and balance_before::text not in ('NaN','Infinity','-Infinity')
    and balance_after::text not in ('NaN','Infinity','-Infinity')
  )
);
create index inventory_procurement_ledger_item_idx
  on public.inventory_procurement_receipt_ledger(organization_id, inventory_item_id, created_at desc);

-- New tables are not exposed to anonymous or authenticated clients.
-- No UPDATE or DELETE grants: a correction is a reviewed compensation record,
-- not a silent rewrite of custody evidence.
alter table public.procurement_receipt_entries enable row level security;
alter table public.inventory_procurement_receipt_ledger enable row level security;
revoke all on public.procurement_receipt_entries from public, anon, authenticated, service_role;
revoke all on public.inventory_procurement_receipt_ledger from public, anon, authenticated, service_role;
grant select, insert on public.procurement_receipt_entries to service_role;
grant select, insert on public.inventory_procurement_receipt_ledger to service_role;
create policy procurement_receipt_service_only on public.procurement_receipt_entries
  for all to service_role using (true) with check (true);
create policy inventory_procurement_ledger_service_only on public.inventory_procurement_receipt_ledger
  for all to service_role using (true) with check (true);

-- Foreign keys to globally unique IDs alone do not enforce that the copied
-- organization is the same as the referenced record's organization. Validate
-- seller/buyer-owned lineage even on a direct privileged insert.
create function public.sonara_guard_procurement_receipt_tenant()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1
      from public.purchase_order_lines l
      join public.purchase_orders o
        on o.id = l.purchase_order_id and o.organization_id = l.organization_id
      join public.inventory_items i
        on i.id = l.inventory_item_id and i.organization_id = l.organization_id
     where l.id = new.purchase_order_line_id
       and l.purchase_order_id = new.purchase_order_id
       and l.organization_id = new.organization_id
       and i.id = new.inventory_item_id
  ) then
    raise exception 'procurement_receipt_tenant_lineage_invalid';
  end if;
  return new;
end;
$$;
revoke all on function public.sonara_guard_procurement_receipt_tenant() from public, anon, authenticated;
grant execute on function public.sonara_guard_procurement_receipt_tenant() to service_role;
create trigger procurement_receipt_enforce_tenant
before insert on public.procurement_receipt_entries
for each row execute function public.sonara_guard_procurement_receipt_tenant();

create function public.sonara_guard_procurement_ledger_receipt()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.procurement_receipt_entries r
    where r.id = new.receipt_id
      and r.organization_id = new.organization_id
      and r.inventory_item_id = new.inventory_item_id
      and r.lot_code = new.lot_code
      and lower(r.unit) = lower(new.unit)
      and r.accepted_quantity = new.delta_quantity
  ) then
    raise exception 'procurement_ledger_receipt_lineage_invalid';
  end if;
  return new;
end;
$$;
revoke all on function public.sonara_guard_procurement_ledger_receipt() from public, anon, authenticated;
grant execute on function public.sonara_guard_procurement_ledger_receipt() to service_role;
create trigger procurement_ledger_enforce_receipt
before insert on public.inventory_procurement_receipt_ledger
for each row execute function public.sonara_guard_procurement_ledger_receipt();

-- Strict server service-role RPC. Important ordering: purchase order ->
-- purchase order line -> inventory item. This serializes partial receipts for
-- the PO, then shares the item's lock with existing stock order/job functions.
create function public.sonara_receive_purchase_order_line(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_purchase_order_line_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_lot_code text,
  p_unit text,
  p_accepted_quantity numeric,
  p_rejected_quantity numeric
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_line public.purchase_order_lines%rowtype;
  v_item public.inventory_items%rowtype;
  v_existing public.procurement_receipt_entries%rowtype;
  v_receipt_id uuid;
  v_previously_processed numeric := 0;
  v_prior_accepted numeric := 0;
  v_line_accepted numeric;
  v_new_stock numeric;
  v_unreceived_count bigint;
  v_status text;
begin
  if p_organization_id is null or p_purchase_order_id is null
     or p_purchase_order_line_id is null or p_actor_user_id is null
     or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 128
     or p_idempotency_key <> btrim(p_idempotency_key)
     or p_lot_code is null or length(btrim(p_lot_code)) not between 1 and 80
     or p_unit is null or length(btrim(p_unit)) not between 1 and 32
     or p_accepted_quantity is null or p_rejected_quantity is null
     or p_accepted_quantity::text in ('NaN','Infinity','-Infinity')
     or p_rejected_quantity::text in ('NaN','Infinity','-Infinity')
     or p_accepted_quantity < 0 or p_rejected_quantity < 0
     or p_accepted_quantity <> trunc(p_accepted_quantity, 3)
     or p_rejected_quantity <> trunc(p_rejected_quantity, 3)
     or p_accepted_quantity + p_rejected_quantity <= 0 then
    raise exception 'receipt_invalid';
  end if;

  select * into v_po from public.purchase_orders
    where id = p_purchase_order_id and organization_id = p_organization_id for update;
  if not found then raise exception 'purchase_order_missing'; end if;

  -- Retries must still originate from the same organization, order, line,
  -- actor and payload. An identical retry never adds stock again.
  select * into v_existing from public.procurement_receipt_entries
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.purchase_order_id <> p_purchase_order_id
       or v_existing.purchase_order_line_id <> p_purchase_order_line_id
       or v_existing.actor_user_id is distinct from p_actor_user_id
       or v_existing.lot_code <> btrim(p_lot_code)
       or lower(v_existing.unit) <> lower(btrim(p_unit))
       or v_existing.accepted_quantity <> p_accepted_quantity
       or v_existing.rejected_quantity <> p_rejected_quantity then
      raise exception 'receipt_idempotency_conflict';
    end if;
    return jsonb_build_object('ok', true, 'code', 'already_recorded',
      'receipt_id', v_existing.id, 'stock_posted', false);
  end if;

  if v_po.approval_status is distinct from 'approved'
     or v_po.status not in ('sent', 'partially_received') then
    raise exception 'purchase_order_not_receivable';
  end if;
  if v_po.approval_decided_at is null or v_po.approval_decided_by is null
     or v_po.approval_version < 2 then
    raise exception 'purchase_order_approval_evidence_missing';
  end if;

  select * into v_line from public.purchase_order_lines
    where id = p_purchase_order_line_id and purchase_order_id = p_purchase_order_id
      and organization_id = p_organization_id for update;
  if not found then raise exception 'purchase_order_line_missing'; end if;
  if v_line.inventory_item_id is null or v_line.quantity_ordered is null
     or v_line.quantity_ordered <= 0
     or v_line.quantity_ordered::text in ('NaN','Infinity','-Infinity')
     or v_line.unit is null
     or lower(btrim(v_line.unit)) <> lower(btrim(p_unit)) then
    raise exception 'purchase_order_line_invalid';
  end if;

  select * into v_item from public.inventory_items
    where id = v_line.inventory_item_id and organization_id = p_organization_id for update;
  if not found or v_item.status <> 'active'
     or v_item.unit is null or lower(btrim(v_item.unit)) <> lower(btrim(p_unit))
     or v_item.quantity is null or v_item.quantity < 0
     or v_item.quantity::text in ('NaN','Infinity','-Infinity') then
    raise exception 'inventory_item_invalid';
  end if;
  if v_po.location_id is not null
     and v_item.location_id is distinct from v_po.location_id then
    raise exception 'purchase_order_location_mismatch';
  end if;

  -- If prior receipts were entered outside this ledger, do NOT silently
  -- accept a false opening balance. Reconcile/backfill under review first.
  select coalesce(sum(accepted_quantity + rejected_quantity), 0),
         coalesce(sum(accepted_quantity), 0)
    into v_previously_processed, v_prior_accepted
    from public.procurement_receipt_entries
    where organization_id = p_organization_id
      and purchase_order_line_id = p_purchase_order_line_id;

  if coalesce(v_line.quantity_received, 0) <> v_prior_accepted then
    raise exception 'legacy_receipt_reconciliation_required';
  end if;
  if v_previously_processed + p_accepted_quantity + p_rejected_quantity > v_line.quantity_ordered then
    raise exception 'receipt_exceeds_ordered_quantity';
  end if;

  v_line_accepted := v_prior_accepted + p_accepted_quantity;
  if v_line_accepted <> trunc(v_line_accepted, 3)
     or v_line_accepted > 999999999.999 then
    raise exception 'receipt_balance_out_of_range';
  end if;

  insert into public.procurement_receipt_entries(
    organization_id, purchase_order_id, purchase_order_line_id,
    inventory_item_id, actor_user_id, idempotency_key, lot_code, unit,
    accepted_quantity, rejected_quantity, prior_line_accepted, after_line_accepted
  ) values (
    p_organization_id, p_purchase_order_id, p_purchase_order_line_id,
    v_item.id, p_actor_user_id, p_idempotency_key, btrim(p_lot_code), btrim(p_unit),
    p_accepted_quantity, p_rejected_quantity, v_prior_accepted, v_line_accepted
  ) returning id into v_receipt_id;

  if p_accepted_quantity > 0 then
    v_new_stock := v_item.quantity + p_accepted_quantity;
    update public.inventory_items
       set quantity = v_new_stock, updated_at = now()
       where id = v_item.id and organization_id = p_organization_id;
    insert into public.inventory_procurement_receipt_ledger(
      organization_id, receipt_id, inventory_item_id, lot_code, unit,
      delta_quantity, balance_before, balance_after
    ) values (
      p_organization_id, v_receipt_id, v_item.id, btrim(p_lot_code), btrim(p_unit),
      p_accepted_quantity, v_item.quantity, v_new_stock
    );
  end if;

  update public.purchase_order_lines set quantity_received = v_line_accepted
    where id = p_purchase_order_line_id and organization_id = p_organization_id;

  -- All lines must have fully accepted quantities to mark PO received.
  -- Rejected units are recorded, not quietly counted as usable stock.
  select count(*) into v_unreceived_count
    from public.purchase_order_lines
    where organization_id = p_organization_id and purchase_order_id = p_purchase_order_id
      and (quantity_ordered is null or quantity_ordered <= 0
        or coalesce(quantity_received, 0) < quantity_ordered);
  v_status := case when v_unreceived_count = 0 then 'received' else 'partially_received' end;
  update public.purchase_orders
     set status = v_status, updated_at = now()
     where id = p_purchase_order_id and organization_id = p_organization_id;

  return jsonb_build_object('ok', true, 'code', 'receipt_recorded',
    'receipt_id', v_receipt_id, 'purchase_order_status', v_status,
    'accepted', p_accepted_quantity, 'rejected', p_rejected_quantity,
    'stock_posted', p_accepted_quantity > 0);
end;
$$;
revoke all on function public.sonara_receive_purchase_order_line(
  uuid,uuid,uuid,uuid,text,text,text,numeric,numeric
) from public, anon, authenticated;
grant execute on function public.sonara_receive_purchase_order_line(
  uuid,uuid,uuid,uuid,text,text,text,numeric,numeric
) to service_role;

comment on function public.sonara_receive_purchase_order_line(
  uuid,uuid,uuid,uuid,text,text,text,numeric,numeric
) is 'Service-only atomic PO receipt preflight and posting. Server must authorize actor/organization/approval. No direct browser use.';

commit;

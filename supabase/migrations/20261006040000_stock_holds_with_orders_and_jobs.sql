-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- Stock held by orders, and moved by jobs.
--
-- inventory_items.quantity was a number somebody typed. 20261006035501 (Codex)
-- made fulfilment take a storefront order's stock off the shelf: each order line
-- freezes its stock link when it is inserted, and `transition_merchant_order`
-- consumes those links when a confirmed order is fulfilled, writing a stock
-- receipt in the same transaction. That is the one place an order moves on-hand
-- stock, and this migration leaves it so.
--
-- What it does not do is stop the last item being sold twice. Two buyers can
-- both place and pay for the last mug; the second fulfilment then fails with
-- `stock_insufficient` after the money has been taken, and giving it back is a
-- refund -- which AGENTS.md reserves for the owner. This adds the hold that
-- refuses the second order while the buyer can still be told no, and the stock
-- movement for a job's materials, which nothing recorded.
--
-- This replaces 20261006030000, which was never applied anywhere. That version
-- also took fulfilled stock off the shelf; with 20261006035501 merged, both
-- would have run and a shipped order would have left the shelf twice.
--
-- ## The ledger
--
-- inventory_reservations is one row per stock movement a sale or a job caused:
--
--   held      an order line is waiting to ship; the units are spoken for
--   consumed  the goods left: the order was fulfilled, or a job used material
--   released  the order was cancelled before it shipped; the hold is given back
--   returned  a job gave material back to the shelf
--
-- **Available = on hand - held.** On hand moves only when goods move:
-- `transition_merchant_order` on fulfilment, and a job's material used or
-- returned. A hold never touches it.
--
-- ## Holding, fulfilling and cancelling agree
--
-- `inventory_order_hold` locks the order row and then its stock items in id
-- order -- the same order `transition_merchant_order` takes them -- so a hold and
-- a fulfilment for the same item queue rather than read each other half-done,
-- and two holds for the last item cannot both succeed. A trigger on the order's
-- status settles its holds in the transaction that changed it: `fulfilled`
-- marks them consumed (the function has already taken the stock), `cancelled`
-- releases them. Held stock and on-hand stock cannot drift apart between two
-- requests, because there is no second request.
--
-- Holds read the line's frozen link (`merchant_order_lines.inventory_item_id`),
-- the same one fulfilment consumes, so re-linking a variant after an order is
-- placed changes neither what that order holds nor what it ships.
--
-- ## Why there is no foreign key to the source
--
-- business_work_order_materials is deleted with its work order (on delete
-- cascade), and the record that stock left the shelf must neither block that nor
-- vanish with it. `source` + `source_id` name the row; the functions check that it
-- belongs to the organization before they write; a unique index makes each
-- source move stock at most once, so a retried request cannot take it twice.
--
-- ## What this does not do
--
--   * **No refund restocks anything.** A refund is money; whether the goods came
--     back is a physical fact the owner records.
--   * **A job is never refused for want of stock.** The material is already used
--     when the line is recorded. On hand may go below zero, and that means the
--     count needs checking. Only a *sale* is refused when stock is short, because
--     a buyer can still be told no.
--   * **Nothing is deleted.** Rows change state; the grants withhold DELETE.

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- NO ACTION rather than RESTRICT: deleting a stock item that has history is
  -- refused, but an organization's own cascade (which removes both) is checked at
  -- the end of the statement and goes through.
  inventory_item_id uuid not null references public.inventory_items(id),
  source text not null check (source in ('merchant_order_line', 'work_order_material')),
  source_id uuid not null,
  quantity numeric(12,2) not null check (quantity > 0),
  state text not null default 'held' check (state in ('held', 'consumed', 'released', 'returned')),
  reason text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_reservations_settled_when_not_held check ((state = 'held') = (settled_at is null))
);

-- Each source moves stock at most once.
create unique index if not exists inventory_reservations_source_once
  on public.inventory_reservations (source, source_id);
create index if not exists inventory_reservations_item_held_idx
  on public.inventory_reservations (organization_id, inventory_item_id) where state = 'held';
create index if not exists inventory_reservations_organization_idx
  on public.inventory_reservations (organization_id, created_at desc);

alter table public.inventory_reservations enable row level security;
-- Everything off first, then exactly what is meant: a plain grant adds to the
-- platform's default privileges on a new table (see 20261006020000).
revoke all on public.inventory_reservations from public, anon, authenticated, service_role;
grant select, insert, update on public.inventory_reservations to service_role;

-- Hold one storefront order's stock when it is placed, all of it or none of it.
create or replace function public.inventory_order_hold(p_organization_id uuid, p_order_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ord record;
  rec record;
  shortages jsonb := '[]'::jsonb;
  held_lines integer := 0;
  untracked integer := 0;
begin
  if p_organization_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_stock_request');
  end if;

  -- The order first, then its items in id order: the order fulfilment locks them in.
  select o.id, o.status into ord
    from public.merchant_orders o
   where o.id = p_order_id and o.organization_id = p_organization_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;
  if ord.status not in ('placed', 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'order_not_open');
  end if;

  select count(*) into untracked
    from public.merchant_order_lines l
   where l.order_id = p_order_id and l.organization_id = p_organization_id and l.inventory_item_id is null;

  -- A retry holds nothing more.
  if exists (
    select 1 from public.inventory_reservations r
      join public.merchant_order_lines l on l.id = r.source_id
     where r.source = 'merchant_order_line' and r.organization_id = p_organization_id and l.order_id = p_order_id
  ) then
    return jsonb_build_object('ok', true, 'code', 'already_reserved', 'untracked', untracked);
  end if;

  perform 1 from public.inventory_items i
   where i.organization_id = p_organization_id
     and i.id in (select l.inventory_item_id from public.merchant_order_lines l
                   where l.order_id = p_order_id and l.organization_id = p_organization_id)
   order by i.id
   for update;

  -- Per item, not per line: two lines may draw on the same shelf.
  for rec in
    select i.id as item_id, i.name, i.status, i.quantity as on_hand, sum(l.quantity)::numeric as needed,
           coalesce((select sum(h.quantity) from public.inventory_reservations h
                      where h.inventory_item_id = i.id and h.organization_id = p_organization_id and h.state = 'held'), 0) as held
      from public.merchant_order_lines l
      join public.inventory_items i on i.id = l.inventory_item_id and i.organization_id = p_organization_id
     where l.order_id = p_order_id and l.organization_id = p_organization_id
     group by i.id, i.name, i.status, i.quantity
  loop
    -- An item whose count was never recorded is not an item with plenty.
    if rec.status <> 'active' or rec.on_hand is null or rec.on_hand - rec.held < rec.needed then
      shortages := shortages || jsonb_build_object(
        'item', rec.item_id, 'name', rec.name, 'needed', rec.needed,
        'available', case when rec.status = 'active' and rec.on_hand is not null then greatest(rec.on_hand - rec.held, 0) else 0 end);
    end if;
  end loop;
  if jsonb_array_length(shortages) > 0 then
    return jsonb_build_object('ok', false, 'code', 'insufficient_stock', 'shortages', shortages);
  end if;

  insert into public.inventory_reservations (organization_id, inventory_item_id, source, source_id, quantity, state)
  select p_organization_id, l.inventory_item_id, 'merchant_order_line', l.id, l.quantity, 'held'
    from public.merchant_order_lines l
   where l.order_id = p_order_id and l.organization_id = p_organization_id and l.inventory_item_id is not null
  on conflict (source, source_id) do nothing;
  get diagnostics held_lines = row_count;
  return jsonb_build_object('ok', true, 'code', 'reserved', 'held', held_lines, 'untracked', untracked);
end;
$$;

-- Settle an order's holds in the transaction that fulfilled or cancelled it.
create or replace function public.settle_inventory_holds_on_order_status()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.inventory_reservations r
     set state = case when new.status = 'fulfilled' then 'consumed' else 'released' end,
         reason = case when new.status = 'fulfilled' then 'order_fulfilled' else 'order_cancelled' end,
         settled_at = now(),
         updated_at = now()
   where r.organization_id = new.organization_id
     and r.source = 'merchant_order_line'
     and r.state = 'held'
     and r.source_id in (select l.id from public.merchant_order_lines l
                          where l.order_id = new.id and l.organization_id = new.organization_id);
  return null;
end;
$$;
drop trigger if exists merchant_orders_settle_inventory_holds on public.merchant_orders;
create trigger merchant_orders_settle_inventory_holds
  after update of status on public.merchant_orders
  for each row
  when (old.status is distinct from new.status and new.status in ('fulfilled', 'cancelled'))
  execute function public.settle_inventory_holds_on_order_status();

-- Record one work-order material line as stock that left (used) or came back
-- (returned). Planned, reserved and cancelled lines move nothing.
create or replace function public.inventory_material_stock(p_organization_id uuid, p_material_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  material record;
  amount numeric;
  on_hand_after numeric;
begin
  if p_organization_id is null or p_material_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_stock_request');
  end if;

  select m.id, m.inventory_item_id, m.material_status, m.quantity_used, m.quantity_planned into material
    from public.business_work_order_materials m
   where m.id = p_material_id and m.organization_id = p_organization_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'material_not_found');
  end if;
  if material.inventory_item_id is null then
    return jsonb_build_object('ok', true, 'code', 'untracked');
  end if;
  -- The item row is the lock a hold and a fulfilment take too.
  perform 1 from public.inventory_items i
   where i.id = material.inventory_item_id and i.organization_id = p_organization_id
   for update;
  if not found then
    return jsonb_build_object('ok', true, 'code', 'untracked');
  end if;
  if material.material_status not in ('used', 'returned') then
    return jsonb_build_object('ok', true, 'code', 'not_a_stock_movement');
  end if;
  if exists (select 1 from public.inventory_reservations r where r.source = 'work_order_material' and r.source_id = material.id) then
    return jsonb_build_object('ok', true, 'code', 'already_recorded');
  end if;
  amount := coalesce(material.quantity_used, material.quantity_planned);
  if amount is null or amount <= 0 then
    return jsonb_build_object('ok', true, 'code', 'no_quantity');
  end if;

  insert into public.inventory_reservations (organization_id, inventory_item_id, source, source_id, quantity, state, settled_at)
  values (p_organization_id, material.inventory_item_id, 'work_order_material', material.id, amount,
          case when material.material_status = 'used' then 'consumed' else 'returned' end, now());
  update public.inventory_items
     set quantity = coalesce(quantity, 0) + case when material.material_status = 'used' then -amount else amount end,
         updated_at = now()
   where id = material.inventory_item_id and organization_id = p_organization_id
  returning quantity into on_hand_after;
  return jsonb_build_object('ok', true, 'code', case when material.material_status = 'used' then 'consumed' else 'returned' end,
    'quantity', amount, 'onHand', on_hand_after);
end;
$$;

revoke all on function public.inventory_order_hold(uuid, uuid) from public, anon, authenticated;
revoke all on function public.inventory_material_stock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.settle_inventory_holds_on_order_status() from public, anon, authenticated;
grant execute on function public.inventory_order_hold(uuid, uuid) to service_role;
grant execute on function public.inventory_material_stock(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

do $$
declare
  offending text;
begin
  if not exists (select 1 from pg_class where oid = 'public.inventory_reservations'::regclass and relrowsecurity) then
    raise exception 'inventory_reservations requires row level security';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_reservations') then
    raise exception 'inventory_reservations carries a policy; stock moves are reached through the service role only';
  end if;
  select string_agg(grantee || ':' || privilege_type || ' (granted by ' || grantor || ')', ', ' order by grantee, privilege_type)
    into offending
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'inventory_reservations'
     and (grantee in ('anon', 'authenticated')
          or (grantee = 'service_role' and privilege_type not in ('SELECT', 'INSERT', 'UPDATE')));
  if offending is not null then
    raise exception 'inventory_reservations is reachable beyond select, insert and update by the service role: %', offending;
  end if;
  if has_function_privilege('anon', 'public.inventory_order_hold(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.inventory_order_hold(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.inventory_material_stock(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.inventory_material_stock(uuid,uuid)', 'EXECUTE') then
    raise exception 'a stock function is callable by anon or authenticated; stock moves are server only';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'inventory_reservations_source_once' and indexdef like '%UNIQUE%') then
    raise exception 'inventory_reservations has no unique index on its source; a retry could move stock twice';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'merchant_orders_settle_inventory_holds' and tgrelid = 'public.merchant_orders'::regclass and not tgisinternal) then
    raise exception 'nothing settles an order''s holds when it is fulfilled or cancelled';
  end if;
end $$;

-- Stock moves with orders and jobs.
--
-- inventory_items.quantity has always been a number somebody typed. The
-- catalogue migration said it out loud -- "nothing here decrements inventory" --
-- and so did the product page's form: a variant "links rather than deducts". A
-- shop could sell its last mug to two people, a job could use ten metres of cable
-- and the count would not move, and every report built on the count was a report
-- on a number nobody maintained.
--
-- This is the inventory step of the Business Builder chain the owner named on
-- 5 October -- booking/job -> employee -> inventory -> work completion -- and the
-- fulfilment step of the storefront's: order -> payment -> fulfilment.
--
-- ## The ledger
--
-- inventory_reservations is one row per stock movement a sale or a job caused:
--
--   held      an order line is waiting to ship; the units are spoken for
--   consumed  the goods left: an order was fulfilled, or a job used material
--   released  the order was cancelled before it shipped; the hold is given back
--   returned  a job gave material back to the shelf
--
-- **Available = on hand - held.** On hand (inventory_items.quantity) only moves
-- when goods physically move: fulfilment and job use take it down, a returned
-- material puts it back. A hold never touches it.
--
-- ## Why the moves are SQL functions
--
-- Two buyers ordering the last mug at the same moment is the case the whole thing
-- exists for, and PostgREST cannot express "subtract n from what is there now" or
-- "check and insert in one step" as a single request. Each function takes one
-- per-organization advisory lock, so every stock decision for a business is
-- serialised, and does its check and its writes in one transaction. The
-- migration replay proves the race with two real sessions
-- (tests/sql/inventory-stock.sql and scripts/verify-migration-replay.mjs).
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
--     back is a physical fact the owner records (a returned material, or an
--     adjustment on the inventory page). Restocking on refund would invent stock.
--   * **A job is never refused for want of stock.** The material is already used
--     when the line is recorded. On hand may go below zero, and the inventory
--     page says that means the count needs checking. Only a *sale* is refused
--     when stock is short, because a buyer can still be told no.
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

-- Reserve, fulfil or release one storefront order's stock.
create or replace function public.inventory_order_stock(p_organization_id uuid, p_order_id uuid, p_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ord record;
  rec record;
  shortages jsonb := '[]'::jsonb;
  moved integer := 0;
  unreserved integer := 0;
  untracked integer := 0;
begin
  if p_organization_id is null or p_order_id is null or p_action is null or p_action not in ('reserve', 'fulfil', 'release') then
    return jsonb_build_object('ok', false, 'code', 'invalid_stock_request');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inventory:' || p_organization_id::text, 0));

  select o.id, o.status into ord
    from public.merchant_orders o
   where o.id = p_order_id and o.organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'order_not_found');
  end if;

  select count(*) into untracked
    from public.merchant_order_lines l
    left join public.merchant_product_variants v on v.id = l.variant_id and v.organization_id = p_organization_id
    left join public.inventory_items i on i.id = v.inventory_item_id and i.organization_id = p_organization_id
   where l.order_id = p_order_id and l.organization_id = p_organization_id and i.id is null;

  if p_action = 'reserve' then
    if ord.status = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'order_cancelled');
    end if;
    -- Held or shipped already: nothing to do. A *released* hold (the order was
    -- cancelled and then reinstated) is held again below, subject to stock.
    if exists (
      select 1 from public.inventory_reservations r
        join public.merchant_order_lines l on l.id = r.source_id
       where r.source = 'merchant_order_line' and r.organization_id = p_organization_id and l.order_id = p_order_id
         and r.state in ('held', 'consumed')
    ) then
      return jsonb_build_object('ok', true, 'code', 'already_reserved', 'untracked', untracked);
    end if;

    -- Per item, not per line: two lines may draw on the same shelf.
    for rec in
      select i.id as item_id, i.name, i.status, coalesce(i.quantity, 0) as on_hand, sum(l.quantity)::numeric as needed,
             coalesce((select sum(h.quantity) from public.inventory_reservations h
                        where h.inventory_item_id = i.id and h.organization_id = p_organization_id and h.state = 'held'), 0) as held
        from public.merchant_order_lines l
        join public.merchant_product_variants v on v.id = l.variant_id and v.organization_id = p_organization_id
        join public.inventory_items i on i.id = v.inventory_item_id and i.organization_id = p_organization_id
       where l.order_id = p_order_id and l.organization_id = p_organization_id
       group by i.id, i.name, i.status, i.quantity
    loop
      if rec.status <> 'active' or rec.on_hand - rec.held < rec.needed then
        shortages := shortages || jsonb_build_object(
          'item', rec.item_id, 'name', rec.name, 'needed', rec.needed,
          'available', case when rec.status = 'active' then greatest(rec.on_hand - rec.held, 0) else 0 end);
      end if;
    end loop;
    if jsonb_array_length(shortages) > 0 then
      return jsonb_build_object('ok', false, 'code', 'insufficient_stock', 'shortages', shortages);
    end if;

    insert into public.inventory_reservations (organization_id, inventory_item_id, source, source_id, quantity, state)
    select p_organization_id, i.id, 'merchant_order_line', l.id, l.quantity, 'held'
      from public.merchant_order_lines l
      join public.merchant_product_variants v on v.id = l.variant_id and v.organization_id = p_organization_id
      join public.inventory_items i on i.id = v.inventory_item_id and i.organization_id = p_organization_id
     where l.order_id = p_order_id and l.organization_id = p_organization_id
    on conflict (source, source_id) do update
      set state = 'held', settled_at = null, reason = null, quantity = excluded.quantity, updated_at = now()
      where public.inventory_reservations.state = 'released';
    get diagnostics moved = row_count;
    return jsonb_build_object('ok', true, 'code', 'reserved', 'held', moved, 'untracked', untracked);
  end if;

  if p_action = 'fulfil' then
    for rec in
      select r.id, r.inventory_item_id, r.quantity
        from public.inventory_reservations r
        join public.merchant_order_lines l on l.id = r.source_id
       where r.source = 'merchant_order_line' and r.organization_id = p_organization_id
         and l.order_id = p_order_id and r.state = 'held'
       for update of r
    loop
      update public.inventory_items set quantity = coalesce(quantity, 0) - rec.quantity, updated_at = now()
       where id = rec.inventory_item_id and organization_id = p_organization_id;
      update public.inventory_reservations set state = 'consumed', settled_at = now(), updated_at = now()
       where id = rec.id;
      moved := moved + 1;
    end loop;
    -- Linked lines of an order placed before its stock was linked: the goods are
    -- leaving now, so the count goes down now, even below zero.
    for rec in
      select l.id as line_id, i.id as item_id, l.quantity
        from public.merchant_order_lines l
        join public.merchant_product_variants v on v.id = l.variant_id and v.organization_id = p_organization_id
        join public.inventory_items i on i.id = v.inventory_item_id and i.organization_id = p_organization_id
       where l.order_id = p_order_id and l.organization_id = p_organization_id
         and not exists (select 1 from public.inventory_reservations r where r.source = 'merchant_order_line' and r.source_id = l.id)
    loop
      insert into public.inventory_reservations (organization_id, inventory_item_id, source, source_id, quantity, state, reason, settled_at)
      values (p_organization_id, rec.item_id, 'merchant_order_line', rec.line_id, rec.quantity, 'consumed', 'fulfilled_without_hold', now());
      update public.inventory_items set quantity = coalesce(quantity, 0) - rec.quantity, updated_at = now()
       where id = rec.item_id and organization_id = p_organization_id;
      unreserved := unreserved + 1;
    end loop;
    return jsonb_build_object('ok', true, 'code', 'consumed', 'consumed', moved + unreserved, 'unreserved', unreserved, 'untracked', untracked);
  end if;

  -- release: give back what is still held. What has shipped is not touched.
  update public.inventory_reservations r
     set state = 'released', settled_at = now(), updated_at = now(), reason = 'order_cancelled'
   where r.organization_id = p_organization_id and r.source = 'merchant_order_line' and r.state = 'held'
     and r.source_id in (select l.id from public.merchant_order_lines l where l.order_id = p_order_id and l.organization_id = p_organization_id);
  get diagnostics moved = row_count;
  return jsonb_build_object('ok', true, 'code', 'released', 'released', moved, 'untracked', untracked);
end;
$$;

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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inventory:' || p_organization_id::text, 0));

  select m.id, m.inventory_item_id, m.material_status, m.quantity_used, m.quantity_planned into material
    from public.business_work_order_materials m
   where m.id = p_material_id and m.organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'material_not_found');
  end if;
  if material.inventory_item_id is null
     or not exists (select 1 from public.inventory_items i where i.id = material.inventory_item_id and i.organization_id = p_organization_id) then
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

revoke all on function public.inventory_order_stock(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.inventory_material_stock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inventory_order_stock(uuid, uuid, text) to service_role;
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
  if has_function_privilege('anon', 'public.inventory_order_stock(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.inventory_order_stock(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.inventory_material_stock(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.inventory_material_stock(uuid,uuid)', 'EXECUTE') then
    raise exception 'a stock function is callable by anon or authenticated; stock moves are server only';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'inventory_reservations_source_once' and indexdef like '%UNIQUE%') then
    raise exception 'inventory_reservations has no unique index on its source; a retry could move stock twice';
  end if;
end $$;

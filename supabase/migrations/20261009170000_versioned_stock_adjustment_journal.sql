-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Proprietary source. No licence is granted; see LICENSE.
--
-- Staged: no production activation until fresh native replay, CI and reviewed
-- stock-owner cutover. Existing stock writers continue to work and are recorded
-- as UNATTRIBUTED; historical balances are not falsely represented as movements.
begin;

alter table public.inventory_items
  add column stock_version bigint not null default 0
  constraint inventory_items_stock_version_nonnegative check (stock_version >= 0);

-- Item deletion must not silently erase stock events. Organization deletion
-- may still cascade the journal as part of a reviewed privacy deletion.
-- A universal change audit is required BEFORE blocking legacy stock editors.
-- No mutable source or user attribution is inferred from generic UPDATEs.
create table public.inventory_stock_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  source text not null check (source in ('opening_snapshot','unattributed_quantity_change')),
  version_before bigint not null check (version_before >= 0),
  version_after bigint not null check (version_after >= version_before),
  balance_before numeric not null,
  balance_after numeric not null,
  delta_quantity numeric not null,
  recorded_at timestamptz not null default now(),
  posting_xid xid8 not null default pg_current_xact_id(),
  constraint inventory_stock_event_quantity_math check (
    delta_quantity = balance_after - balance_before
    and balance_before::text not in ('NaN','Infinity','-Infinity')
    and balance_after::text not in ('NaN','Infinity','-Infinity')
  ),
  constraint inventory_stock_events_item_version_once
    unique (inventory_item_id,version_after)
);

create index inventory_stock_events_org_item_time_idx
  on public.inventory_stock_events(organization_id,inventory_item_id,recorded_at desc);

-- Snapshot every pre-existing item at migration time without pretending any
-- historical movement has been reconstructed. All existing rows begin at v0.
insert into public.inventory_stock_events(
  organization_id,inventory_item_id,source,version_before,version_after,
  balance_before,balance_after,delta_quantity
)
select i.organization_id,i.id,'opening_snapshot',0,0,
       coalesce(i.quantity,0),coalesce(i.quantity,0),0
from public.inventory_items i;

-- Persistent evidence of independent reviewer approval, written only by
-- an authenticated server workflow after the reviewer actually confirms.
create table public.inventory_stock_adjustment_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  actor_user_id uuid not null references auth.users(id),
  reviewer_user_id uuid not null references auth.users(id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128 and idempotency_key=btrim(idempotency_key)),
  reason text not null check (reason in ('cycle_count','damaged','expired','shrinkage','customer_return','supplier_correction')),
  expected_stock_version bigint not null check (expected_stock_version>=0),
  counted_quantity numeric not null check (counted_quantity>=0 and counted_quantity<=999999999.999
    and counted_quantity=trunc(counted_quantity,3) and counted_quantity::text not in ('NaN','Infinity','-Infinity')),
  decision text not null check (decision='approved'),
  approved_at timestamptz not null default now(),
  constraint stock_approval_distinct_people check (actor_user_id<>reviewer_user_id),
  constraint stock_approval_request_once unique(organization_id,idempotency_key)
);

-- Immutable correction evidence is distinct from the universal change audit.
create table public.inventory_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  stock_event_id uuid not null unique references public.inventory_stock_events(id),
  approval_id uuid not null unique references public.inventory_stock_adjustment_approvals(id),
  actor_user_id uuid not null references auth.users(id),
  reviewer_user_id uuid not null references auth.users(id),
  idempotency_key text not null check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key = btrim(idempotency_key)
  ),
  reason text not null check (
    reason in ('cycle_count','damaged','expired','shrinkage','customer_return','supplier_correction')
  ),
  stock_version_before bigint not null check (stock_version_before >= 0),
  stock_version_after bigint not null check (stock_version_after = stock_version_before + 1),
  balance_before numeric not null,
  balance_after numeric not null,
  delta_quantity numeric not null,
  held_quantity_at_post numeric not null check (held_quantity_at_post >= 0),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_stock_adjustment_distinct_people
    check (actor_user_id <> reviewer_user_id),
  constraint inventory_stock_adjustment_changed
    check (delta_quantity <> 0 and delta_quantity = balance_after - balance_before),
  constraint inventory_stock_adjustment_available
    check (balance_after >= held_quantity_at_post),
  constraint inventory_stock_adjustment_request_once
    unique (organization_id,idempotency_key)
);
create index inventory_stock_adjustment_item_time_idx
  on public.inventory_stock_adjustments(organization_id,inventory_item_id,created_at desc);

alter table public.inventory_stock_events enable row level security;
alter table public.inventory_stock_adjustment_approvals enable row level security;
alter table public.inventory_stock_adjustments enable row level security;
revoke all on public.inventory_stock_events from public,anon,authenticated,service_role;
revoke all on public.inventory_stock_adjustment_approvals from public,anon,authenticated,service_role;
revoke all on public.inventory_stock_adjustments from public,anon,authenticated,service_role;
grant select on public.inventory_stock_events to service_role;
grant select,insert on public.inventory_stock_adjustment_approvals to service_role;
grant select,insert on public.inventory_stock_adjustments to service_role;
create policy stock_events_service_read on public.inventory_stock_events for select to service_role using (true);
create policy stock_approvals_service_read on public.inventory_stock_adjustment_approvals for select to service_role using (true);
create policy stock_adjustments_service_read on public.inventory_stock_adjustments for select to service_role using (true);
-- service_role is still an explicitly privileged server principal. The audit
-- trigger uses SECURITY DEFINER for *one bounded insert only*, so legacy
-- authorized item writers cannot silence the journal by lacking INSERT grants.

create function public.sonara_stock_version_and_tenant_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.stock_version := 0;
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'inventory_tenant_reassignment_forbidden';
  end if;
  if new.quantity is distinct from old.quantity then
    if old.stock_version = 9223372036854775807 then
      raise exception 'inventory_stock_version_exhausted';
    end if;
    new.stock_version := old.stock_version + 1;
  elsif new.stock_version is distinct from old.stock_version then
    raise exception 'inventory_stock_version_managed_by_database';
  end if;
  return new;
end;
$function$;
revoke all on function public.sonara_stock_version_and_tenant_guard()
  from public,anon,authenticated;
create trigger inventory_items_stock_version_guard
before insert or update on public.inventory_items
for each row execute function public.sonara_stock_version_and_tenant_guard();

-- Exception to SECURITY INVOKER: a narrow fixed-table INSERT into a closed
-- append-only journal must succeed even for owner-managed direct stock edits.
-- There is no dynamic SQL, user-controlled table name, or data-reading RPC.
create function public.sonara_record_inventory_stock_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_before numeric;
  v_after numeric;
begin
  if tg_op = 'UPDATE' and new.quantity is not distinct from old.quantity then
    return new;
  end if;
  v_before := case when tg_op = 'INSERT' then coalesce(new.quantity,0) else coalesce(old.quantity,0) end;
  v_after := coalesce(new.quantity,0);
  if v_before::text in ('NaN','Infinity','-Infinity')
     or v_after::text in ('NaN','Infinity','-Infinity') then
    raise exception 'inventory_quantity_not_finite';
  end if;
  insert into public.inventory_stock_events(
    organization_id,inventory_item_id,source,version_before,version_after,
    balance_before,balance_after,delta_quantity
  ) values(
    new.organization_id,new.id,
    case when tg_op = 'INSERT' then 'opening_snapshot' else 'unattributed_quantity_change' end,
    case when tg_op = 'INSERT' then 0 else old.stock_version end,
    new.stock_version,v_before,v_after,v_after-v_before
  );
  return new;
end;
$function$;
revoke all on function public.sonara_record_inventory_stock_change()
  from public,anon,authenticated;
create trigger inventory_items_stock_change_journal
after insert or update on public.inventory_items
for each row execute function public.sonara_record_inventory_stock_change();

-- A direct privileged INSERT must carry a genuine same-tenant stock event,
-- with identical before/after version and balances.
create function public.sonara_guard_stock_adjustment_event()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.inventory_stock_events e
    where e.id = new.stock_event_id
      and e.organization_id = new.organization_id
      and e.inventory_item_id = new.inventory_item_id
      and e.source = 'unattributed_quantity_change'
      and e.posting_xid = pg_current_xact_id()
      and e.version_before = new.stock_version_before
      and e.version_after = new.stock_version_after
      and e.balance_before = new.balance_before
      and e.balance_after = new.balance_after
      and e.delta_quantity = new.delta_quantity
  ) then
    raise exception 'stock_adjustment_event_lineage_invalid';
  end if;
  -- A valid old event is not permission to fabricate an adjustment later:
  -- it must be the latest state of this item and belong to this transaction.
  if not exists (
    select 1 from public.inventory_items i
    where i.id = new.inventory_item_id
      and i.organization_id = new.organization_id
      and i.stock_version = new.stock_version_after
      and i.quantity = new.balance_after
  ) then
    raise exception 'stock_adjustment_current_item_mismatch';
  end if;
  if not exists (
    select 1 from public.inventory_stock_adjustment_approvals a
     where a.id = new.approval_id
       and a.organization_id = new.organization_id
       and a.inventory_item_id = new.inventory_item_id
       and a.actor_user_id = new.actor_user_id
       and a.reviewer_user_id = new.reviewer_user_id
       and a.idempotency_key = new.idempotency_key
       and a.reason = new.reason
       and a.expected_stock_version = new.stock_version_before
       and a.counted_quantity = new.balance_after
       and a.decision = 'approved'
       and a.approved_at <= (
         select e.recorded_at
         from public.inventory_stock_events e
         where e.id = new.stock_event_id
       )
  ) then
    raise exception 'stock_adjustment_approval_lineage_invalid';
  end if;
  return new;
end;
$function$;
revoke all on function public.sonara_guard_stock_adjustment_event()
  from public,anon,authenticated;
create trigger inventory_adjustment_event_lineage
before insert on public.inventory_stock_adjustments
for each row execute function public.sonara_guard_stock_adjustment_event();

-- Caller (trusted backend) MUST authenticate actor identity, authorize the
-- organization and record the owner's real approval. Database independently
-- enforces actor/approver *active membership* and owner/admin reviewer role.
-- No browser access, no bearer service key in public clients.
create function public.sonara_apply_stock_count_adjustment(
  p_organization_id uuid,
  p_inventory_item_id uuid,
  p_actor_user_id uuid,
  p_reviewer_user_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_expected_version bigint,
  p_counted_quantity numeric,
  p_approval_id uuid
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_item public.inventory_items%rowtype;
  v_approval public.inventory_stock_adjustment_approvals%rowtype;
  v_existing public.inventory_stock_adjustments%rowtype;
  v_held numeric;
  v_after_version bigint;
  v_event_id uuid;
  v_adjustment_id uuid;
begin
  if p_organization_id is null or p_inventory_item_id is null
     or p_actor_user_id is null or p_reviewer_user_id is null
     or p_actor_user_id = p_reviewer_user_id or p_approval_id is null
     or p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 128
     or p_idempotency_key <> btrim(p_idempotency_key)
     or p_reason not in ('cycle_count','damaged','expired','shrinkage','customer_return','supplier_correction')
     or p_reason is null
     or p_expected_version is null or p_expected_version < 0
     or p_counted_quantity is null
     or p_counted_quantity::text in ('NaN','Infinity','-Infinity')
     or p_counted_quantity < 0 or p_counted_quantity > 999999999.999
     or p_counted_quantity <> trunc(p_counted_quantity,3) then
    raise exception 'stock_adjustment_invalid';
  end if;

  -- Both roles checked under a service-only transaction, not from editable
  -- JWT user_metadata. Server MUST also bind actor to real auth session.
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_actor_user_id
      and m.status = 'active'
  ) or not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_reviewer_user_id
      and m.status = 'active' and lower(m.role) in ('owner','admin','business_owner')
  ) then
    raise exception 'stock_adjustment_actor_or_reviewer_unauthorized';
  end if;

  select * into v_approval from public.inventory_stock_adjustment_approvals
    where id=p_approval_id and organization_id=p_organization_id for update;
  if not found or v_approval.inventory_item_id <> p_inventory_item_id
     or v_approval.actor_user_id <> p_actor_user_id
     or v_approval.reviewer_user_id <> p_reviewer_user_id
     or v_approval.idempotency_key <> p_idempotency_key
     or v_approval.reason <> p_reason
     or v_approval.expected_stock_version <> p_expected_version
     or v_approval.counted_quantity <> p_counted_quantity
     or v_approval.decision <> 'approved' then
    raise exception 'stock_adjustment_approval_evidence_missing';
  end if;

  select * into v_item from public.inventory_items
    where id = p_inventory_item_id and organization_id = p_organization_id
    for update;
  if not found then raise exception 'inventory_item_not_found'; end if;

  -- Retrying a committed identical request returns its earlier proof without
  -- incrementing a version or consuming the stock change a second time.
  select * into v_existing from public.inventory_stock_adjustments
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.inventory_item_id <> p_inventory_item_id
       or v_existing.actor_user_id <> p_actor_user_id
       or v_existing.reviewer_user_id <> p_reviewer_user_id
       or v_existing.reason <> p_reason
       or v_existing.stock_version_before <> p_expected_version
       or v_existing.balance_after <> p_counted_quantity
       or v_existing.approval_id <> p_approval_id then
      raise exception 'stock_adjustment_idempotency_conflict';
    end if;
    return jsonb_build_object('ok',true,'code','already_recorded',
      'adjustment_id',v_existing.id,'stock_posted',false);
  end if;

  if v_item.status <> 'active'
     or v_item.quantity is null
     or v_item.quantity::text in ('NaN','Infinity','-Infinity')
     or v_item.quantity < 0 then
    raise exception 'inventory_stock_reconciliation_required';
  end if;
  if v_item.stock_version <> p_expected_version then
    raise exception 'stock_version_conflict';
  end if;

  -- Hold writers in this repository lock the inventory item, so their writes
  -- serialize with this row lock. Legacy unguarded paths need a cutover audit.
  select coalesce(sum(r.quantity),0) into v_held
    from public.inventory_reservations r
    where r.organization_id = p_organization_id
      and r.inventory_item_id = p_inventory_item_id and r.state = 'held';
  if v_held::text in ('NaN','Infinity','-Infinity')
     or v_held < 0 or v_item.quantity < v_held
     or p_counted_quantity < v_held then
    raise exception 'stock_adjustment_violates_holds';
  end if;

  if v_item.quantity = p_counted_quantity then
    return jsonb_build_object('ok',true,'code','no_change','stock_posted',false);
  end if;

  update public.inventory_items set quantity=p_counted_quantity,updated_at=now()
    where id=p_inventory_item_id and organization_id=p_organization_id
    returning stock_version into v_after_version;
  if v_after_version <> p_expected_version + 1 then
    raise exception 'stock_version_update_invariant_failed';
  end if;

  select e.id into v_event_id from public.inventory_stock_events e
    where e.inventory_item_id=p_inventory_item_id
      and e.version_after=v_after_version;
  if v_event_id is null then raise exception 'stock_event_missing'; end if;

  insert into public.inventory_stock_adjustments(
    organization_id,inventory_item_id,stock_event_id,approval_id,
    actor_user_id,reviewer_user_id,idempotency_key,reason,
    stock_version_before,stock_version_after,balance_before,balance_after,
    delta_quantity,held_quantity_at_post
  ) values (
    p_organization_id,p_inventory_item_id,v_event_id,p_approval_id,
    p_actor_user_id,p_reviewer_user_id,p_idempotency_key,p_reason,
    p_expected_version,v_after_version,v_item.quantity,p_counted_quantity,
    p_counted_quantity-v_item.quantity,v_held
  ) returning id into v_adjustment_id;

  return jsonb_build_object('ok',true,'code','adjustment_recorded',
    'adjustment_id',v_adjustment_id,'stock_version',v_after_version,
    'stock_posted',true);
end;
$function$;
revoke all on function public.sonara_apply_stock_count_adjustment(
  uuid,uuid,uuid,uuid,text,text,bigint,numeric,uuid
) from public,anon,authenticated;
grant execute on function public.sonara_apply_stock_count_adjustment(
  uuid,uuid,uuid,uuid,text,text,bigint,numeric,uuid
) to service_role;

comment on function public.sonara_apply_stock_count_adjustment(
  uuid,uuid,uuid,uuid,text,text,bigint,numeric,uuid
) is 'Staged: service-only, count-based stock adjustment with expected version, held-quantity check and immutable evidence. Authenticated backend must bind real actors and obtain owner approval.';

commit;

-- Deterministic purchase-order approval controls.
--
-- This extends the existing purchase_orders workflow without changing its
-- fulfillment status vocabulary. AI is not involved. A manager may prepare
-- and submit an order; only an owner/admin may approve or reject it. The RPC
-- changes the approval state and writes the operator audit event in one
-- transaction, so an approval cannot exist without evidence.

alter table if exists public.purchase_orders
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_decided_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_decided_at timestamptz,
  add column if not exists approval_notes text,
  add column if not exists approval_version integer not null default 0,
  add column if not exists department text,
  add column if not exists cost_center text,
  add column if not exists procurement_reference text;

do $$
begin
  if to_regclass('public.purchase_orders') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.purchase_orders'::regclass
         and conname = 'purchase_orders_approval_status_check'
     ) then
    alter table public.purchase_orders
      add constraint purchase_orders_approval_status_check
      check (approval_status in ('draft','pending','approved','rejected','cancelled'));
  end if;

  if to_regclass('public.purchase_orders') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.purchase_orders'::regclass
         and conname = 'purchase_orders_approval_version_check'
     ) then
    alter table public.purchase_orders
      add constraint purchase_orders_approval_version_check
      check (approval_version >= 0);
  end if;
end $$;

create index if not exists purchase_orders_org_approval_created_idx
  on public.purchase_orders (organization_id, approval_status, created_at desc);

create or replace function public.sonara_transition_purchase_order_approval(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_action text,
  p_notes text default null
)
returns table (
  purchase_order_id uuid,
  approval_status text,
  approval_version integer,
  approval_requested_at timestamptz,
  approval_decided_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_before text;
  v_after text;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_action text := lower(trim(coalesce(p_action, '')));
  v_now timestamptz := now();
begin
  select po.approval_status
    into v_before
  from public.purchase_orders po
  where po.id = p_purchase_order_id
    and po.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'purchase_order_not_found';
  end if;

  if v_action in ('approve', 'reject') and v_role not in ('owner', 'admin', 'business_owner') then
    raise exception 'owner_role_required';
  end if;
  if v_action in ('submit', 'revise', 'cancel') and v_role not in ('owner', 'admin', 'business_owner', 'manager') then
    raise exception 'manager_role_required';
  end if;

  v_after := case
    when v_before = 'draft' and v_action = 'submit' then 'pending'
    when v_before = 'draft' and v_action = 'cancel' then 'cancelled'
    when v_before = 'pending' and v_action = 'approve' then 'approved'
    when v_before = 'pending' and v_action = 'reject' then 'rejected'
    when v_before = 'pending' and v_action = 'cancel' then 'cancelled'
    when v_before in ('approved', 'rejected', 'cancelled') and v_action = 'revise' then 'draft'
    when v_before in ('approved', 'rejected') and v_action = 'cancel' then 'cancelled'
    else null
  end;

  if v_after is null then
    raise exception 'invalid_procurement_transition';
  end if;

  update public.purchase_orders po
  set approval_status = v_after,
      approval_notes = nullif(left(trim(coalesce(p_notes, '')), 2000), ''),
      approval_version = po.approval_version + 1,
      approval_requested_by = case when v_action = 'submit' then p_actor_user_id else po.approval_requested_by end,
      approval_requested_at = case when v_action = 'submit' then v_now else po.approval_requested_at end,
      approval_decided_by = case
        when v_action in ('approve', 'reject') then p_actor_user_id
        when v_action = 'revise' then null
        else po.approval_decided_by
      end,
      approval_decided_at = case
        when v_action in ('approve', 'reject') then v_now
        when v_action = 'revise' then null
        else po.approval_decided_at
      end,
      updated_at = v_now
  where po.id = p_purchase_order_id
    and po.organization_id = p_organization_id;

  insert into public.business_control_audit_events (
    organization_id, business_id, actor_user_id, action, resource_type,
    resource_id, outcome, metadata
  ) values (
    p_organization_id, null, p_actor_user_id,
    'procurement.' || v_action, 'purchase_order', p_purchase_order_id,
    'success', jsonb_build_object(
      'from', v_before,
      'to', v_after,
      'actor_role', v_role
    )
  );

  return query
    select po.id, po.approval_status, po.approval_version,
           po.approval_requested_at, po.approval_decided_at
    from public.purchase_orders po
    where po.id = p_purchase_order_id
      and po.organization_id = p_organization_id;
end;
$$;

revoke all on function public.sonara_transition_purchase_order_approval(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sonara_transition_purchase_order_approval(uuid, uuid, uuid, text, text, text) to service_role;

comment on function public.sonara_transition_purchase_order_approval(uuid, uuid, uuid, text, text, text) is
  'Atomically moves one organization-scoped purchase order through deterministic approval and records the operator action. Service role only; server authorization is still required.';

notify pgrst, 'reload schema';

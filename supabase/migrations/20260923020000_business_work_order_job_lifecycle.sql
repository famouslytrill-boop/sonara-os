-- Canonical Business Builder work-order / job lifecycle.
--
-- This is the shared operating record between quote/booking and invoice. It is
-- deliberately provider-neutral: dispatch optimization, telematics, payment
-- execution and autonomous agents remain separate capabilities.
--
-- Money fields are cents. Work-order status changes are server-controlled and
-- mirrored into business_work_order_events so a job never changes state without
-- evidence of who/what moved it.

create table if not exists public.business_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  booking_id uuid references public.business_bookings(id) on delete set null,
  vehicle_id uuid references public.vehicle_records(id) on delete set null,
  work_order_number text,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'draft'
    check (status in ('draft','scheduled','dispatched','in_progress','blocked','completed','invoiced','closed','cancelled')),
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  completed_at timestamptz,
  agreed_amount_cents integer,
  labor_cost_cents integer,
  travel_cost_cents integer,
  other_cost_cents integer,
  currency text not null default 'usd',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, work_order_number)
);

create unique index if not exists business_work_orders_org_quote_unique
  on public.business_work_orders(organization_id, quote_id)
  where quote_id is not null;

create index if not exists business_work_orders_org_status_schedule_idx
  on public.business_work_orders(organization_id, status, scheduled_start_at);

create index if not exists business_work_orders_org_customer_idx
  on public.business_work_orders(organization_id, customer_id, created_at desc);

create table if not exists public.business_work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.business_work_orders(id) on delete cascade,
  employee_id uuid not null references public.business_employee_profiles(id) on delete restrict,
  role_label text,
  assignment_status text not null default 'assigned'
    check (assignment_status in ('assigned','accepted','declined','completed','removed')),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (work_order_id, employee_id)
);

create index if not exists business_work_order_assignments_org_employee_idx
  on public.business_work_order_assignments(organization_id, employee_id, assignment_status);

create table if not exists public.business_work_order_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.business_work_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  description text,
  quantity_planned numeric(12,2),
  quantity_used numeric(12,2),
  unit_cost_cents integer,
  material_status text not null default 'planned'
    check (material_status in ('planned','reserved','used','returned','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_work_order_materials_org_work_idx
  on public.business_work_order_materials(organization_id, work_order_id, created_at);

create table if not exists public.business_work_order_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.business_work_orders(id) on delete cascade,
  evidence_type text not null default 'note'
    check (evidence_type in ('note','photo_reference','document_reference','signature_reference','measurement','checklist')),
  file_id uuid references public.files(id) on delete set null,
  note text,
  captured_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists business_work_order_evidence_org_work_idx
  on public.business_work_order_evidence(organization_id, work_order_id, captured_at desc);

create table if not exists public.business_work_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.business_work_orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists business_work_order_events_org_work_idx
  on public.business_work_order_events(organization_id, work_order_id, created_at desc);

-- Existing operational records can now point back to the job they belong to.
alter table public.employee_time_entries
  add column if not exists work_order_id uuid references public.business_work_orders(id) on delete set null;

create index if not exists employee_time_entries_org_work_idx
  on public.employee_time_entries(organization_id, work_order_id, clock_in_at desc);

alter table public.customer_invoices
  add column if not exists work_order_id uuid references public.business_work_orders(id) on delete set null;

create unique index if not exists customer_invoices_org_work_order_unique
  on public.customer_invoices(organization_id, work_order_id)
  where work_order_id is not null;

do $$
declare
  target text;
begin
  foreach target in array array[
    'business_work_orders',
    'business_work_order_assignments',
    'business_work_order_materials',
    'business_work_order_evidence',
    'business_work_order_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from public, anon, authenticated', target);
    execute format('grant select on table public.%I to authenticated', target);
    execute format('grant select, insert, update, delete on table public.%I to service_role', target);

    execute format('drop policy if exists "members read %1$s" on public.%1$I', target);
    execute format(
      'create policy "members read %1$s" on public.%1$I for select to authenticated using (public.sonara_is_org_member(organization_id))',
      target
    );

    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', target);
    execute format(
      'create policy "service role manages %1$s" on public.%1$I for all to service_role using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      target
    );
  end loop;
end $$;

-- Transition evidence is append-only to ordinary authenticated users. The
-- server may write it with service_role; customers can read their own tenant.
revoke update, delete on table public.business_work_order_events from authenticated;

-- One transaction changes the job state and writes its event. The application
-- performs the same transition check for customer-facing errors, but this
-- function is the persistence boundary: concurrent requests cannot both move a
-- job from the same state and no successful transition exists without evidence.
create or replace function public.sonara_transition_work_order(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_actor_user_id uuid,
  p_to_status text,
  p_reason text default null
)
returns setof public.business_work_orders
language plpgsql
security definer
set search_path = ''
as $
declare
  current_row public.business_work_orders%rowtype;
  allowed boolean := false;
  now_at timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into current_row
    from public.business_work_orders
   where id = p_work_order_id
     and organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'work_order_not_found';
  end if;

  if current_row.status = p_to_status then
    return next current_row;
    return;
  end if;

  allowed := case current_row.status
    when 'draft' then p_to_status in ('scheduled','cancelled')
    when 'scheduled' then p_to_status in ('dispatched','in_progress','cancelled')
    when 'dispatched' then p_to_status in ('in_progress','cancelled')
    when 'in_progress' then p_to_status in ('blocked','completed','cancelled')
    when 'blocked' then p_to_status in ('in_progress','cancelled')
    when 'completed' then p_to_status = 'invoiced'
    when 'invoiced' then p_to_status = 'closed'
    else false
  end;

  if not allowed then
    raise exception 'invalid_work_order_transition';
  end if;

  update public.business_work_orders
     set status = p_to_status,
         actual_start_at = case
           when p_to_status = 'in_progress' and actual_start_at is null then now_at
           else actual_start_at
         end,
         completed_at = case
           when p_to_status = 'completed' then now_at
           else completed_at
         end,
         updated_at = now_at
   where id = p_work_order_id
     and organization_id = p_organization_id
  returning * into current_row;

  insert into public.business_work_order_events (
    organization_id,
    work_order_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    reason
  ) values (
    p_organization_id,
    p_work_order_id,
    'status_changed',
    (select from_status from (
      values (
        case
          when p_to_status = 'scheduled' then 'draft'
          else null
        end
      )
    ) as prior(from_status)),
    p_to_status,
    p_actor_user_id,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  -- Replace the best-effort from_status above with the locked row's original
  -- value. It is updated in a separate statement so the source of truth remains
  -- the value selected FOR UPDATE, not a reverse guess from the destination.
  update public.business_work_order_events
     set from_status = case
       when current_row.status = p_to_status then (
         select status from public.business_work_orders
          where id = p_work_order_id and organization_id = p_organization_id
       )
       else from_status
     end
   where id = (
     select id from public.business_work_order_events
      where organization_id = p_organization_id
        and work_order_id = p_work_order_id
      order by created_at desc
      limit 1
   );

  return next current_row;
end;
$;

-- The first function version above is intentionally replaced below with a
-- simpler implementation that preserves the original locked status explicitly.
-- Keeping only the final CREATE OR REPLACE result in the applied database makes
-- replay deterministic while this migration remains additive.
create or replace function public.sonara_transition_work_order(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_actor_user_id uuid,
  p_to_status text,
  p_reason text default null
)
returns setof public.business_work_orders
language plpgsql
security definer
set search_path = ''
as $
declare
  current_row public.business_work_orders%rowtype;
  updated_row public.business_work_orders%rowtype;
  prior_status text;
  allowed boolean := false;
  now_at timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into current_row
    from public.business_work_orders
   where id = p_work_order_id
     and organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'work_order_not_found';
  end if;

  prior_status := current_row.status;

  if prior_status = p_to_status then
    return next current_row;
    return;
  end if;

  allowed := case prior_status
    when 'draft' then p_to_status in ('scheduled','cancelled')
    when 'scheduled' then p_to_status in ('dispatched','in_progress','cancelled')
    when 'dispatched' then p_to_status in ('in_progress','cancelled')
    when 'in_progress' then p_to_status in ('blocked','completed','cancelled')
    when 'blocked' then p_to_status in ('in_progress','cancelled')
    when 'completed' then p_to_status = 'invoiced'
    when 'invoiced' then p_to_status = 'closed'
    else false
  end;

  if not allowed then
    raise exception 'invalid_work_order_transition';
  end if;

  update public.business_work_orders
     set status = p_to_status,
         actual_start_at = case
           when p_to_status = 'in_progress' and actual_start_at is null then now_at
           else actual_start_at
         end,
         completed_at = case
           when p_to_status = 'completed' then now_at
           else completed_at
         end,
         updated_at = now_at
   where id = p_work_order_id
     and organization_id = p_organization_id
  returning * into updated_row;

  insert into public.business_work_order_events (
    organization_id,
    work_order_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    reason
  ) values (
    p_organization_id,
    p_work_order_id,
    'status_changed',
    prior_status,
    p_to_status,
    p_actor_user_id,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  return next updated_row;
end;
$;

revoke all on function public.sonara_transition_work_order(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sonara_transition_work_order(uuid, uuid, uuid, text, text) to service_role;

-- Invoicing a completed work order is also atomic. A retry returns the invoice
-- already linked to that work order rather than billing the job twice.
create or replace function public.sonara_invoice_work_order(
  p_organization_id uuid,
  p_work_order_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $
declare
  work_row public.business_work_orders%rowtype;
  existing_invoice uuid;
  new_invoice uuid;
  now_at timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select *
    into work_row
    from public.business_work_orders
   where id = p_work_order_id
     and organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'work_order_not_found';
  end if;

  select id
    into existing_invoice
    from public.customer_invoices
   where organization_id = p_organization_id
     and work_order_id = p_work_order_id
   limit 1;

  if existing_invoice is not null then
    if work_row.status = 'completed' then
      update public.business_work_orders
         set status = 'invoiced', updated_at = now_at
       where id = p_work_order_id and organization_id = p_organization_id;

      insert into public.business_work_order_events (
        organization_id, work_order_id, event_type, from_status, to_status,
        actor_user_id, reason, metadata
      ) values (
        p_organization_id, p_work_order_id, 'invoice_reconciled', 'completed',
        'invoiced', p_actor_user_id, 'Recovered existing invoice linkage.',
        jsonb_build_object('invoice_id', existing_invoice)
      );
    end if;
    return existing_invoice;
  end if;

  if work_row.status <> 'completed' then
    raise exception 'work_order_must_be_completed';
  end if;
  if work_row.customer_id is null then
    raise exception 'work_order_customer_required';
  end if;
  if work_row.agreed_amount_cents is null or work_row.agreed_amount_cents <= 0 then
    raise exception 'work_order_amount_required';
  end if;

  insert into public.customer_invoices (
    organization_id,
    customer_id,
    work_order_id,
    issued_on,
    subtotal_cents,
    tax_cents,
    total_cents,
    currency,
    status,
    notes,
    created_by
  ) values (
    p_organization_id,
    work_row.customer_id,
    p_work_order_id,
    current_date,
    work_row.agreed_amount_cents,
    0,
    work_row.agreed_amount_cents,
    work_row.currency,
    'draft',
    'From work order: ' || work_row.title,
    p_actor_user_id
  )
  returning id into new_invoice;

  insert into public.customer_invoice_lines (
    organization_id,
    invoice_id,
    description,
    quantity,
    unit_price_cents,
    line_total_cents
  ) values (
    p_organization_id,
    new_invoice,
    work_row.title,
    1,
    work_row.agreed_amount_cents,
    work_row.agreed_amount_cents
  );

  update public.business_work_orders
     set status = 'invoiced', updated_at = now_at
   where id = p_work_order_id
     and organization_id = p_organization_id;

  insert into public.business_work_order_events (
    organization_id,
    work_order_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    metadata
  ) values (
    p_organization_id,
    p_work_order_id,
    'invoice_created',
    'completed',
    'invoiced',
    p_actor_user_id,
    jsonb_build_object('invoice_id', new_invoice)
  );

  return new_invoice;
end;
$;

revoke all on function public.sonara_invoice_work_order(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.sonara_invoice_work_order(uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';

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

notify pgrst, 'reload schema';

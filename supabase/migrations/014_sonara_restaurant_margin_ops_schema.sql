create extension if not exists pgcrypto;

-- =========================================================
-- SONARA Restaurant / Back Office Operations Layer
-- Inspired by common restaurant operations needs: vendors, invoices, inventory, recipes,
-- menu costing, purchasing, waste, sales mix, daily profit snapshots, bill pay, and accounting exports.
-- Do not copy any third-party product UI, branding, code, or proprietary workflow.
-- =========================================================

create table if not exists public.vendor_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  account_number text,
  contact_name text,
  email text,
  phone text,
  website text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  vendor_id uuid references public.vendor_accounts(id) on delete set null,
  invoice_number text,
  invoice_date date,
  due_date date,
  subtotal_cents integer default 0,
  tax_cents integer default 0,
  total_cents integer default 0,
  currency text default 'usd',
  document_url text,
  processing_status text not null default 'draft' check (processing_status in ('draft','uploaded','reviewing','approved','exported','paid','rejected','archived')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','scheduled','paid','void','refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, vendor_id, invoice_number)
);

create table if not exists public.vendor_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  invoice_id uuid references public.vendor_invoices(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  line_number integer,
  item_name text not null,
  category text,
  quantity numeric(12,3) default 0,
  unit text,
  unit_cost_cents integer default 0,
  total_cost_cents integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  vendor_id uuid references public.vendor_accounts(id) on delete set null,
  po_number text,
  status text not null default 'draft' check (status in ('draft','sent','partially_received','received','cancelled','archived')),
  expected_at date,
  notes text,
  total_cents integer default 0,
  currency text default 'usd',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity_ordered numeric(12,3) default 0,
  quantity_received numeric(12,3) default 0,
  unit text,
  unit_cost_cents integer default 0,
  total_cost_cents integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.recipe_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  category text,
  yield_quantity numeric(12,3),
  yield_unit text,
  instructions text,
  status text not null default 'active' check (status in ('active','testing','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  recipe_id uuid references public.recipe_cards(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  ingredient_name text not null,
  quantity numeric(12,3) default 0,
  unit text,
  waste_percent numeric(7,4) default 0,
  unit_cost_cents integer default 0,
  calculated_cost_cents integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  recipe_id uuid references public.recipe_cards(id) on delete set null,
  name text not null,
  category text,
  selling_price_cents integer default 0,
  currency text default 'usd',
  theoretical_cost_cents integer default 0,
  target_food_cost_percent numeric(7,4),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pos_sales_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  business_date date not null,
  gross_sales_cents integer default 0,
  net_sales_cents integer default 0,
  discounts_cents integer default 0,
  refunds_cents integer default 0,
  tax_cents integer default 0,
  tips_cents integer default 0,
  tickets_count integer default 0,
  source text default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, location_id, business_date, source)
);

create table if not exists public.pos_menu_mix_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  sales_summary_id uuid references public.pos_sales_summaries(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  quantity_sold numeric(12,3) default 0,
  net_sales_cents integer default 0,
  theoretical_cost_cents integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  counted_by uuid references auth.users(id) on delete set null,
  count_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','submitted','approved','archived')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  count_session_id uuid references public.inventory_count_sessions(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  counted_quantity numeric(12,3) default 0,
  unit text,
  unit_cost_cents integer default 0,
  extended_value_cents integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.waste_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric(12,3) default 0,
  unit text,
  estimated_cost_cents integer default 0,
  reason text,
  logged_by uuid references auth.users(id) on delete set null,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.daily_profit_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  business_date date not null,
  net_sales_cents integer default 0,
  food_cost_cents integer default 0,
  labor_cost_cents integer default 0,
  controllable_expense_cents integer default 0,
  gross_profit_cents integer default 0,
  prime_cost_cents integer default 0,
  food_cost_percent numeric(7,4),
  labor_cost_percent numeric(7,4),
  notes text,
  source text default 'calculated',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, location_id, business_date)
);

create table if not exists public.bill_payment_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  vendor_id uuid references public.vendor_accounts(id) on delete set null,
  invoice_id uuid references public.vendor_invoices(id) on delete set null,
  amount_cents integer not null default 0,
  currency text default 'usd',
  scheduled_for date,
  paid_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','paid','failed','cancelled','void')),
  payment_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_key text,
  export_type text not null default 'bills' check (export_type in ('bills','sales','inventory','payroll_summary','journal_entries','other')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  period_start date,
  period_end date,
  file_url text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.location_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  from_location_id uuid references public.business_locations(id) on delete set null,
  to_location_id uuid references public.business_locations(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','received','cancelled','archived')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.location_transfer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  transfer_id uuid references public.location_transfers(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric(12,3) default 0,
  unit text,
  estimated_cost_cents integer default 0,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists vendor_accounts_org_idx on public.vendor_accounts(organization_id);
create index if not exists vendor_invoices_org_status_idx on public.vendor_invoices(organization_id, processing_status, payment_status);
create index if not exists vendor_invoice_lines_invoice_idx on public.vendor_invoice_lines(invoice_id);
create index if not exists recipe_cards_org_idx on public.recipe_cards(organization_id);
create index if not exists menu_items_org_idx on public.menu_items(organization_id);
create index if not exists pos_sales_summaries_org_date_idx on public.pos_sales_summaries(organization_id, business_date);
create index if not exists daily_profit_snapshots_org_date_idx on public.daily_profit_snapshots(organization_id, business_date);
create index if not exists accounting_exports_org_idx on public.accounting_exports(organization_id, status);

-- RLS
alter table public.vendor_accounts enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.vendor_invoice_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.recipe_cards enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menu_items enable row level security;
alter table public.pos_sales_summaries enable row level security;
alter table public.pos_menu_mix_items enable row level security;
alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_lines enable row level security;
alter table public.waste_logs enable row level security;
alter table public.daily_profit_snapshots enable row level security;
alter table public.bill_payment_records enable row level security;
alter table public.accounting_exports enable row level security;
alter table public.location_transfers enable row level security;
alter table public.location_transfer_lines enable row level security;

-- Server-side service role manages restaurant back office records. Browser access must be mediated by Express permission checks.
do $$
declare
  t text;
begin
  foreach t in array array[
    'vendor_accounts','vendor_invoices','vendor_invoice_lines','purchase_orders','purchase_order_lines','recipe_cards','recipe_ingredients','menu_items','pos_sales_summaries','pos_menu_mix_items','inventory_count_sessions','inventory_count_lines','waste_logs','daily_profit_snapshots','bill_payment_records','accounting_exports','location_transfers','location_transfer_lines'
  ] loop
    execute format('drop policy if exists "service role manages %s" on public.%I', t, t);
    execute format('create policy "service role manages %s" on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t, t);
  end loop;
end $$;

-- Seed integration provider catalog entries for restaurant back office categories.
insert into public.integration_providers (provider_key, name, category, connection_mode, capabilities, status)
values
('square_pos','Square POS','payments','api','{"pos_sales":true,"payments":true,"catalog":true}'::jsonb,'active'),
('toast_pos','Toast POS','other','api','{"pos_sales":true,"menu_mix":true,"restaurant_pos":true,"provider_terms_required":true}'::jsonb,'active'),
('quickbooks_online','QuickBooks Online','other','oauth','{"accounting_exports":true,"bills":true,"journal_entries":true}'::jsonb,'active'),
('xero','Xero','other','oauth','{"accounting_exports":true,"bills":true,"journal_entries":true}'::jsonb,'active'),
('restaurant_backoffice_manual','Manual Restaurant Back Office','other','manual','{"invoices":true,"inventory":true,"recipes":true,"daily_profit_snapshots":true,"menu_analysis":true}'::jsonb,'active')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

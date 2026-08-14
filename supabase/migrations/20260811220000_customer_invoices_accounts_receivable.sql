-- Accounts receivable: what a business's own customers owe it.
--
-- Every money table in this product pointed outward. vendor_invoices,
-- purchase_orders and bill_payment_records are money the business owes its
-- suppliers; payments and purchases are SONARA's own Stripe billing, not the
-- customer's. A business could record what it owed and not what it was owed.
--
-- docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md has the analysis. For a trades
-- business the receivable side is the business, and three of the twelve tools
-- in that guide -- proposal building, invoice chasing, cash forecasting -- are
-- all downstream of this table not existing.
--
-- Two tables, and both decisions are worth stating.
--
-- Payments received are their own rows instead of an amount_paid_cents column
-- maintained by hand. A denormalised total is a number that silently stops
-- being true the first time somebody records a payment without updating it,
-- which is exactly the failure mode this codebase keeps finding. The invoice
-- carries what was billed; what was paid is derived from the payment rows.
--
-- There is no line-items table, and that is a limit rather than an oversight.
-- The owner-page framework renders one child table per page, and between line
-- items and payments received it is payments that answer the question this
-- exists for -- who owes me what, right now. A line-items table with no page
-- would be schema nothing can reach, which this repository already has enough
-- of. It can be added when there is a surface to put it on.

create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_number text,
  issued_on date,
  due_on date,
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'usd',
  -- 'sent' is the state that starts the clock. A draft nobody has seen cannot
  -- be overdue, and counting it as such would put invented pressure on a
  -- number the owner reads as real.
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'void', 'written_off')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, invoice_number)
);

create table if not exists public.customer_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  received_on date not null default current_date,
  amount_cents integer not null,
  method text,
  reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- The overdue query is (organization, status, due date), which is the one the
-- record check and the invoices page both run.
create index if not exists customer_invoices_org_status_due_idx
  on public.customer_invoices(organization_id, status, due_on);
create index if not exists customer_invoices_org_customer_idx
  on public.customer_invoices(organization_id, customer_id);
create index if not exists customer_invoice_payments_invoice_idx
  on public.customer_invoice_payments(invoice_id, received_on desc);

alter table public.customer_invoices enable row level security;
alter table public.customer_invoice_payments enable row level security;

do $$
declare
  target text;
begin
  foreach target in array array['customer_invoices', 'customer_invoice_payments']
  loop
    execute format('drop policy if exists "service role can manage %1$s" on public.%1$I', target);
    execute format(
      'create policy "service role can manage %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      target
    );
  end loop;
end $$;

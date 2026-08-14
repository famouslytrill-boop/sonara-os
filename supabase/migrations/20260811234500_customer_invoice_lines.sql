-- What is on a customer invoice.
--
-- Deliberately absent from 20260811220000, and the reason is recorded there:
-- the owner-page framework rendered one child table per page, receivables spent
-- that slot on payments received, and a table with no surface is schema nothing
-- can reach. The framework now renders every child a record declares, so there
-- is somewhere to put this.
--
-- Line totals are stored rather than computed on read. That is the opposite of
-- the choice made for payments, and the reason is that these are different
-- kinds of number. What has been paid against an invoice is a fact about other
-- rows, so deriving it keeps it true. A line total is what the business decided
-- to charge -- a quantity times a price it may have discounted, rounded the way
-- it chose. Recomputing it on read would quietly overwrite that decision the
-- first time somebody edited a unit price.

create table if not exists public.customer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  service_id uuid references public.business_service_catalog(id) on delete set null,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price_cents integer not null default 0,
  line_total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists customer_invoice_lines_invoice_idx
  on public.customer_invoice_lines(invoice_id, created_at);

alter table public.customer_invoice_lines enable row level security;

drop policy if exists "service role can manage customer_invoice_lines" on public.customer_invoice_lines;
create policy "service role can manage customer_invoice_lines" on public.customer_invoice_lines
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

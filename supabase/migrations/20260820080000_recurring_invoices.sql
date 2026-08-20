-- A standing arrangement, and the invoices it produces.
--
-- customer_invoices and customer_invoice_lines have existed since August and
-- every invoice on them is typed by hand. A business on retainers types the
-- same one every month, which is both the most boring thing it does and the
-- one most likely to be forgotten in a busy month -- and a forgotten invoice is
-- a month of work given away.
--
-- ## Why the anchor day is its own column
--
-- "The 31st of every month" cannot be stored as a date and advanced, because
-- February clamps it to the 28th and the next advance takes the 28th as the new
-- anchor. The bill walks three days earlier and never comes back; the contract
-- says the 31st and the paperwork says the 28th. So the anchor is stored and
-- every issue date is computed from it against the target month.
--
-- `'last'` is a value, not a synonym for 31, because a business billing on the
-- last day of the month means that in April as well.
--
-- ## Why the lines are their own table
--
-- The same shape as customer_invoice_lines, and for the same reason: an
-- arrangement is a set of things being billed, and an amount on the parent row
-- would have to be kept in step with lines that can be edited. The generator
-- totals from the lines, so a disagreement is impossible rather than unlikely.
--
-- ## What is deliberately not here
--
-- No `next_issue_on` column. It would be a cached derivation of cadence,
-- anchor and last_issued_on, and a cache of a date is a thing that can be
-- stale and wrong in a way nothing detects -- somebody edits the cadence and
-- the cached date keeps its old answer. lib/sonara-recurring-invoices.cjs
-- computes it on every read, which costs nothing and cannot drift.

create table if not exists public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  label text,
  enabled boolean not null default true,
  cadence text not null default 'monthly'
    check (cadence in ('weekly','fortnightly','monthly','quarterly','yearly')),
  -- 1-31, or the string 'last'. Ignored by weekly and fortnightly, which step
  -- in days.
  anchor_day text not null default '1'
    check (anchor_day = 'last' or (anchor_day ~ '^[0-9]{1,2}$' and anchor_day::int between 1 and 31)),
  starts_on date not null,
  ends_on date,
  -- Days from issue to due. Null means no terms were agreed, which is a
  -- different arrangement from "due immediately" -- the generator leaves due_on
  -- null rather than making it the issue date, and lib/sonara-record-checks.cjs
  -- reports a sent invoice with no due date rather than letting it drop out of
  -- every chase list.
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days between 0 and 365),
  tax_rate_basis_points integer not null default 0
    check (tax_rate_basis_points between 0 and 10000),
  currency text not null default 'usd',
  notes text,
  -- The date of the last invoice this produced, not the time it ran. The
  -- period arithmetic keys on it, so storing "when the job fired" would make a
  -- schedule that ran three days late believe it had billed for the wrong month.
  last_issued_on date,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.recurring_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recurring_invoice_id uuid not null references public.recurring_invoices(id) on delete cascade,
  service_id uuid references public.business_service_catalog(id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit_price_cents integer not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- The run reads one organization's enabled arrangements. Without this it is a
-- sequential scan every time.
create index if not exists recurring_invoices_org_enabled_idx
  on public.recurring_invoices (organization_id, enabled);

create index if not exists recurring_invoice_lines_parent_idx
  on public.recurring_invoice_lines (recurring_invoice_id, position);

-- Which arrangement produced an invoice, so a business can see why one appeared
-- and so a second run cannot duplicate one without it being visible.
alter table public.customer_invoices
  add column if not exists recurring_invoice_id uuid references public.recurring_invoices(id) on delete set null;

-- One invoice per arrangement per issue date. This is the last line of defence
-- behind the period arithmetic: if two runs ever race, the second insert fails
-- rather than billing a customer twice.
create unique index if not exists customer_invoices_recurring_issue_key
  on public.customer_invoices (recurring_invoice_id, issued_on)
  where recurring_invoice_id is not null;

alter table public.recurring_invoices enable row level security;
alter table public.recurring_invoice_lines enable row level security;

-- No SELECT policy, for the same reason as public_booking_pages: both tables
-- are read through the service role with an organization_id filter, which is
-- the tenant boundary everywhere else in this application today. If a read is
-- ever switched to a user token it needs a policy added in
-- scripts/generate-member-read-policies.cjs first, or it will return no rows.

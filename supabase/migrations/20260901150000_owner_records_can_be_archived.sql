-- Retiring a record without deleting it.
--
-- Twenty-seven owner record pages. Eleven have a terminal status in their own
-- vocabulary -- a quote goes `declined`, an invoice goes `void`, a booking goes
-- `cancelled` -- and those pages already offer a way to say a record is done
-- with. **The other sixteen have no status at all**, so a customer entered
-- twice, a vehicle sold, a supplier no longer used, stays on the list for ever
-- and there is nothing anybody can do about it.
--
-- This adds `archived_at` to exactly those sixteen. The list of which tables
-- get it is derived in `lib/sonara-record-archive.cjs` from whether the page
-- declares a terminal status, so a page that gains one later stops being
-- offered two ways to do the same thing.
--
-- ## What archiving is, and the thing it is deliberately not
--
-- It is a **display** decision: stop showing me this on my list. It is not a
-- delete, and it changes nothing anywhere else in this application.
--
-- That is worth being exact about, because the obvious fear is the opposite.
-- Only one read filters on this column: the owner list page. Nothing that
-- computes money looks at it -- an archived vendor invoice is still in the
-- payables total, an archived time entry is still in the labour cost of the day
-- it belongs to, an archived sales summary is still in the revenue figure, and
-- every accounting export still contains all of them.
--
-- The alternative -- hiding archived rows from the totals too -- is how a
-- business ends up with a figure on a screen that does not match its books,
-- discovered at the end of a tax year. Somebody who archives a supplier they
-- stopped using in March must not thereby change what March cost.
--
-- The page says this in words rather than leaving it to be assumed, because
-- "archive" reads like "delete" to most people and the difference here is the
-- whole design.
--
-- ## Why a timestamp rather than a boolean
--
-- `archived_at is null` and `archived_at is not null` carry the same yes/no a
-- boolean would, and also carry when -- which is the question somebody asks the
-- moment a record they expected is not on the list. A boolean would need a
-- second column to answer it, and nobody adds the second column.

alter table public.business_locations          add column if not exists archived_at timestamptz;
alter table public.business_employee_profiles  add column if not exists archived_at timestamptz;
alter table public.employee_schedules          add column if not exists archived_at timestamptz;
alter table public.employee_time_entries       add column if not exists archived_at timestamptz;
alter table public.inventory_items             add column if not exists archived_at timestamptz;
alter table public.vendor_accounts             add column if not exists archived_at timestamptz;
alter table public.vendor_invoices             add column if not exists archived_at timestamptz;
alter table public.recipe_cards                add column if not exists archived_at timestamptz;
alter table public.menu_items                  add column if not exists archived_at timestamptz;
alter table public.pos_sales_summaries         add column if not exists archived_at timestamptz;
alter table public.daily_profit_snapshots      add column if not exists archived_at timestamptz;
alter table public.vehicle_records             add column if not exists archived_at timestamptz;
alter table public.maintenance_logs            add column if not exists archived_at timestamptz;
alter table public.research_sources            add column if not exists archived_at timestamptz;
alter table public.waste_logs                  add column if not exists archived_at timestamptz;
alter table public.accounting_exports          add column if not exists archived_at timestamptz;

-- No index, and that is a decision rather than an omission.
--
-- The owner list page already filters by `organization_id` and orders by
-- `created_at`, and every one of these tables is scoped to one business -- so
-- the rows a query touches are a single organization's, which is hundreds
-- rather than millions. A partial index per table would be sixteen indexes
-- earning nothing, and each one is write cost on every insert.

comment on column public.business_locations.archived_at is
  'When an owner chose to stop seeing this on their list. A display decision, not a delete: nothing that computes money filters on this column. See lib/sonara-record-archive.cjs.';

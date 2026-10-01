-- The payroll chain could not be joined, and that is why none of it was built.
--
-- Measured 1 October 2026 against the migrations in this repository. Six tables
-- carry an `employee_id`, and they are split across TWO different parents:
--
--   -> public.business_employee_profiles   employee_time_entries
--                                          employee_schedules
--                                          employee_tasks
--
--   -> public.employee_profiles            employee_wage_rates
--                                          employee_shifts
--                                          employee_pay_statements
--
-- (`employee_shifts` turned out to be a duplicate of `employee_schedules` and is
-- handled separately; see the note above the statements below.)
--
-- So a clocked hour and the rate it should be paid at reference different
-- tables. Paying somebody for their time requires crossing a boundary the
-- schema does not define, and there is no join that does it.
--
-- ## Which parent is real
--
-- `business_employee_profiles` is queried by ten files under lib/, routes/ and
-- server.js -- the invite flow, the employee profile pages, the time clock, the
-- schedule and the task list all read it.
--
-- `employee_profiles` is named in exactly four files and **queried by none of
-- them**: lib/sonara-database-contract.cjs, lib/sonara-tenant-scoped-tables.cjs,
-- lib/sonara-ecosystem-manifest.cjs and lib/sonara-market-expansion-registry.cjs
-- are all registries. It is a table with no product, and the three payroll
-- tables keyed to it are the three in this family with no reader at all.
--
-- That is the whole explanation for the gap. Somebody began the payroll half
-- against the parent that had no rows behind it and stopped.
--
-- ## What this migration does, and what it deliberately does not
--
-- It adds a nullable `business_employee_id` to the three payroll tables,
-- referencing the parent that is actually used, and indexes it beside the
-- organization so a pay run reads one workspace.
--
-- It does NOT drop `employee_id`, does not drop `public.employee_profiles`, and
-- does not copy or move a single row. Nothing becomes unreachable, and no
-- existing read changes meaning. AGENTS.md puts destructive data changes behind
-- owner approval, so retiring the old column and the empty parent is a separate
-- decision with its own migration -- and one worth taking, because two employee
-- tables is the condition that produced this.
--
-- Until that decision, `employee_id` stays as the historical column and
-- lib/sonara-pay-period-engine.cjs reads `business_employee_id` only. The engine
-- refuses to guess a mapping between the two rather than joining on a
-- correspondence nobody declared.

-- `employee_shifts` is deliberately NOT given this column. It is a duplicate of
-- `employee_schedules` -- same organization_id, employee_id, location_id,
-- role_label, starts_at, ends_at and notes, differing only in its status
-- vocabulary -- and `employee_schedules` is the one with a product behind it:
-- /business-builder/owner/schedules writes it and routes/sonara-rota-routes.cjs
-- reads it. Giving the duplicate a working key would be the first step towards
-- maintaining two shift tables. It is recorded in lib/sonara-orphan-tables.cjs
-- as the duplicate it is, and retiring it is a separate decision.
alter table public.employee_wage_rates      add column if not exists business_employee_id uuid references public.business_employee_profiles(id) on delete cascade;
alter table public.employee_pay_statements  add column if not exists business_employee_id uuid references public.business_employee_profiles(id) on delete cascade;

-- Organization first in each index: every read in the engine filters on it, and
-- a pay run is "this workspace, this period" rather than "this person across
-- every business".
create index if not exists employee_wage_rates_org_business_employee_idx
  on public.employee_wage_rates (organization_id, business_employee_id);
create index if not exists employee_pay_statements_org_business_employee_idx
  on public.employee_pay_statements (organization_id, business_employee_id);

-- A pay period is read by start date within one organization, and the engine
-- lists periods newest first.
create index if not exists employee_pay_periods_org_period_start_idx
  on public.employee_pay_periods (organization_id, period_start desc);

comment on column public.employee_wage_rates.business_employee_id is
  'The employee this rate belongs to, in public.business_employee_profiles -- the employee table the product actually queries. The older employee_id column references public.employee_profiles, which no route reads, which is why nothing could join a wage rate to a clocked hour. See lib/sonara-pay-period-engine.cjs.';

comment on column public.employee_pay_statements.business_employee_id is
  'The employee this statement pays, in public.business_employee_profiles. Same correction as employee_wage_rates.business_employee_id.';

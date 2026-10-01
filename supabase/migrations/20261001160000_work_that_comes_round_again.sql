-- Work that comes round again.
--
-- A business runs on recurring work: open, close, the weekly deep clean, the
-- monthly stock count, the yearly equipment check. Before this table there was
-- no way to express any of it. `employee_tasks` has existed since migration 013
-- and holds one-off work only -- a title, a due date and a status -- and on
-- 1 October 2026 exactly one route wrote to it, one task at a time, by hand.
--
-- This is the template. The occurrences it produces are rows in
-- `employee_tasks`, which /staff/tasks already serves, so an employee sees
-- recurring work on the page they already use and nothing has to learn about a
-- second kind of task. That mirrors `recurring_invoices` -> `customer_invoices`
-- deliberately: a template table plus the product's own record table, rather
-- than a parallel record table half the application does not know about.
--
-- The arithmetic lives in lib/sonara-recurring-tasks.cjs and is not duplicated
-- here: no trigger generates anything, and this table has no notion of what is
-- due. A business presses a button, for the reason
-- routes/sonara-recurring-invoice-routes.cjs gives about its own: creating work
-- against somebody's day is a change, and a business should see what is about
-- to be created before it is.

create table if not exists public.business_recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  -- The six this engine understands. `daily` is here and is deliberately absent
  -- from recurring_invoices: opening and closing happen every day and nothing
  -- in this product bills daily.
  cadence text not null check (cadence in ('daily','weekly','fortnightly','monthly','quarterly','yearly')),
  -- The first occurrence, and for the day-stepping cadences also the thing that
  -- fixes the weekday. "Every Tuesday" is a weekly template that starts on a
  -- Tuesday; there is no weekday column, because two places to say which day it
  -- is are two places that can disagree.
  starts_on date not null,
  ends_on date,
  -- 1-31 or the word 'last', and only meaningful for the month-stepping
  -- cadences. Stored as text so 'last' needs no second column, and stored at
  -- all because stepping from the clamped result is how a monthly job walks out
  -- of February and never comes back -- the trap
  -- lib/sonara-recurring-invoices.cjs documents and this reuses rather than
  -- restates.
  -- Written as one regex rather than a regex AND a cast to integer. PostgreSQL
  -- does not promise the order it evaluates the arms of an AND in a CHECK, so
  -- `anchor_day ~ '^[0-9]{1,2}$' and anchor_day::int between 1 and 31` can reach
  -- the cast first and raise "invalid input syntax for type integer" instead of a
  -- constraint violation -- a different error, from a different layer, for the
  -- same bad value. The regex alone says 1-31 exactly: 1-9, 10-29, 30-31.
  --
  -- It therefore rejects a leading zero, so '01' is not a day of the month here.
  -- normalizeTemplate in lib/sonara-recurring-tasks.cjs canonicalises what a form
  -- submits through Number() before it gets this far, and a test asserts that
  -- every value it can produce matches this pattern.
  anchor_day text check (anchor_day is null or anchor_day ~ '^(last|[1-9]|[12][0-9]|3[01])$'),
  -- Nullable, and an occurrence for a template whose employee has left is still
  -- issued -- unassigned. The work does not stop needing doing because somebody
  -- resigned, and silently dropping it is how a closing checklist disappears.
  assigned_employee_id uuid references public.business_employee_profiles(id) on delete set null,
  -- The same four words employee_tasks.priority accepts, so an occurrence can
  -- carry the template's priority through without translation.
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  enabled boolean not null default true,
  -- The one piece of state that stops a button becoming a loop with an
  -- assignee. The next occurrence is computed from this, so pressing twice in a
  -- day produces one task.
  last_issued_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_recurring_tasks_org_enabled_idx
  on public.business_recurring_tasks (organization_id, enabled);

alter table public.business_recurring_tasks enable row level security;

-- No policy, deliberately, and the same posture recurring_invoices has. Every
-- read and write goes through the server with the service role; a browser role
-- reading this table directly gets nothing. scripts/verify-migration-replay.mjs
-- pins the exact set of tables in this state, so this table joining it is a
-- decision recorded rather than a side effect.

comment on table public.business_recurring_tasks is
  'Templates for work that repeats. Each occurrence is issued as a row in employee_tasks, which /staff/tasks serves. The cadence arithmetic lives in lib/sonara-recurring-tasks.cjs; nothing here generates anything on its own.';

comment on column public.business_recurring_tasks.anchor_day is
  '1-31 or ''last'', for the month-stepping cadences. The stored anchor, never the clamped result: stepping from a February-clamped date walks a monthly job three days earlier every year.';

comment on column public.business_recurring_tasks.last_issued_on is
  'The occurrence date most recently issued, not when the button was pressed. What stops a second press in the same day producing a second task.';

-- Declare the Data API surface.
--
-- Migration 20260727190000 revoked default privileges on new public objects, so
-- a table created after it is unreachable by every role until it says who may
-- touch it. Without these grants the page would refuse every read and every
-- business would see "we could not read your recurring work" for ever.
--
-- anon and authenticated are deliberately absent: row level security is on with
-- no policy, so those roles are already closed out, and this is the second half
-- of the same decision.
--
-- No delete. Switching a template off is an update, and that is the whole of
-- what the page offers. Removing one would destroy the record of what a business
-- had set up without removing the tasks it already issued, and a destructive
-- path is a decision with an owner-approval requirement attached -- see the
-- safety rules in AGENTS.md -- rather than something that arrives as a side
-- effect of a grant written today.
grant select, insert, update on table public.business_recurring_tasks to service_role;

do $$
begin
  if to_regclass('public.business_recurring_tasks') is null then
    raise exception 'public.business_recurring_tasks was not created';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.business_recurring_tasks'::regclass and relrowsecurity
  ) then
    raise exception 'public.business_recurring_tasks exists without row level security enabled';
  end if;

  -- RLS with no policy is the posture. A policy appearing here is somebody
  -- opening the table to a browser role; fail rather than allow it.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'business_recurring_tasks'
  ) then
    raise exception 'public.business_recurring_tasks has a row level security policy; it is meant to be reachable only by the service role';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_recurring_tasks', 'SELECT') then
    raise exception 'service_role cannot read public.business_recurring_tasks; the Data API surface was not declared and no recurring work could be listed';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_recurring_tasks', 'INSERT') then
    raise exception 'service_role cannot write public.business_recurring_tasks; nothing could be set up';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.business_recurring_tasks', 'UPDATE') then
    raise exception 'service_role cannot update public.business_recurring_tasks; last_issued_on could not be moved and every press would issue another task for the same day';
  end if;

  -- Stated as an assertion rather than trusted to the revoke above, because a
  -- later migration granting broadly across public would reopen this quietly.
  if pg_catalog.has_table_privilege('anon', 'public.business_recurring_tasks', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.business_recurring_tasks', 'SELECT') then
    raise exception 'public.business_recurring_tasks is readable by a browser role; it is server-only like recurring_invoices';
  end if;

  -- Deleting is not granted, and that is checked rather than assumed. A delete
  -- privilege arriving later would make the "no destructive path" claim in the
  -- comment above false while the comment still read as current.
  if pg_catalog.has_table_privilege('service_role', 'public.business_recurring_tasks', 'DELETE') then
    raise exception 'service_role can delete from public.business_recurring_tasks; switching a template off is an update and no delete path was meant to exist';
  end if;

  -- The organization column is the tenant boundary and nothing else enforces
  -- it: with no policy on the table, a null here would be a row no business
  -- owns and every read filters by organization_id.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_recurring_tasks'
      and column_name = 'organization_id' and is_nullable = 'YES'
  ) then
    raise exception 'public.business_recurring_tasks.organization_id is nullable; a recurring task with no business is a row nothing can scope';
  end if;

  -- The cadence constraint is what keeps an unreadable cadence out of the
  -- table rather than leaving lib/sonara-recurring-tasks.cjs to report
  -- "not a cadence this understands" for ever on a row somebody saved.
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.table_schema = 'public' and tc.table_name = 'business_recurring_tasks'
      and tc.constraint_type = 'CHECK' and ccu.column_name = 'cadence'
  ) then
    raise exception 'public.business_recurring_tasks.cadence has no check constraint; an unreadable cadence could be stored';
  end if;
end $$;

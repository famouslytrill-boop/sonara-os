-- Whether a booking page books a person or a business.
--
-- The page shipped in 20260820060000 offers a time if nothing is booked at
-- that time -- which is right for a sole trader and wrong for anyone with
-- staff. A firm with two plumbers has two of every slot, and the page was
-- selling one of them. Worse in the other direction: the second plumber's
-- whole diary was unsellable, because one booking closed the hour for the
-- business.
--
-- business_bookings.assigned_employee_id and employee_schedules have both
-- existed since migration 013. Nothing had joined them to availability.
--
-- ## Why this is a column and not something inferred
--
-- The obvious shortcut is to look for shifts and use them if any exist. That
-- fails exactly when it matters: a business that runs on a rota and has not
-- entered next month's would see either every slot vanish, or -- if the code
-- falls back to counting the business as one -- silently lose the protection
-- at the moment its rota is empty. A guarantee that switches itself off when
-- the data is thin is the failure mode this codebase keeps finding.
--
-- So it is asked and answered. `false` is the default and reproduces exactly
-- today's behaviour, so this migration changes no existing page's availability.
-- `true` means every offered slot has a named person free for the whole of it,
-- and a page switched on with nobody rostered says nobody is rostered rather
-- than offering the week.

alter table public.public_booking_pages
  add column if not exists assign_staff boolean not null default false;

comment on column public.public_booking_pages.assign_staff is
  'When true, a slot is offered only if a member of staff is on shift for the whole of it and not already booked, and the booking records which one. When false the page books the business as a whole, one appointment at a time.';

-- Availability reads one organization's shifts over a date window on every
-- visit by every stranger. Without this that is a sequential scan.
create index if not exists employee_schedules_org_starts_at_idx
  on public.employee_schedules (organization_id, starts_at);

-- And the per-person booking lookup that decides whether a rostered person is
-- already busy.
create index if not exists business_bookings_org_employee_starts_at_idx
  on public.business_bookings (organization_id, assigned_employee_id, starts_at);

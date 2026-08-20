-- A page a stranger can open to book an appointment.
--
-- Everything a booking needs already exists. business_service_catalog carries
-- duration_minutes and price_cents; business_bookings carries starts_at,
-- ends_at, a status vocabulary constrained at the table, and customer_name,
-- customer_email and customer_phone. What was missing was the front door: no
-- route, no address, and nowhere to record when a business is open.
--
-- ## Why opening hours live here and not in business_locations
--
-- business_locations describes where a business is. Being open is a property of
-- the booking page, not of the address -- one business may take appointments on
-- a schedule quite different from when its door is unlocked, and a business
-- with no location row at all can still take bookings. Putting hours on the
-- page also means switching the page off switches off availability, with one
-- column, rather than leaving hours behind that something else might read.
--
-- ## Why the default is off, and stays off
--
-- `enabled` defaults to false and `slug` defaults to null. This migration
-- publishes nobody. The same shape as shared_links and public_handle: absent
-- means not published, and a column that defaulted to a generated slug would
-- put every organization in the database on a public URL on deploy.
--
-- ## Why the slug is unique across the table
--
-- It is the whole address. /book/<slug> has to name one organization, so two
-- businesses cannot hold the same one, and the constraint is here rather than
-- only in the application because the application is not the only thing that
-- can write this row.

create table if not exists public.public_booking_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text,
  enabled boolean not null default false,
  headline text,
  intro text,
  -- IANA name. The hours below are wall-clock times in this zone, and every
  -- instant the page computes is derived by applying it. A booking page with no
  -- zone cannot say what "09:00" means, so this is NOT NULL with a default that
  -- is at least unambiguous rather than a guess at the owner's location.
  time_zone text not null default 'UTC',
  -- Seven entries, Sunday first, each either null (closed) or {"open":"09:00",
  -- "close":"17:00"}. jsonb rather than fourteen columns because the shape is
  -- read as a whole and never queried by day, and because a business that opens
  -- twice in one day can be given a second range here without a migration.
  opening_hours jsonb not null default '[null,null,null,null,null,null,null]'::jsonb,
  -- The slot grid, in minutes. A service longer than one slot occupies several.
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 240),
  -- How far ahead of now the earliest bookable slot is. Zero would let somebody
  -- book a slot starting in one minute.
  lead_time_hours integer not null default 12 check (lead_time_hours between 0 and 720),
  -- How far into the future the page will offer. Capped so a page cannot be
  -- made to compute a year of slots on every request.
  horizon_days integer not null default 21 check (horizon_days between 1 and 90),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- One booking page per organization. A second row would make "the booking page"
-- ambiguous everywhere it is read.
create unique index if not exists public_booking_pages_organization_key
  on public.public_booking_pages (organization_id);

-- Lowercase letters, digits and single hyphens, 3 to 48 characters, not
-- starting or ending with a hyphen. A slug with a slash in it is a slug that
-- changes which route matches.
alter table public.public_booking_pages
  drop constraint if exists public_booking_pages_slug_shape;
alter table public.public_booking_pages
  add constraint public_booking_pages_slug_shape
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$');

-- Unique where present. A partial index rather than a plain unique constraint
-- so that every unpublished page can keep a null slug.
create unique index if not exists public_booking_pages_slug_key
  on public.public_booking_pages (slug) where slug is not null;

-- The public page reads bookings for one organization over a date window to
-- work out what is already taken. Without this that is a sequential scan on
-- every visit by every stranger.
create index if not exists business_bookings_org_starts_at_idx
  on public.business_bookings (organization_id, starts_at);

alter table public.public_booking_pages enable row level security;

-- Deliberately no SELECT policy at all, for anonymous or for members.
--
-- Both routes that read this table -- the public /book/:slug page and the
-- owner's settings page -- go through the service role, which bypasses row
-- level security, and both carry their own filter: the public one by slug, the
-- owner one by organization_id. That filter is the tenant boundary, as it is
-- everywhere else in this application today.
--
-- An anon read policy is the one thing that would be actively wrong here: it
-- would hand every unpublished page's settings, including the slug an owner has
-- reserved and not yet switched on, to anyone who can reach PostgREST.
--
-- scripts/generate-member-read-policies.cjs writes policies for a measured list
-- of tables a GET route reads with a user JWT; this table is not on that list
-- because nothing reads it with a user JWT. If a read is ever switched to a
-- user token, it needs a policy added there first or it will return no rows.

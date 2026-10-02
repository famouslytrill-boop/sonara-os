-- Venues, events, and who said they are coming.
--
-- Growth Studio could plan a campaign and capture a lead. It could not hold the
-- thing a lot of small businesses and most creators actually run on: a date, a
-- place, and a list of people who said they would be there.
--
-- ## The one invariant this schema exists to protect
--
-- **A recorded seat must be a seat.** An RSVP system that silently accepts more
-- people than the room holds hands somebody a confirmation that is not true, and
-- they find out at the door. That is the defect this repository keeps finding in
-- other shapes -- a signal that reports success without being true -- in its most
-- expensive form, because here the person who believes it travelled.
--
-- So capacity is three-state, not two:
--
--   * a number        -- the room holds that many, and lib/sonara-growth-events.cjs
--                        waitlists past it rather than confirming
--   * NULL            -- **nobody has recorded a capacity**. Not zero, and not
--                        unlimited. An RSVP is still recorded, and the page says
--                        in words that no capacity is recorded so this is a
--                        registration of interest rather than a confirmed seat
--
-- `capacity integer` is therefore nullable on both tables, and the do-block at
-- the bottom asserts it stays that way. A later migration adding
-- `not null default 0` would turn every event with an unfilled box into an event
-- nobody can attend; `not null default` anything else would invent a room size.
--
-- ## Why the event carries its own capacity as well as the venue
--
-- The same hall is 300 standing and 120 seated. Capacity is a property of the
-- event in the room, not only of the room -- so `growth_events.capacity`
-- overrides `growth_venues.capacity` when set, and both being null is the
-- not-recorded case above. The resolution lives in the module, not here, because
-- a view would make it look like a stored fact.
--
-- ## Why `published` defaults to false and the slug defaults to null
--
-- The same shape as public_booking_pages, shared_links and public_handle: absent
-- means not published. A column defaulting to a generated slug would put every
-- event in the database on a public URL the moment this deploys.
--
-- ## Why a cancelled event stays readable
--
-- `status` is draft / published / cancelled, and cancelled is NOT a soft delete.
-- Somebody holding an RSVP needs the page to still answer, and to say it is off.
-- A cancelled event that 404s tells that person nothing, which is worse than
-- telling them the truth. What cancellation stops is new RSVPs, and that is
-- enforced in the module and asserted by test.
--
-- ## What this does not do, deliberately
--
--   * **It sends nothing.** AGENTS.md: "Sounds, voice announcements, haptics,
--     SMS, push, and email alerts must be off or explicitly user-controlled by
--     default." There is no notification column here and no send path. An RSVP
--     is recorded; nobody is messaged.
--   * **It takes no money.** There is no price, no card, no payment reference.
--     AGENTS.md forbids storing raw card data or CVV, and the way to be certain
--     of that is to have nowhere to put it. A paid ticket needs the connected
--     payment path and an owner decision; an RSVP is not a ticket.
--   * **It publishes no attendee.** Who said they are coming is the
--     organization's record, not public content. The public page shows counts,
--     never names or email addresses.

create table if not exists public.growth_venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- One free-text block rather than parsed address lines. An address is read by a
  -- person finding a door, and splitting it into fields that differ by country is
  -- how a form starts refusing valid addresses.
  address text,
  -- Nullable on purpose: see the capacity note in the header. Zero is a real and
  -- different statement -- a room that holds nobody -- so the check allows it
  -- while NULL stays "not recorded".
  capacity integer check (capacity is null or capacity >= 0),
  -- IANA name. An event's wall-clock time means nothing without it, and a venue
  -- with no zone cannot say what "19:30" is. Defaulted rather than guessed at the
  -- owner's location, same as public_booking_pages.
  time_zone text not null default 'UTC',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint growth_venues_name_length check (char_length(name) between 1 and 200)
);

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Nullable: an online event, a broadcast or a public announcement has no venue.
  -- `on delete set null` rather than cascade, because deleting a room must not
  -- delete the history of what happened in it.
  venue_id uuid references public.growth_venues(id) on delete set null,
  title text not null,
  summary text,
  -- What kind of thing this is. The vocabulary is constrained here as well as in
  -- the application, because the application is not the only thing that can write
  -- this row.
  kind text not null default 'event'
    check (kind in ('event', 'concert', 'meetup', 'announcement', 'broadcast')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),
  starts_at timestamptz not null,
  -- Nullable: an announcement has a date and no end. Where both are set the end
  -- must not precede the start, which is checked rather than left to the form.
  ends_at timestamptz,
  -- Overrides the venue's capacity when set. Nullable, and NULL means not
  -- recorded here rather than "fall back to zero".
  capacity integer check (capacity is null or capacity >= 0),
  -- The public address. Null until published, and unique across the table because
  -- /events/<slug> has to name exactly one event.
  slug text,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint growth_events_title_length check (char_length(title) between 1 and 200),
  constraint growth_events_ends_after_starts check (ends_at is null or ends_at >= starts_at),
  -- Published and addressable are the same thing. An event cannot be published
  -- with no slug, because there would be no page; and a slug on a draft is
  -- allowed, so an owner can reserve the address before going live.
  constraint growth_events_published_has_slug check (status <> 'published' or slug is not null)
);

-- Lowercase letters, digits and single hyphens, 3 to 48 characters. Same shape as
-- public_booking_pages, for the same reason: a slug with a slash in it changes
-- which route matches.
alter table public.growth_events
  drop constraint if exists growth_events_slug_shape;
alter table public.growth_events
  add constraint growth_events_slug_shape
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$');

create unique index if not exists growth_events_slug_key
  on public.growth_events (slug) where slug is not null;

create table if not exists public.growth_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.growth_events(id) on delete cascade,
  display_name text not null,
  -- How to reach them, and the only personal data here. No phone, no address: an
  -- RSVP needs one way to be recognised and nothing more, and a field that exists
  -- is a field that leaks.
  email text not null,
  -- going / not_going / **NULL = has not answered**. Three states, because
  -- somebody who opened the page and registered without answering has not said
  -- no. `false` for an unanswered question is the defect this schema's header is
  -- about, in a second column.
  attending boolean,
  -- How many seats this row holds. 1 by default; a row for a family of four holds
  -- four, and that is what counts against capacity rather than the row count.
  party_size integer not null default 1 check (party_size between 1 and 50),
  -- confirmed / waitlisted / withdrawn. Decided by lib/sonara-growth-events.cjs
  -- against the resolved capacity at the moment the row is written, and stored
  -- rather than recomputed -- somebody told they are confirmed must stay
  -- confirmed when a later cancellation changes the arithmetic.
  state text not null default 'confirmed'
    check (state in ('confirmed', 'waitlisted', 'withdrawn')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint growth_event_rsvps_name_length check (char_length(display_name) between 1 and 200),
  constraint growth_event_rsvps_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- One RSVP per person per event, case-insensitively. Without this, refreshing the
-- form holds two seats for one person, and the count the owner reads is wrong in
-- the direction that makes them turn people away.
create unique index if not exists growth_event_rsvps_person_key
  on public.growth_event_rsvps (event_id, lower(email));

create index if not exists growth_venues_organization_idx
  on public.growth_venues (organization_id, created_at desc);
create index if not exists growth_events_organization_idx
  on public.growth_events (organization_id, starts_at desc);
create index if not exists growth_events_venue_idx
  on public.growth_events (venue_id) where venue_id is not null;
create index if not exists growth_event_rsvps_event_idx
  on public.growth_event_rsvps (event_id, state);
create index if not exists growth_event_rsvps_organization_idx
  on public.growth_event_rsvps (organization_id, created_at desc);

alter table public.growth_venues enable row level security;
alter table public.growth_events enable row level security;
alter table public.growth_event_rsvps enable row level security;

-- Service role only, and no DELETE on any of the three.
--
-- A withdrawn RSVP is a state, not an absence: the person came off the list and
-- the organization needs to know somebody did, or a waitlist promotion has no
-- explanation. A cancelled event is the same. Deleting either erases a record
-- somebody will ask about, and "destructive data changes" is an owner-approval
-- category in AGENTS.md.
grant select, insert, update on public.growth_venues to service_role;
grant select, insert, update on public.growth_events to service_role;
grant select, insert, update on public.growth_event_rsvps to service_role;
revoke all on public.growth_venues from anon, authenticated;
revoke all on public.growth_events from anon, authenticated;
revoke all on public.growth_event_rsvps from anon, authenticated;

notify pgrst, 'reload schema';

do $$
declare
  t text;
  nullable text;
begin
  foreach t in array array['growth_venues', 'growth_events', 'growth_event_rsvps'] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise exception 'public.% was not created', t;
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception 'public.% does not have row level security enabled', t;
    end if;

    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% carries a policy; these tables are reached through the service role only', t;
    end if;

    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = t
        and grantee = 'service_role' and privilege_type = 'DELETE'
    ) then
      raise exception 'public.% grants DELETE to service_role; a withdrawal is a recorded state and deleting it erases it', t;
    end if;

    for nullable in select unnest(array['SELECT', 'INSERT', 'UPDATE']) loop
      if not exists (
        select 1 from information_schema.role_table_grants
        where table_schema = 'public' and table_name = t
          and grantee = 'service_role' and privilege_type = nullable
      ) then
        raise exception 'public.% does not grant % to service_role', t, nullable;
      end if;
    end loop;

    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = t
        and grantee in ('anon', 'authenticated')
    ) then
      raise exception 'public.% is reachable by anon or authenticated; it must be service-role only', t;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'organization_id' and is_nullable = 'YES'
    ) then
      raise exception 'public.%.organization_id is nullable; every row here belongs to one organization', t;
    end if;
  end loop;

  -- Capacity stays nullable on both tables. This is the assertion the header is
  -- about: NOT NULL DEFAULT 0 would make every event with an unfilled box an
  -- event nobody can attend, and NOT NULL DEFAULT anything else invents a room
  -- size somebody will be turned away on.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'growth_venues'
      and column_name = 'capacity' and is_nullable = 'NO'
  ) then
    raise exception 'growth_venues.capacity is NOT NULL; "nobody has recorded a capacity" is a state and must stay representable';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'growth_events'
      and column_name = 'capacity' and is_nullable = 'NO'
  ) then
    raise exception 'growth_events.capacity is NOT NULL; "nobody has recorded a capacity" is a state and must stay representable';
  end if;

  -- And so does `attending`. A person who registered without answering has not
  -- said no.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'growth_event_rsvps'
      and column_name = 'attending' and is_nullable = 'NO'
  ) then
    raise exception 'growth_event_rsvps.attending is NOT NULL; an unanswered question would become a no';
  end if;

  -- One person, one RSVP per event, case-insensitively.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'growth_event_rsvps_person_key'
  ) then
    raise exception 'growth_event_rsvps has no unique index on (event_id, lower(email)); one person could hold two seats';
  end if;

  -- A published event has an address, enforced at the table.
  if not exists (
    select 1 from pg_constraint
    where conname = 'growth_events_published_has_slug'
  ) then
    raise exception 'growth_events can be published with no slug; there would be no page to publish it to';
  end if;

  -- The slug is unique where present, so /events/<slug> names one event.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'growth_events_slug_key'
  ) then
    raise exception 'growth_events.slug is not unique; one public address could name two events';
  end if;

  -- Nothing here holds money or a card. Asserted against the live catalogue
  -- rather than trusted from the create statement above, because the thing worth
  -- preventing is a later migration adding one.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('growth_venues', 'growth_events', 'growth_event_rsvps')
      and (column_name like '%card%' or column_name like '%cvv%' or column_name like '%price%'
           or column_name like '%amount%' or column_name like '%payment%')
  ) then
    raise exception 'an events table has gained a money or card column; an RSVP is not a ticket and AGENTS.md forbids storing card data';
  end if;
end $$;

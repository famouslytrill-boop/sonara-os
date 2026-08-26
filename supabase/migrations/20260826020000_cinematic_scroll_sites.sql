-- Cinematic scroll sites.
--
-- One table. A site is a title, an address it may be published at, and a JSON
-- document holding everything else -- sections, colours, typeface, audio, the
-- frame sequence. `lib/sonara-scroll-site.cjs` is the only thing that decides
-- what a valid document is, and every reader goes through it, so the shape
-- lives in one place rather than in a schema and a module that can disagree.
--
-- ## Why the document is jsonb rather than columns
--
-- Sections are an ordered list of a dozen heterogeneous things, and their shape
-- is the part most likely to change while somebody is still deciding what this
-- product is. Twelve columns for `section_1_heading` is the version of this
-- that cannot be changed; a `scroll_sections` child table is a join and an
-- ordering column for data that is never queried across sites and is always
-- read whole.
--
-- What is NOT in the document is the part worth stating: `slug`, `published_at`
-- and `organization_id` are real columns, because they are the things queried
-- across rows. An address has to be unique, and uniqueness inside a jsonb
-- column is not something the database can hold.

create table if not exists public.scroll_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Who made it. Kept so a workspace with several people can tell, and
  -- deliberately not used for access: a site belongs to the organization, and
  -- scoping reads to the creator would hide a colleague's work from the
  -- business that owns it.
  created_by uuid,

  title text not null default 'Untitled site',
  -- The template it started from, for the record rather than for rendering. A
  -- site that has been edited no longer resembles its template, and nothing
  -- reads this to decide how to draw the page.
  template_key text,

  -- The published address. Null until somebody publishes.
  --
  -- Unique across the whole table rather than per organization, because it is a
  -- path segment on a shared domain: two businesses cannot both own /s/summer.
  slug text unique,
  published_at timestamptz,

  document jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The dashboard reads one organization's sites, newest first, on every visit.
create index if not exists scroll_sites_org_updated_idx
  on public.scroll_sites (organization_id, updated_at desc);

-- The public page resolves a slug to exactly one published row. Partial, so the
-- index holds only rows that can actually be served.
create index if not exists scroll_sites_published_slug_idx
  on public.scroll_sites (slug)
  where slug is not null and published_at is not null;

-- ---------------------------------------------------------------------------
-- The address rules, in the database rather than only in the application.
-- ---------------------------------------------------------------------------
--
-- `lib/sonara-scroll-site.cjs` already refuses a slug that is not this shape.
-- This is here anyway, because that module is one writer and a constraint is
-- every writer: a slug arriving through some later import, a fix-up run by
-- hand, or a route somebody adds without reading the module.
alter table public.scroll_sites
  drop constraint if exists scroll_sites_slug_shape;

alter table public.scroll_sites
  add constraint scroll_sites_slug_shape
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,47}$');

-- Published means published *at* an address. A row with `published_at` set and
-- no slug is a site the dashboard reports as live and nothing can reach, which
-- is precisely the kind of state this codebase keeps finding.
alter table public.scroll_sites
  drop constraint if exists scroll_sites_published_has_address;

alter table public.scroll_sites
  add constraint scroll_sites_published_has_address
  check (published_at is null or slug is not null);

-- ---------------------------------------------------------------------------
-- Row level security.
-- ---------------------------------------------------------------------------
--
-- Enabled with no policies, matching lead_capture_pages and public_booking_pages
-- and for the same reason. Every route reading this table goes through the
-- service role, which bypasses row level security, and carries its own filter:
-- the dashboard and editor by organization_id, the public page by slug and then
-- by `published_at is not null`. That filter is the tenant boundary here as it
-- is everywhere else.
--
-- An anon read policy would be the dangerous one, and not obviously so -- most
-- of what is in here is meant to be published eventually. The rows that are not
-- are the unpublished drafts, which is where somebody's unannounced product,
-- unfinished pricing and working title all sit.
alter table public.scroll_sites enable row level security;

-- scripts/generate-member-read-policies.cjs writes policies for the measured
-- list of tables a GET route reads with a user JWT. scroll_sites is not on that
-- list, because nothing reads it with a user token. If a read is ever switched
-- to one it needs a policy added there first, or it will return no rows --
-- which looks exactly like a customer who has never made a site.

comment on table public.scroll_sites is
  'Cinematic scroll websites. The document column is validated by lib/sonara-scroll-site.cjs, which is the only definition of its shape.';

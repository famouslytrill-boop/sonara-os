-- Retiring a Creator Studio record without deleting it.
--
-- 20260901150000_owner_records_can_be_archived.sql added `archived_at` to the
-- sixteen Business Builder tables whose pages have no terminal status of their
-- own. It added it to none of the Creator Studio tables, and the seven Creator
-- Studio record pages were rendering an Archive control anyway.
--
-- That is one cause with two symptoms. The card renderer asks
-- `recordArchive.canArchive(page)` -- a predicate about the page's shape, not
-- about the schema -- so the control appeared for six of the seven. The route
-- that would answer it was registered inside `ALL_OWNER_PAGES.forEach`, so it
-- existed for Business Builder only, and the form posted to a path with no
-- handler. Registering the route without this migration would have replaced a
-- 404 with a PostgREST error about a column that does not exist: the same dead
-- button, failing one layer further in.
--
-- The six are derived rather than listed by hand. `canArchive` is false for
-- `creator_artist_profiles`, whose page declares
-- `status in ('active','paused','archived')` -- it already has a way to retire
-- a record, and no page is given two.
--
--   node -e 'const p=require("./lib/sonara-owner-record-pages.cjs"),
--            a=require("./lib/sonara-record-archive.cjs");
--            console.log(p.CREATOR_RECORD_PAGES.filter(a.canArchive).map(x=>x.table))'
--
-- ## What archiving is here, and what it is not
--
-- The same display decision as on the owner side, and worth restating because
-- creative work is not a vendor invoice: archiving a music project does not
-- unpublish it, does not revoke a share link, does not touch provenance or
-- consent records, and does not remove it from any export. It stops the row
-- appearing on the list page that asked. Only that list read filters on the
-- column.
--
-- Anti-clone and provenance safety in AGENTS.md is unaffected for the same
-- reason: nothing in that path reads `archived_at`, so a row cannot be put
-- beyond a consent check by archiving it.

alter table public.music_projects            add column if not exists archived_at timestamptz;
alter table public.sound_cues                add column if not exists archived_at timestamptz;
alter table public.creator_sonic_profiles    add column if not exists archived_at timestamptz;
alter table public.creator_album_cycles      add column if not exists archived_at timestamptz;
alter table public.creator_prompt_blueprints add column if not exists archived_at timestamptz;
alter table public.creator_video_treatments  add column if not exists archived_at timestamptz;

-- No index, for the reason the owner migration gives and which holds here too:
-- every one of these tables is scoped to one organization and the list page
-- already filters on `organization_id`, so a query touches one workspace's rows
-- rather than millions. Six partial indexes would earn nothing and cost a write
-- on every insert.

comment on column public.music_projects.archived_at is
  'When a creator chose to stop seeing this on their list. A display decision, not a delete: it does not unpublish, revoke a share link, or touch provenance or consent. See lib/sonara-record-archive.cjs.';

-- Creator Studio records can be archived, which their pages already claimed.
--
-- `20260901150000_owner_records_can_be_archived.sql` added `archived_at` to
-- sixteen Business Builder tables, derived from whether a page declares a
-- terminal status of its own. Creator Studio was not in that pass.
--
-- The pages were, though. `lib/sonara-record-archive.cjs` decides whether to
-- render an archive control from the **page's shape** -- it has a table, it has
-- a path, it declares no terminal status -- and every Creator Studio record page
-- satisfies that. So six of them have been rendering an "Archive" button at full
-- contrast, with no `archived_at` column behind it and no route registered to
-- receive the submission, since the record pages shipped.
--
-- Found on 27 September 2026 by crawling the rendered pages with one seeded row
-- and checking every `<form action>` against the registered routes. The
-- logged-out and empty-state crawls could not see it: a row action renders once
-- per row, and with every table stubbed empty it renders zero times.
--
-- The six, and the page each belongs to:
--
--   music_projects              /creator-studio/music-projects
--   sound_cues                  /creator-studio/device-cues
--   creator_sonic_profiles      /creator-studio/sound-identity
--   creator_album_cycles        /creator-studio/album-cycles
--   creator_prompt_blueprints   /creator-studio/prompt-blueprints
--   creator_video_treatments    /creator-studio/video-treatments
--
-- `creator_artist_profiles` is deliberately absent. It declares
-- `status in ('active','paused','archived')`, so it already has a way to retire
-- a record and `canArchive` correctly returns false for it -- no page is ever
-- offered two ways to do one thing. What it was missing is the status route,
-- which is a routing fix rather than a schema one and lands with this change.
--
-- ## What archiving is, and what it deliberately is not
--
-- It is a display decision: stop showing me this on my list. It is not a delete.
-- Nothing cascades, nothing is destroyed, and no other part of the application
-- reads this column. The same reading as the Business Builder migration it
-- mirrors, for the same reason: the fear on seeing a new "archive" capability is
-- that something disappears, and the answer is that a row is only hidden from a
-- default list and comes back by asking for archived records.
--
-- Additive and idempotent. A nullable timestamptz with `if not exists`, no
-- backfill, no default, no constraint, and nothing dropped. Every existing row
-- keeps reading as not archived, because NULL is what "not archived" means here.

alter table public.music_projects            add column if not exists archived_at timestamptz;
alter table public.sound_cues                add column if not exists archived_at timestamptz;
alter table public.creator_sonic_profiles    add column if not exists archived_at timestamptz;
alter table public.creator_album_cycles      add column if not exists archived_at timestamptz;
alter table public.creator_prompt_blueprints add column if not exists archived_at timestamptz;
alter table public.creator_video_treatments  add column if not exists archived_at timestamptz;

-- The list pages filter on `archived_at is null` on every read, so each of these
-- is the index that filter wants. Partial, because the rows it has to find are
-- the unarchived ones and they are the overwhelming majority of every table.
create index if not exists music_projects_unarchived_idx
  on public.music_projects (organization_id) where archived_at is null;
create index if not exists sound_cues_unarchived_idx
  on public.sound_cues (organization_id) where archived_at is null;
create index if not exists creator_sonic_profiles_unarchived_idx
  on public.creator_sonic_profiles (organization_id) where archived_at is null;
create index if not exists creator_album_cycles_unarchived_idx
  on public.creator_album_cycles (organization_id) where archived_at is null;
create index if not exists creator_prompt_blueprints_unarchived_idx
  on public.creator_prompt_blueprints (organization_id) where archived_at is null;
create index if not exists creator_video_treatments_unarchived_idx
  on public.creator_video_treatments (organization_id) where archived_at is null;

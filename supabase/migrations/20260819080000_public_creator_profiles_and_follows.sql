-- A creator profile somebody outside the workspace can open, and the people who
-- asked to hear about it.
--
-- creator_artist_profiles has existed since the artist system landed, with
-- public_description as an explicitly public field and artist_key unique per
-- organization. Nothing had ever put one on a page a stranger could reach, so
-- the "public" in public_description was aspirational.
--
-- ## Why a handle rather than reusing artist_key
--
-- artist_key is `unique(organization_id, artist_key)`. Two businesses can both
-- have an artist keyed `nova`, which is correct inside a workspace and useless
-- as a URL: /creator/nova would have to pick one. public_handle is unique across
-- the whole table, which is what a public address requires.
--
-- ## Why NULL is the default, and stays the default
--
-- A profile is private until its owner gives it a handle. This is the same shape
-- as shared_links: absent means not published, and no existing row is published
-- by this migration. A column that defaulted to a generated handle would publish
-- every artist profile in the database on deploy.

alter table public.creator_artist_profiles
  add column if not exists public_handle text,
  add column if not exists published_at timestamptz;

-- Lowercase letters, digits and single hyphens, 3 to 32 characters, not starting
-- or ending with a hyphen. Enforced here rather than only in the application,
-- because the application is not the only thing that can write this row and a
-- handle with a slash in it is a handle that changes which route matches.
alter table public.creator_artist_profiles
  drop constraint if exists creator_artist_profiles_public_handle_shape;
alter table public.creator_artist_profiles
  add constraint creator_artist_profiles_public_handle_shape
  check (public_handle is null or public_handle ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$');

create unique index if not exists creator_artist_profiles_public_handle_key
  on public.creator_artist_profiles(public_handle)
  where public_handle is not null;

comment on column public.creator_artist_profiles.public_handle is
  'Globally unique address for a profile the owner chose to publish, used as /creator/<handle>. NULL means the profile is private, which is the default and the state of every row created before this migration.';

-- ---------------------------------------------------------------------------
-- Following
-- ---------------------------------------------------------------------------
--
-- ## This table deliberately has no organization_id, and that is the one thing
-- ## worth reading before changing it.
--
-- Every other tenant-scoped table in this database carries organization_id
-- because the service-role key bypasses row level security and the filter in the
-- query is the only boundary. A follow is different in kind: it is an edge
-- between a person and somebody else's published profile, and it crosses the
-- tenant boundary by design. There is no single organization it belongs to --
-- the follower's, if they have one, is irrelevant, and the artist's is already
-- reachable through artist_profile_id.
--
-- The two reads this table exists for are each scoped by something the caller
-- owns or is:
--
--   * "who follows this artist"        -> artist_profile_id, which the owner's
--                                         page has already scoped by organization
--   * "which artists does this person  -> follower_user_id, which is the signed-in
--      follow"                            caller and nobody else
--
-- Neither needs an organization filter, and adding one would either be wrong or
-- a lie about what the row means.
--
-- ## A follow notifies nobody
--
-- AGENTS.md: sounds, voice announcements, haptics, SMS, push and email alerts
-- are off or explicitly user-controlled by default. Nothing reads this table to
-- send anything, and nothing should start without that being a separate,
-- opted-in decision.

create table if not exists public.creator_follows (
  id uuid primary key default gen_random_uuid(),
  artist_profile_id uuid not null references public.creator_artist_profiles(id) on delete cascade,
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One row per person per artist. Without this, pressing Follow twice -- or
  -- twice at once from two tabs -- records two follows and the count is wrong
  -- in a way nobody can see.
  unique (artist_profile_id, follower_user_id)
);

create index if not exists creator_follows_artist_idx
  on public.creator_follows(artist_profile_id, created_at desc);
create index if not exists creator_follows_follower_idx
  on public.creator_follows(follower_user_id, created_at desc);

alter table public.creator_follows enable row level security;

drop policy if exists "service role can manage creator_follows" on public.creator_follows;
create policy "service role can manage creator_follows" on public.creator_follows
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- A person may read their own follows. Deliberately not "anybody may read who
-- follows an artist": a follower list is a list of named people, and publishing
-- one is a decision nobody here has made.
drop policy if exists "people can read their own follows" on public.creator_follows;
create policy "people can read their own follows" on public.creator_follows
for select using (auth.uid() = follower_user_id);

comment on table public.creator_follows is
  'Who asked to hear about which published creator profile. No organization_id on purpose -- a follow crosses the tenant boundary and is scoped by artist_profile_id or follower_user_id instead. Nothing reads this to send a notification.';

do $report$
declare
  published bigint;
begin
  select count(*) into published from public.creator_artist_profiles where public_handle is not null;
  raise notice 'Creator profiles published: %. Follows recorded: %',
    published, (select count(*) from public.creator_follows);
end
$report$;

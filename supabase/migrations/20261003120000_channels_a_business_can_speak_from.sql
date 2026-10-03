-- Channels: a place a business can speak from in public.
--
-- Growth Studio could publish an event and take an RSVP. It had nowhere to say
-- anything between events -- no running page of posts and announcements that a
-- stranger can open, and no way for that stranger to say "this post should not be
-- here". This adds both, and a directory at /channels so a channel can be found.
--
-- ## The invariant this schema exists to protect
--
-- **What is on a public page is what the business published, and nothing else.**
-- A removed post must stop being public at once; a draft or hidden channel must
-- not be reachable by guessing its address; and nothing about the people who
-- wrote or reported a post reaches a stranger.
--
-- ## Four tables
--
--   growth_channels           the channel, owned by one organization
--   growth_channel_posts      what it said, with state published/removed
--   growth_post_reports       what a stranger flagged, anonymously
--   growth_channel_directory  the public listing -- no organization_id at all
--
-- The directory exists for the same reason creator_marketplace_entries does.
-- /channels lists every organization's public channels at once, and
-- tests/cross-tenant-isolation.test.js holds -- with no exemption list -- that a
-- non-parameterised page never reads a tenant-scoped table without naming an
-- organization. So the cross-organization page reads a table that is not tenant
-- data. Its column set is asserted below, so a column added later fails the
-- migration instead of quietly becoming public.
--
-- /channels/:handle reads growth_channels directly, by its unique handle with
-- state=eq.public -- one row -- and every later read is scoped by the
-- organization_id that row carries. lib/sonara-tenant-guard.cjs pins that exact
-- lookup; without the pin the guard refuses it and the page answers 503, which is
-- what happened to six public pages until 2 October 2026.
--
-- ## What this does not do, deliberately
--
--   * **It sends nothing.** A post is not a notification. There is no follower
--     list here and no send path: AGENTS.md says alerts are off or explicitly
--     user-controlled by default, and the way to be sure is to have nowhere to
--     send from. A channel can be read, and pulled as a feed by whoever chooses.
--   * **A report does not hide a post.** Reports are counted for the owner, who
--     decides. A post that disappeared on enough reports would hand every post's
--     visibility to whoever can send the most reports.
--   * **It deletes nothing.** A removed post, a dismissed report and a hidden
--     channel are states. Destructive data changes are an owner-approval category
--     in AGENTS.md, and a removal somebody asks about later has to still exist.
--   * **It records nobody's identity on a report.** No user id, no address, no
--     email. The rate limit on the report form is what stands between it and a
--     flood, and that lives in the limiter, not in this table.

create table if not exists public.growth_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- The public address: /channels/<handle>. Same shape as a creator handle,
  -- checked by lib/sonara-creator-profiles.cjs checkHandle before it is written.
  -- Set once; the module offers no way to change it, because a changed handle is
  -- a broken link somebody printed.
  handle text not null,
  title text not null,
  about text,
  -- draft: nobody but the business sees it. public: anybody can. hidden: it was
  -- public and has been taken down -- kept rather than deleted so its posts and
  -- reports stay where the business can see them.
  state text not null default 'draft' check (state in ('draft', 'public', 'hidden')),
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_channels_title_length check (char_length(title) between 1 and 120),
  constraint growth_channels_about_length check (about is null or char_length(about) <= 1000),
  constraint growth_channels_handle_shape check (handle ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);

-- Unique across the table, because /channels/<handle> has to name one channel.
create unique index if not exists growth_channels_handle_key on public.growth_channels (handle);
create index if not exists growth_channels_organization_idx on public.growth_channels (organization_id, created_at desc);

create table if not exists public.growth_channel_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.growth_channels(id) on delete cascade,
  -- Who wrote it, for the business's own record. Never selected by a public page.
  author_user_id uuid,
  -- An announcement is a post the public page shows first. It is not a message
  -- sent to anybody.
  kind text not null default 'post' check (kind in ('post', 'announcement')),
  body text not null,
  -- An event this post is about. `on delete set null` because removing an event
  -- must not remove what was said about it. Linked publicly only while the event
  -- is published or cancelled -- never a draft -- which the route checks with the
  -- channel's own organization.
  event_id uuid references public.growth_events(id) on delete set null,
  state text not null default 'published' check (state in ('published', 'removed')),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_channel_posts_body_length check (char_length(body) between 1 and 2000)
);

create index if not exists growth_channel_posts_channel_idx
  on public.growth_channel_posts (channel_id, state, created_at desc);
create index if not exists growth_channel_posts_organization_idx
  on public.growth_channel_posts (organization_id, created_at desc);

create table if not exists public.growth_post_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null references public.growth_channel_posts(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'violence', 'sexual', 'illegal', 'misleading', 'other')),
  note text,
  -- open: nobody has looked. dismissed: the business looked and left the post.
  -- actioned: the business removed the post.
  state text not null default 'open' check (state in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint growth_post_reports_note_length check (note is null or char_length(note) <= 500)
);

create index if not exists growth_post_reports_post_idx on public.growth_post_reports (post_id, state);
create index if not exists growth_post_reports_organization_idx on public.growth_post_reports (organization_id, state, created_at desc);

create table if not exists public.growth_channel_directory (
  channel_id uuid primary key references public.growth_channels(id) on delete cascade,
  handle text not null,
  title text not null,
  about text,
  listed_at timestamptz not null default now()
);

comment on table public.growth_channel_directory is
  'The public channel directory: one row per public channel, holding only what a stranger may see and no organization. /channels reads this and nothing else.';

create index if not exists growth_channel_directory_listed_idx on public.growth_channel_directory (listed_at desc);

alter table public.growth_channels enable row level security;
alter table public.growth_channel_posts enable row level security;
alter table public.growth_post_reports enable row level security;
alter table public.growth_channel_directory enable row level security;

-- Service role only. No DELETE on the three that hold the business's record --
-- removal, dismissal and hiding are states. The directory is a listing, and a
-- listing is taken down by deleting its row.
grant select, insert, update on public.growth_channels to service_role;
grant select, insert, update on public.growth_channel_posts to service_role;
grant select, insert, update on public.growth_post_reports to service_role;
grant select, insert, update, delete on public.growth_channel_directory to service_role;
revoke all on public.growth_channels from anon, authenticated;
revoke all on public.growth_channel_posts from anon, authenticated;
revoke all on public.growth_post_reports from anon, authenticated;
revoke all on public.growth_channel_directory from anon, authenticated;

notify pgrst, 'reload schema';

do $$
declare
  t text;
  privilege text;
  directory_columns text;
  identity_columns text;
begin
  foreach t in array array['growth_channels', 'growth_channel_posts', 'growth_post_reports', 'growth_channel_directory'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t and c.relrowsecurity) then
      raise exception 'public.% does not have row level security enabled', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% carries a policy; channels are reached through the service role only', t;
    end if;
    if exists (select 1 from information_schema.role_table_grants
               where table_schema = 'public' and table_name = t and grantee in ('anon', 'authenticated')) then
      raise exception 'public.% is reachable by anon or authenticated; it must be service-role only', t;
    end if;
    foreach privilege in array array['SELECT', 'INSERT', 'UPDATE'] loop
      if not exists (select 1 from information_schema.role_table_grants
                     where table_schema = 'public' and table_name = t
                       and grantee = 'service_role' and privilege_type = privilege) then
        raise exception 'public.% does not grant % to service_role', t, privilege;
      end if;
    end loop;
  end loop;

  -- 1. Removing, dismissing and hiding are states. A DELETE grant on the record
  -- tables would make the destructive version one call away.
  foreach t in array array['growth_channels', 'growth_channel_posts', 'growth_post_reports'] loop
    if exists (select 1 from information_schema.role_table_grants
               where table_schema = 'public' and table_name = t
                 and grantee = 'service_role' and privilege_type = 'DELETE') then
      raise exception 'public.% grants DELETE to service_role; a removal is a recorded state and deleting it erases it', t;
    end if;
  end loop;

  -- 2. The directory is exactly these columns. No organization_id, no author, no
  -- state -- a column added later is a column made public, so it fails here.
  select string_agg(column_name, ',' order by column_name) into directory_columns
    from information_schema.columns
   where table_schema = 'public' and table_name = 'growth_channel_directory';
  if directory_columns is distinct from 'about,channel_id,handle,listed_at,title' then
    raise exception 'growth_channel_directory has columns %; the public directory holds exactly about, channel_id, handle, listed_at and title', directory_columns;
  end if;

  -- 3. A report records nobody. Read from the catalogue, because the thing worth
  -- preventing is a later migration adding a reporter column.
  select string_agg(column_name, ', ' order by column_name) into identity_columns
    from information_schema.columns
   where table_schema = 'public' and table_name = 'growth_post_reports'
     and (column_name like '%user%' or column_name like '%email%' or column_name like '%ip%'
          or column_name like '%reporter%' or column_name like '%address%' or column_name like '%phone%');
  if identity_columns is not null then
    raise exception 'growth_post_reports carries %; a report is anonymous and records nobody', identity_columns;
  end if;

  -- 4. One handle names one channel.
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'growth_channels_handle_key') then
    raise exception 'growth_channels.handle is not unique; one public address could name two channels';
  end if;

  -- 5. A channel starts as a draft. Defaulting to public would put every channel
  -- created on a public address the moment it was saved.
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'growth_channels' and column_name = 'state')
     is distinct from '''draft''::text' then
    raise exception 'growth_channels.state does not default to draft';
  end if;
end $$;

-- The Creator Studio chain, from a brief to something you may publish.
--
-- ## What was missing, measured rather than assumed
--
-- Measured 1-2 October 2026. Twenty-eight `creator_*` tables exist and the chain
-- the owner asked for -- brief -> asset -> version -> approval -> export ->
-- publish -- had four links absent:
--
--   brief      No table. `creator_production_notes` is the closest thing in the
--              schema and nothing reads or writes it (see
--              lib/sonara-orphan-tables.cjs).
--   version    `creator_assets` has no version column and no lineage table. An
--              asset is a single mutable row.
--   approval   None for Creator Studio. `growth_content_queue` has an
--              approval_status and `sonara_prompt_templates` has an approval
--              workflow with its own version counter -- two subsystems each
--              solved this for themselves and Creator Studio got neither.
--   export     `creator_export_packages` exists and NOTHING WRITES IT.
--
-- These three tables and one column add the first three. The export link is
-- deliberately not added here: that table already exists, and giving it a second
-- home would be the duplicate this repository has a gate against. What this
-- migration does instead is make an export *possible to justify* -- a version
-- carries its approval and its disclosure, so whatever writes an export later has
-- something true to copy.
--
-- ## Why the version is where the disclosure lives
--
-- `lib/sonara-generation-provenance.cjs` already records how a generated file was
-- made -- `generated`, `rights_attested`, `consent_attested`, and a SHA-256 --
-- and renders it on the generation job page. It stops there, and not because
-- anything drops it: the rows it would travel into are never written.
--
-- So provenance sits on the VERSION rather than on a disclosure table of its own.
-- A version is the thing that gets approved, exported and published, so anything
-- downstream that names a version can read what made it. A separate disclosure
-- table would be a second place for the same fact to live and a second place for
-- it to go missing.
--
-- `ai_disclosure` is three-state on purpose and nullable for the same reason
-- `rights_attested` is: `null` is "nobody recorded it", which is not `false`.
-- AGENTS.md requires provenance and consent enforcement, and a disclosure that
-- defaults to "human" would assert something nobody checked. The one state this
-- schema refuses to invent is the one a publisher most needs to be true.

create table if not exists public.creator_briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text,
  intent text not null default 'original' check (intent in ('original','adaptation','commission','campaign')),
  status text not null default 'open' check (status in ('open','in_progress','delivered','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_briefs_title_length check (length(btrim(title)) between 1 and 200)
);

-- The lineage. One row per version of one asset, numbered from 1, with the
-- provenance that made it.
create table if not exists public.creator_asset_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.creator_assets(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  -- How this version came to exist. `generated` is the one that matters for
  -- disclosure; `edited` is a human change to a generated file, which is still
  -- disclosable and is the case a two-state field would lose.
  source text not null default 'uploaded' check (source in ('uploaded','generated','edited','imported')),
  -- Null means nobody recorded whether this is AI-generated. Not false.
  ai_disclosure boolean,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  checksum text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, version_number)
);

-- The approval, against a version rather than against the asset. Approving "the
-- asset" would approve whatever it becomes next, which is the hole an approval
-- workflow exists to close.
create table if not exists public.creator_asset_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_version_id uuid not null references public.creator_asset_versions(id) on delete cascade,
  state text not null default 'review_requested' check (state in ('review_requested','approved','rejected','withdrawn')),
  note text,
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The head of the chain, attached to the asset table that is actually written
-- (routes/sonara-asset-file-routes.cjs). Nullable, because every asset that
-- exists today has no brief and this migration must not invent one for them.
alter table public.creator_assets
  add column if not exists brief_id uuid references public.creator_briefs(id) on delete set null;

create index if not exists creator_briefs_organization_id_idx on public.creator_briefs (organization_id);
create index if not exists creator_asset_versions_asset_id_idx on public.creator_asset_versions (asset_id);
create index if not exists creator_asset_versions_organization_id_idx on public.creator_asset_versions (organization_id);
create index if not exists creator_asset_approvals_version_id_idx on public.creator_asset_approvals (asset_version_id);
create index if not exists creator_asset_approvals_organization_id_idx on public.creator_asset_approvals (organization_id);
create index if not exists creator_assets_brief_id_idx on public.creator_assets (brief_id);

alter table public.creator_briefs enable row level security;
alter table public.creator_asset_versions enable row level security;
alter table public.creator_asset_approvals enable row level security;

-- Migration 20260727190000 revoked default privileges on new public objects, so
-- these are unreachable by every role until this says who may touch them.
--
-- anon and authenticated are deliberately absent: RLS is on with no policy, so
-- those roles are already closed out, and this is the second half of the same
-- decision. A brief is a customer's unpublished creative plan.
--
-- No delete anywhere. A version is the record of what existed and what was
-- approved; deleting one would make an approval point at nothing while the
-- approval still read as given. Closing a brief is an update, withdrawing an
-- approval is an update, and superseding a version is writing the next one.
grant select, insert, update on table public.creator_briefs to service_role;
grant select, insert, update on table public.creator_asset_versions to service_role;
grant select, insert, update on table public.creator_asset_approvals to service_role;

do $$
declare
  t text;
begin
  foreach t in array array['creator_briefs','creator_asset_versions','creator_asset_approvals'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'public.% was not created', t;
    end if;

    if not exists (
      select 1 from pg_catalog.pg_class where oid = ('public.' || t)::regclass and relrowsecurity
    ) then
      raise exception 'public.% exists without row level security enabled', t;
    end if;

    -- RLS with no policy is the posture. A policy here is somebody opening the
    -- table to a browser role; fail rather than allow it.
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'public.% has a row level security policy; it is meant to be reachable only by the service role', t;
    end if;

    if not pg_catalog.has_table_privilege('service_role', 'public.' || t, 'SELECT')
       or not pg_catalog.has_table_privilege('service_role', 'public.' || t, 'INSERT')
       or not pg_catalog.has_table_privilege('service_role', 'public.' || t, 'UPDATE') then
      raise exception 'service_role cannot read, write or update public.%; the project graph would be unreachable', t;
    end if;

    -- Checked rather than trusted to the revoke above, because a later migration
    -- granting broadly across public would reopen this quietly.
    if pg_catalog.has_table_privilege('anon', 'public.' || t, 'SELECT')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || t, 'SELECT') then
      raise exception 'public.% is readable by a browser role; unpublished creative work is not public', t;
    end if;

    -- A delete privilege arriving later would make the "no destructive path"
    -- claim in the comment above false while the comment still read as current.
    if pg_catalog.has_table_privilege('service_role', 'public.' || t, 'DELETE') then
      raise exception 'service_role can delete from public.%; superseding is a write and no delete path was meant to exist', t;
    end if;

    -- The tenant boundary, and nothing else enforces it: with no policy on the
    -- table a null here would be a row no organization owns.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'organization_id' and is_nullable = 'YES'
    ) then
      raise exception 'public.%.organization_id is nullable; a row with no organization is a row nothing can scope', t;
    end if;
  end loop;

  -- The disclosure must stay nullable. A NOT NULL with a default would turn
  -- "nobody recorded it" into an assertion, which is the one thing a publisher
  -- must not be handed.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_asset_versions'
      and column_name = 'ai_disclosure' and is_nullable = 'YES'
  ) then
    raise exception 'creator_asset_versions.ai_disclosure is not nullable; absent would become false and the schema would assert a disclosure nobody made';
  end if;

  -- One version number per asset. Without this, two rows could claim version 2
  -- and which one an approval pointed at would depend on row order.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.creator_asset_versions'::regclass and contype = 'u'
  ) then
    raise exception 'creator_asset_versions has no unique constraint on (asset_id, version_number); two rows could claim the same version';
  end if;

  -- The brief link on the asset table, which is what joins the head of the chain
  -- to the only creator table the application actually writes.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_assets' and column_name = 'brief_id'
  ) then
    raise exception 'creator_assets.brief_id was not added; the brief would have nothing to attach to';
  end if;

  -- And it must stay nullable: every asset that exists today has no brief.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_assets'
      and column_name = 'brief_id' and is_nullable = 'NO'
  ) then
    raise exception 'creator_assets.brief_id is NOT NULL; every asset created before this migration has no brief and would be unreadable';
  end if;
end $$;

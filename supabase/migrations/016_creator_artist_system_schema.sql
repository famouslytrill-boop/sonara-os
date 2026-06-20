create extension if not exists pgcrypto;

-- =========================================================
-- Creator Studio Artist System
-- Integrates the Tasha Keys creative operating method into Creator Studio as a reusable artist system.
-- This stores persona, sonic identity, album cycles, tracks, prompt rules, DAW/AI jobs, video treatments,
-- release plans, and quality checks. It must not store copyrighted lyrics copied from outside songs.
-- =========================================================

create table if not exists public.creator_artist_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  artist_name text not null,
  artist_key text not null,
  public_description text,
  private_backstory jsonb not null default '{}'::jsonb,
  voice_identity jsonb not null default '{}'::jsonb,
  genre_blend jsonb not null default '{}'::jsonb,
  writing_rules jsonb not null default '{}'::jsonb,
  visual_rules jsonb not null default '{}'::jsonb,
  prompt_rules jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, artist_key)
);

create table if not exists public.creator_sonic_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  name text not null,
  profile_key text not null,
  bpm_range text,
  keys_allowed text[],
  drum_language text,
  harmonic_identity text,
  vocal_mode text,
  texture_notes text,
  mix_notes text,
  mastering_notes text,
  avoid_notes text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(artist_profile_id, profile_key)
);

create table if not exists public.creator_album_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  title text not null,
  slug text not null,
  project_type text not null default 'album' check (project_type in ('single','ep','album','deluxe','mixtape','video_project','campaign','other')),
  concept_summary text,
  visual_direction text,
  release_status text not null default 'planning' check (release_status in ('planning','writing','production','mixing','mastering','release_ready','released','archived')),
  target_release_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(artist_profile_id, slug)
);

create table if not exists public.creator_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  album_cycle_id uuid references public.creator_album_cycles(id) on delete set null,
  music_project_id uuid references public.music_projects(id) on delete set null,
  title text not null,
  track_number integer,
  song_status text not null default 'draft' check (song_status in ('draft','writing','production','recorded','mixing','mastering','release_ready','released','archived')),
  unique_key text,
  rhythmic_feel text,
  harmonic_identity text,
  drum_language text,
  vocal_mode text,
  structure_notes text,
  clean_version_required boolean default false,
  explicit_version_allowed boolean default true,
  lyrics_originality_status text not null default 'original_required' check (lyrics_originality_status in ('original_required','cleared','public_domain','blocked_review')),
  lyrics_box text,
  production_notes text,
  suno_prompt text,
  prompt_length integer generated always as (char_length(coalesce(suno_prompt, ''))) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_prompt_blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  blueprint_key text not null,
  name text not null,
  purpose text,
  required_fields text[] not null default array['unique_key','rhythmic_feel','harmonic_identity','drum_language','vocal_mode'],
  max_characters integer not null default 1000,
  prompt_template text not null,
  negative_prompt_rules text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(artist_profile_id, blueprint_key)
);

create table if not exists public.creator_quality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  track_id uuid references public.creator_tracks(id) on delete cascade,
  check_type text not null check (check_type in ('prompt_rule','lyrics_originality','sonic_identity','mix_quality','release_readiness','video_sync','rights_review','other')),
  status text not null default 'pending' check (status in ('pending','passed','failed','needs_review','waived')),
  score numeric(5,2),
  notes text,
  checked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_video_treatments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  track_id uuid references public.creator_tracks(id) on delete set null,
  title text not null,
  duration_seconds integer,
  platform_target text not null default 'social' check (platform_target in ('social','youtube','shorts','reels','tiktok','music_video','commercial','other')),
  concept text,
  scene_plan jsonb not null default '[]'::jsonb,
  shot_rules jsonb not null default '{}'::jsonb,
  sync_notes text,
  status text not null default 'draft' check (status in ('draft','storyboard','production','edit','ready','released','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_release_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_profile_id uuid references public.creator_artist_profiles(id) on delete cascade,
  album_cycle_id uuid references public.creator_album_cycles(id) on delete set null,
  track_id uuid references public.creator_tracks(id) on delete set null,
  title text not null,
  task_type text not null default 'release' check (task_type in ('writing','production','mix','master','artwork','video','metadata','rights','distribution','marketing','release','other')),
  status text not null default 'todo' check (status in ('todo','doing','done','blocked','archived')),
  due_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists creator_artist_profiles_org_idx on public.creator_artist_profiles(organization_id);
create index if not exists creator_tracks_artist_idx on public.creator_tracks(artist_profile_id, song_status);
create index if not exists creator_album_cycles_artist_idx on public.creator_album_cycles(artist_profile_id, release_status);
create index if not exists creator_quality_checks_track_idx on public.creator_quality_checks(track_id, status);
create index if not exists creator_release_tasks_artist_idx on public.creator_release_tasks(artist_profile_id, status);

-- RLS
alter table public.creator_artist_profiles enable row level security;
alter table public.creator_sonic_profiles enable row level security;
alter table public.creator_album_cycles enable row level security;
alter table public.creator_tracks enable row level security;
alter table public.creator_prompt_blueprints enable row level security;
alter table public.creator_quality_checks enable row level security;
alter table public.creator_video_treatments enable row level security;
alter table public.creator_release_tasks enable row level security;

-- Server-side service role manages artist system records. Browser access must go through Express permission checks.
do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_artist_profiles','creator_sonic_profiles','creator_album_cycles','creator_tracks','creator_prompt_blueprints','creator_quality_checks','creator_video_treatments','creator_release_tasks'
  ] loop
    execute format('drop policy if exists "service role manages %s" on public.%I', t, t);
    execute format('create policy "service role manages %s" on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t, t);
  end loop;
end $$;

-- Seed a reusable Tasha Keys artist system template. Organization-specific rows are created by app routes.
insert into public.integration_providers (provider_key, name, category, connection_mode, capabilities, status)
values
('creator_artist_system','Creator Artist System','other','manual','{"artist_persona":true,"album_cycles":true,"tracks":true,"prompt_rules":true,"video_treatments":true,"quality_checks":true}'::jsonb,'active')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

create extension if not exists pgcrypto;

create table if not exists public.creator_artist_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  system_name text not null,
  artist_public_name text,
  project_role text not null default 'recording_artist',
  identity_summary text,
  creative_rules jsonb not null default '{}'::jsonb,
  privacy_mode text not null default 'private',
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  profile_name text not null,
  vocal_range text,
  vocal_texture text,
  cadence_notes text,
  delivery_modes jsonb not null default '[]'::jsonb,
  accent_or_regional_notes text,
  emotional_register text,
  avoid_list jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_influence_maps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  map_name text not null,
  genre_blend jsonb not null default '{}'::jsonb,
  era_references jsonb not null default '[]'::jsonb,
  sonic_references jsonb not null default '[]'::jsonb,
  writing_references jsonb not null default '[]'::jsonb,
  prohibited_references jsonb not null default '[]'::jsonb,
  no_artist_name_prompting boolean not null default true,
  notes text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_narrative_arcs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  arc_name text not null,
  origin_context text,
  conflict_engine text,
  transformation_path text,
  recurring_symbols jsonb not null default '[]'::jsonb,
  blocked_topics jsonb not null default '[]'::jsonb,
  safe_topics jsonb not null default '[]'::jsonb,
  emotional_rules jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_song_blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete set null,
  title text not null,
  working_title text,
  song_type text not null default 'single',
  key_signature text,
  bpm integer,
  rhythmic_feel text,
  harmonic_identity text,
  drum_language text,
  vocal_mode text,
  structure jsonb not null default '[]'::jsonb,
  theme text,
  hook_concept text,
  section_direction jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_song_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  song_blueprint_id uuid references public.creator_song_blueprints(id) on delete cascade,
  section_name text not null,
  section_order integer default 0,
  section_text text not null,
  clean_version text,
  explicit_flag boolean default false,
  originality_notes text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_production_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  song_blueprint_id uuid references public.creator_song_blueprints(id) on delete cascade,
  note_type text not null default 'production',
  note_title text not null,
  note_body text not null,
  technical_settings jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_prompt_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  song_blueprint_id uuid references public.creator_song_blueprints(id) on delete set null,
  prompt_type text not null default 'music_generation',
  prompt_title text not null,
  prompt_body text not null,
  character_limit integer,
  required_fields jsonb not null default '[]'::jsonb,
  forbidden_terms jsonb not null default '[]'::jsonb,
  prompt_status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_release_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  package_name text not null,
  release_type text not null default 'single',
  release_title text not null,
  tracklist jsonb not null default '[]'::jsonb,
  visual_direction jsonb not null default '{}'::jsonb,
  marketing_angles jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'planning',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_quality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete set null,
  song_blueprint_id uuid references public.creator_song_blueprints(id) on delete set null,
  check_type text not null,
  check_status text not null default 'pending',
  findings jsonb not null default '{}'::jsonb,
  summary text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.creator_export_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  artist_system_id uuid references public.creator_artist_systems(id) on delete cascade,
  song_blueprint_id uuid references public.creator_song_blueprints(id) on delete set null,
  package_type text not null default 'song',
  package_name text not null,
  export_data jsonb not null default '{}'::jsonb,
  file_manifest jsonb not null default '[]'::jsonb,
  status text not null default 'ready',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists creator_artist_systems_org_idx on public.creator_artist_systems(organization_id);
create index if not exists creator_song_blueprints_system_idx on public.creator_song_blueprints(artist_system_id);
create index if not exists creator_prompt_packs_system_idx on public.creator_prompt_packs(artist_system_id);

alter table public.creator_artist_systems enable row level security;
alter table public.creator_voice_profiles enable row level security;
alter table public.creator_influence_maps enable row level security;
alter table public.creator_narrative_arcs enable row level security;
alter table public.creator_song_blueprints enable row level security;
alter table public.creator_song_sections enable row level security;
alter table public.creator_production_notes enable row level security;
alter table public.creator_prompt_packs enable row level security;
alter table public.creator_release_packages enable row level security;
alter table public.creator_quality_checks enable row level security;
alter table public.creator_export_packages enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_artist_systems','creator_voice_profiles','creator_influence_maps','creator_narrative_arcs','creator_song_blueprints','creator_song_sections','creator_production_notes','creator_prompt_packs','creator_release_packages','creator_quality_checks','creator_export_packages'
  ] loop
    execute format('drop policy if exists "service role manages %s" on public.%I', t, t);
    execute format('create policy "service role manages %s" on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t, t);
  end loop;
end $$;

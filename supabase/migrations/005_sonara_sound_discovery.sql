create table if not exists public.sonara_sound_sources (
  id text primary key,
  name text not null,
  url text,
  source_type text,
  commercial_use_risk text,
  redistribution_risk text,
  requires_api_key boolean default false,
  launch_status text default 'manual_review',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sonara_sound_assets (
  id text primary key,
  name text not null,
  asset_type text,
  genre_family text,
  bpm numeric,
  musical_key text,
  file_format text,
  source_id text,
  source_name text,
  source_url text,
  creator text,
  license text default 'unknown_blocked',
  license_url text,
  attribution_text text,
  redistribution_category text default 'unknown_blocked',
  commercial_use_allowed boolean default false,
  redistribution_allowed boolean default false,
  attribution_required boolean default false,
  export_status text default 'blocked',
  storage_path text,
  preview_url text,
  metadata jsonb default '{}'::jsonb,
  last_checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sonara_sound_assets add column if not exists name text;
alter table public.sonara_sound_assets add column if not exists asset_type text;
alter table public.sonara_sound_assets add column if not exists genre_family text;
alter table public.sonara_sound_assets add column if not exists bpm numeric;
alter table public.sonara_sound_assets add column if not exists musical_key text;
alter table public.sonara_sound_assets add column if not exists file_format text;
alter table public.sonara_sound_assets add column if not exists source_id text;
alter table public.sonara_sound_assets add column if not exists source_name text;
alter table public.sonara_sound_assets add column if not exists source_url text;
alter table public.sonara_sound_assets add column if not exists creator text;
alter table public.sonara_sound_assets add column if not exists license text default 'unknown_blocked';
alter table public.sonara_sound_assets add column if not exists license_url text;
alter table public.sonara_sound_assets add column if not exists attribution_text text;
alter table public.sonara_sound_assets add column if not exists redistribution_category text default 'unknown_blocked';
alter table public.sonara_sound_assets add column if not exists commercial_use_allowed boolean default false;
alter table public.sonara_sound_assets add column if not exists redistribution_allowed boolean default false;
alter table public.sonara_sound_assets add column if not exists attribution_required boolean default false;
alter table public.sonara_sound_assets add column if not exists export_status text default 'blocked';
alter table public.sonara_sound_assets add column if not exists storage_path text;
alter table public.sonara_sound_assets add column if not exists preview_url text;
alter table public.sonara_sound_assets add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.sonara_sound_assets add column if not exists last_checked_at timestamptz default now();
alter table public.sonara_sound_assets add column if not exists created_at timestamptz default now();
alter table public.sonara_sound_assets add column if not exists updated_at timestamptz default now();

create index if not exists sonara_sound_assets_license_idx on public.sonara_sound_assets (license);
create index if not exists sonara_sound_assets_redistribution_category_idx on public.sonara_sound_assets (redistribution_category);
create index if not exists sonara_sound_assets_export_status_idx on public.sonara_sound_assets (export_status);
create index if not exists sonara_sound_assets_genre_family_idx on public.sonara_sound_assets (genre_family);
create index if not exists sonara_sound_assets_asset_type_idx on public.sonara_sound_assets (asset_type);
create index if not exists sonara_sound_assets_bpm_idx on public.sonara_sound_assets (bpm);
create index if not exists sonara_sound_assets_musical_key_idx on public.sonara_sound_assets (musical_key);
create index if not exists sonara_sound_assets_source_id_idx on public.sonara_sound_assets (source_id);

alter table public.sonara_sound_sources enable row level security;
alter table public.sonara_sound_assets enable row level security;

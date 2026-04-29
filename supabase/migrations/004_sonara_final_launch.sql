create extension if not exists pgcrypto with schema extensions;

create table if not exists public.song_fingerprints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  fingerprint_id text not null,
  song_title text not null,
  creator_name text,
  identity text not null,
  mood text not null,
  audience_signal text not null,
  sonic_palette jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.release_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  song_fingerprint_id uuid references public.song_fingerprints(id) on delete cascade,
  readiness_score numeric not null,
  launch_state text not null check (launch_state in ('idea', 'demo', 'ready', 'hold')),
  blockers jsonb not null default '[]'::jsonb,
  next_checks jsonb not null default '[]'::jsonb,
  positioning text not null,
  hook text not null,
  rollout jsonb not null default '[]'::jsonb,
  export_assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.song_fingerprints enable row level security;
alter table public.release_plans enable row level security;

drop policy if exists "Users can manage their own song fingerprints" on public.song_fingerprints;
create policy "Users can manage their own song fingerprints"
  on public.song_fingerprints
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can manage their own release plans" on public.release_plans;
create policy "Users can manage their own release plans"
  on public.release_plans
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create table if not exists public.sonara_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  creator_name text,
  notes text not null,
  fingerprint_id text not null,
  readiness_score numeric not null,
  launch_state text not null check (launch_state in ('idea', 'demo', 'ready', 'hold')),
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sonara_projects_owner_updated_idx
  on public.sonara_projects (owner_id, updated_at desc);

alter table public.sonara_projects enable row level security;

drop policy if exists "Users can manage their own SONARA projects" on public.sonara_projects;
create policy "Users can manage their own SONARA projects"
  on public.sonara_projects
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create table if not exists public.sonara_billing_customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sonara_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  tier text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sonara_billing_customers enable row level security;
alter table public.sonara_subscriptions enable row level security;

drop policy if exists "Users can view their own billing customer" on public.sonara_billing_customers;
create policy "Users can view their own billing customer"
  on public.sonara_billing_customers
  for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can view their own subscriptions" on public.sonara_subscriptions;
create policy "Users can view their own subscriptions"
  on public.sonara_subscriptions
  for select
  using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('sonara-releases', 'sonara-releases', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own SONARA release objects" on storage.objects;
create policy "Users can read own SONARA release objects"
  on storage.objects
  for select
  using (
    bucket_id = 'sonara-releases'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload own SONARA release objects" on storage.objects;
create policy "Users can upload own SONARA release objects"
  on storage.objects
  for insert
  with check (
    bucket_id = 'sonara-releases'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own SONARA release objects" on storage.objects;
create policy "Users can update own SONARA release objects"
  on storage.objects
  for update
  using (
    bucket_id = 'sonara-releases'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'sonara-releases'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own SONARA release objects" on storage.objects;
create policy "Users can delete own SONARA release objects"
  on storage.objects
  for delete
  using (
    bucket_id = 'sonara-releases'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create table if not exists public.sonara_sound_sources (
  id text primary key,
  name text not null,
  homepage text not null,
  default_category text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sonara_sound_assets (
  id text primary key,
  source_id text references public.sonara_sound_sources(id) on delete set null,
  title text not null,
  license text not null,
  redistribution_category text not null,
  commercial_use_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  attribution_required boolean not null default false,
  source_url text not null,
  creator text not null,
  export_status text not null,
  proof_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.sonara_sound_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  source_count integer not null default 0,
  asset_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sonara_sound_assets_export_status_idx
  on public.sonara_sound_assets (export_status);

create index if not exists sonara_sound_assets_redistribution_category_idx
  on public.sonara_sound_assets (redistribution_category);

alter table public.sonara_sound_sources enable row level security;
alter table public.sonara_sound_assets enable row level security;
alter table public.sonara_sound_sync_runs enable row level security;

drop policy if exists "Public can read enabled SONARA sound sources" on public.sonara_sound_sources;
create policy "Public can read enabled SONARA sound sources"
  on public.sonara_sound_sources
  for select
  using (enabled = true);

drop policy if exists "Authenticated users can read SONARA sound assets" on public.sonara_sound_assets;
create policy "Authenticated users can read SONARA sound assets"
  on public.sonara_sound_assets
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read SONARA sound sync runs" on public.sonara_sound_sync_runs;
create policy "Authenticated users can read SONARA sound sync runs"
  on public.sonara_sound_sync_runs
  for select
  using (auth.role() = 'authenticated');

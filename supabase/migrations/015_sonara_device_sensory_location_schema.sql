create extension if not exists pgcrypto;

-- =========================================================
-- SONARA Device Sensory + Location Infrastructure
-- Adds sound cues, vibration/haptic patterns, tactile events, motion/orientation capture,
-- GPS/geofence records, and privacy-safe consent tracking.
-- Browser support varies; source code must feature-detect and request user permission.
-- =========================================================

create table if not exists public.device_capability_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_label text,
  user_agent_hash text,
  platform text,
  supports_audio boolean default false,
  supports_vibration boolean default false,
  supports_geolocation boolean default false,
  supports_device_motion boolean default false,
  supports_device_orientation boolean default false,
  supports_haptics boolean default false,
  permission_state jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_device_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  permission_key text not null check (permission_key in ('sound','vibration','geolocation','motion','orientation','haptics')),
  permission_status text not null default 'unknown' check (permission_status in ('unknown','prompt','granted','denied','unsupported','revoked')),
  purpose text,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, user_id, permission_key)
);

create table if not exists public.sensory_feedback_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  profile_key text not null,
  description text,
  sound_enabled boolean default true,
  vibration_enabled boolean default true,
  motion_enabled boolean default false,
  location_enabled boolean default false,
  accessibility_mode text not null default 'standard' check (accessibility_mode in ('standard','reduced_motion','silent','high_contrast','custom')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, profile_key)
);

create table if not exists public.sound_cues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  feedback_profile_id uuid references public.sensory_feedback_profiles(id) on delete set null,
  cue_key text not null,
  name text not null,
  event_name text not null,
  sound_type text not null default 'tone' check (sound_type in ('tone','sample','notification','alert','success','error','custom')),
  frequency_hz numeric(10,2),
  duration_ms integer default 120,
  volume numeric(5,2) default 0.25,
  asset_url text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, cue_key)
);

create table if not exists public.haptic_patterns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  feedback_profile_id uuid references public.sensory_feedback_profiles(id) on delete set null,
  pattern_key text not null,
  name text not null,
  event_name text not null,
  vibration_pattern_ms integer[] not null default array[40],
  intensity numeric(5,2),
  fallback_sound_cue_id uuid references public.sound_cues(id) on delete set null,
  accessibility_notes text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, pattern_key)
);

create table if not exists public.tactile_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_context text,
  haptic_pattern_id uuid references public.haptic_patterns(id) on delete set null,
  sound_cue_id uuid references public.sound_cues(id) on delete set null,
  device_capability_profile_id uuid references public.device_capability_profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','played','skipped','unsupported','failed')),
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.motion_sensor_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  device_capability_profile_id uuid references public.device_capability_profiles(id) on delete set null,
  source text not null default 'browser' check (source in ('browser','native_app','import','manual')),
  event_type text not null check (event_type in ('device_motion','device_orientation','gesture','tilt','shake','rotation','other')),
  alpha numeric(12,6),
  beta numeric(12,6),
  gamma numeric(12,6),
  acceleration_x numeric(12,6),
  acceleration_y numeric(12,6),
  acceleration_z numeric(12,6),
  rotation_alpha numeric(12,6),
  rotation_beta numeric(12,6),
  rotation_gamma numeric(12,6),
  gesture_label text,
  captured_at timestamptz default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.location_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  zone_type text not null default 'business' check (zone_type in ('business','job_site','delivery_area','event','restricted','custom')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  radius_meters integer default 100,
  polygon_geojson jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.location_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  employee_id uuid references public.business_employee_profiles(id) on delete set null,
  location_zone_id uuid references public.location_zones(id) on delete set null,
  event_type text not null check (event_type in ('check_in','check_out','zone_enter','zone_exit','position_update','delivery_stop','job_site_arrival','job_site_departure','manual')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy_meters numeric(10,2),
  altitude_meters numeric(10,2),
  speed_mps numeric(10,3),
  heading_degrees numeric(10,3),
  captured_at timestamptz default now(),
  privacy_mode text not null default 'precise' check (privacy_mode in ('precise','approximate','masked','manual')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.route_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete set null,
  vehicle_id uuid references public.vehicle_records(id) on delete set null,
  started_by uuid references auth.users(id) on delete set null,
  session_type text not null default 'delivery' check (session_type in ('delivery','service_route','food_truck_route','job_site','inspection','other')),
  status text not null default 'active' check (status in ('active','paused','completed','cancelled','archived')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  distance_meters numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.route_tracking_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  route_session_id uuid references public.route_tracking_sessions(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_meters numeric(10,2),
  speed_mps numeric(10,3),
  heading_degrees numeric(10,3),
  captured_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Indexes
create index if not exists device_capability_profiles_org_user_idx on public.device_capability_profiles(organization_id, user_id);
create index if not exists user_device_permissions_org_user_idx on public.user_device_permissions(organization_id, user_id);
create index if not exists sensory_feedback_profiles_org_idx on public.sensory_feedback_profiles(organization_id);
create index if not exists tactile_events_org_created_idx on public.tactile_events(organization_id, created_at desc);
create index if not exists motion_sensor_events_org_created_idx on public.motion_sensor_events(organization_id, created_at desc);
create index if not exists location_events_org_created_idx on public.location_events(organization_id, created_at desc);
create index if not exists route_tracking_sessions_org_status_idx on public.route_tracking_sessions(organization_id, status);

-- RLS
alter table public.device_capability_profiles enable row level security;
alter table public.user_device_permissions enable row level security;
alter table public.sensory_feedback_profiles enable row level security;
alter table public.sound_cues enable row level security;
alter table public.haptic_patterns enable row level security;
alter table public.tactile_events enable row level security;
alter table public.motion_sensor_events enable row level security;
alter table public.location_zones enable row level security;
alter table public.location_events enable row level security;
alter table public.route_tracking_sessions enable row level security;
alter table public.route_tracking_points enable row level security;

-- Server-side service role controls sensitive device, motion, and location records.
do $$
declare
  t text;
begin
  foreach t in array array[
    'device_capability_profiles','user_device_permissions','sensory_feedback_profiles','sound_cues','haptic_patterns','tactile_events','motion_sensor_events','location_zones','location_events','route_tracking_sessions','route_tracking_points'
  ] loop
    execute format('drop policy if exists "service role manages %s" on public.%I', t, t);
    execute format('create policy "service role manages %s" on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t, t);
  end loop;
end $$;

-- Seed default sensory profiles and cues for premium app feedback.
insert into public.integration_providers (provider_key, name, category, connection_mode, capabilities, status)
values
('browser_geolocation','Browser Geolocation','other','api','{"gps":true,"permission_required":true,"secure_context_required":true}'::jsonb,'active'),
('browser_vibration','Browser Vibration','other','api','{"vibration":true,"feature_detection_required":true,"limited_browser_support":true}'::jsonb,'active'),
('browser_device_orientation','Browser Device Orientation','other','api','{"gyroscope":true,"accelerometer":true,"permission_required_on_some_devices":true}'::jsonb,'active'),
('browser_web_audio','Browser Web Audio','ai_audio','api','{"sound_cues":true,"audio_context":true,"user_activation_required":true}'::jsonb,'active')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

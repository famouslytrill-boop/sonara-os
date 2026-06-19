create extension if not exists pgcrypto;

-- =========================================================
-- SONARA Operations Layer
-- Business Builder employee/business operations + Creator Studio music/DAW/AI integration infrastructure.
-- This migration is intentionally schema-first. UI/API routes must still enforce owner/admin/employee access in server code.
-- =========================================================

-- ---------- Business locations and service catalog ----------

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  location_type text not null default 'storefront' check (location_type in ('storefront','mobile','food_truck','vehicle','home_service','event','online','other')),
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text default 'US',
  phone text,
  email text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_service_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  category text,
  description text,
  price_cents integer default 0,
  currency text default 'usd',
  duration_minutes integer,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  service_id uuid references public.business_service_catalog(id) on delete set null,
  customer_id uuid references public.customer_records(id) on delete set null,
  assigned_employee_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled','no_show','archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Employee portal and workforce operations ----------

create table if not exists public.business_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  employee_number text,
  display_name text not null,
  email text,
  phone text,
  job_title text,
  employment_type text not null default 'employee' check (employment_type in ('employee','contractor','seasonal','temporary','owner')),
  status text not null default 'active' check (status in ('active','invited','disabled','terminated','archived')),
  hire_date date,
  emergency_contact jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, employee_number)
);

create table if not exists public.employee_wage_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete cascade,
  rate_type text not null default 'hourly' check (rate_type in ('hourly','salary','commission','stipend','other')),
  amount_cents integer not null default 0,
  currency text default 'usd',
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now()
);

create table if not exists public.employee_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  role_label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','missed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes integer default 0,
  entry_source text not null default 'employee_portal' check (entry_source in ('employee_portal','owner_adjustment','import','api')),
  status text not null default 'open' check (status in ('open','submitted','approved','rejected','paid','void')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_pay_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.business_employee_profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  regular_hours numeric(10,2) default 0,
  overtime_hours numeric(10,2) default 0,
  gross_pay_cents integer default 0,
  deductions_cents integer default 0,
  net_pay_cents integer default 0,
  currency text default 'usd',
  status text not null default 'draft' check (status in ('draft','approved','paid','void')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  message text not null,
  audience text not null default 'all' check (audience in ('all','location','role','individual')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  assigned_employee_id uuid references public.business_employee_profiles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'todo' check (status in ('todo','doing','done','blocked','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_job_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  title text not null,
  description text,
  pay_range text,
  employment_type text,
  status text not null default 'draft' check (status in ('draft','published','paused','filled','archived')),
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Assets, vehicles, trailers, inventory ----------

create table if not exists public.business_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  asset_type text not null default 'equipment' check (asset_type in ('equipment','vehicle','trailer','appliance','tool','device','furniture','other')),
  serial_number text,
  purchase_date date,
  purchase_cost_cents integer,
  status text not null default 'active' check (status in ('active','maintenance','retired','lost','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.vehicle_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  asset_id uuid references public.business_assets(id) on delete set null,
  vehicle_type text not null default 'vehicle' check (vehicle_type in ('vehicle','trailer','food_truck','cart','other')),
  make text,
  model text,
  year integer,
  plate_number text,
  vin text,
  insurance_policy text,
  registration_expires_at date,
  status text not null default 'active' check (status in ('active','maintenance','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicle_records(id) on delete cascade,
  inspected_by uuid references public.business_employee_profiles(id) on delete set null,
  inspected_at timestamptz default now(),
  odometer_value integer,
  status text not null default 'passed' check (status in ('passed','failed','needs_attention')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  asset_id uuid references public.business_assets(id) on delete set null,
  vehicle_id uuid references public.vehicle_records(id) on delete set null,
  service_type text,
  description text,
  vendor text,
  cost_cents integer default 0,
  currency text default 'usd',
  serviced_at date,
  next_due_at date,
  status text not null default 'completed' check (status in ('planned','completed','cancelled','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  sku text,
  category text,
  quantity numeric(12,2) default 0,
  unit text default 'each',
  reorder_level numeric(12,2),
  cost_cents integer,
  price_cents integer,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('stock_in','stock_out','adjustment','waste','transfer')),
  quantity numeric(12,2) not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- External integrations and AI/music job tracking ----------

create table if not exists public.integration_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text unique not null,
  name text not null,
  category text not null check (category in ('payments','email','storage','analytics','ai_music','ai_audio','ai_visual','daw','calendar','payroll','other')),
  connection_mode text not null default 'manual' check (connection_mode in ('api','oauth','manual','webhook','export')),
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','manual_review')),
  created_at timestamptz default now()
);

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_key text references public.integration_providers(provider_key) on delete restrict,
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected','connected','setup_required','error','disabled')),
  display_name text,
  auth_reference text,
  settings jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, provider_key)
);

create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  provider_key text references public.integration_providers(provider_key) on delete restrict,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','manual_required')),
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  artist_name text,
  project_type text not null default 'song' check (project_type in ('song','album','ep','score','sound_design','sample_pack','podcast','commercial','other')),
  bpm integer,
  musical_key text,
  status text not null default 'draft' check (status in ('draft','writing','production','mixing','mastering','released','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.daw_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  daw_name text not null,
  session_name text,
  tempo_bpm integer,
  sample_rate integer,
  bit_depth integer,
  file_reference text,
  status text not null default 'active' check (status in ('active','exported','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete set null,
  daw_session_id uuid references public.daw_sessions(id) on delete set null,
  title text not null,
  asset_type text not null default 'audio' check (asset_type in ('audio','stem','midi','preset','lyrics','cover_art','reference','other')),
  storage_path text,
  external_url text,
  duration_seconds numeric(12,3),
  bpm integer,
  musical_key text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','approved','rejected','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sound_analysis_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  audio_asset_id uuid references public.audio_assets(id) on delete cascade,
  analyzer_key text not null,
  results jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz default now()
);

create table if not exists public.vibration_animation_cues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  cue_type text not null default 'animation' check (cue_type in ('animation','haptic','lighting','visual','transition','camera','other')),
  starts_at_seconds numeric(12,3) not null default 0,
  ends_at_seconds numeric(12,3),
  label text not null,
  intensity numeric(5,2),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Indexes ----------

create index if not exists business_locations_org_idx on public.business_locations(organization_id);
create index if not exists employee_profiles_org_idx on public.business_employee_profiles(organization_id);
create index if not exists employee_time_entries_employee_idx on public.employee_time_entries(employee_id, clock_in_at);
create index if not exists employee_schedules_employee_idx on public.employee_schedules(employee_id, starts_at);
create index if not exists business_assets_org_idx on public.business_assets(organization_id);
create index if not exists inventory_items_org_idx on public.inventory_items(organization_id);
create index if not exists integration_jobs_org_idx on public.integration_jobs(organization_id, status);
create index if not exists music_projects_org_idx on public.music_projects(organization_id);
create index if not exists audio_assets_project_idx on public.audio_assets(music_project_id);

-- ---------- RLS ----------

alter table public.business_locations enable row level security;
alter table public.business_service_catalog enable row level security;
alter table public.business_bookings enable row level security;
alter table public.business_employee_profiles enable row level security;
alter table public.employee_wage_rates enable row level security;
alter table public.employee_schedules enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.employee_pay_statements enable row level security;
alter table public.employee_announcements enable row level security;
alter table public.employee_tasks enable row level security;
alter table public.employee_job_posts enable row level security;
alter table public.business_assets enable row level security;
alter table public.vehicle_records enable row level security;
alter table public.vehicle_inspections enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.integration_providers enable row level security;
alter table public.organization_integrations enable row level security;
alter table public.integration_jobs enable row level security;
alter table public.music_projects enable row level security;
alter table public.daw_sessions enable row level security;
alter table public.audio_assets enable row level security;
alter table public.sound_analysis_results enable row level security;
alter table public.vibration_animation_cues enable row level security;

-- Public read for active provider catalog only. Actual organization connections stay server-controlled.
drop policy if exists "public read active integration providers" on public.integration_providers;
create policy "public read active integration providers" on public.integration_providers for select using (status = 'active');

-- Service-role policies keep the browser out of sensitive payroll, employee, and integration records.
do $$
declare
  t text;
begin
  foreach t in array array[
    'business_locations','business_service_catalog','business_bookings','business_employee_profiles','employee_wage_rates','employee_schedules','employee_time_entries','employee_pay_statements','employee_announcements','employee_tasks','employee_job_posts','business_assets','vehicle_records','vehicle_inspections','maintenance_logs','inventory_items','inventory_movements','organization_integrations','integration_jobs','music_projects','daw_sessions','audio_assets','sound_analysis_results','vibration_animation_cues'
  ] loop
    execute format('drop policy if exists "service role manages %s" on public.%I', t, t);
    execute format('create policy "service role manages %s" on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t, t);
  end loop;
end $$;

-- ---------- Seed provider catalog. API connection availability must be confirmed per provider account/terms. ----------

insert into public.integration_providers (provider_key, name, category, connection_mode, capabilities, status)
values
('stripe','Stripe','payments','api','{"checkout":true,"customer_portal":true,"webhooks":true}'::jsonb,'active'),
('resend','Resend','email','api','{"transactional_email":true,"domain_verification":true,"webhooks":true}'::jsonb,'active'),
('supabase','Supabase','storage','api','{"database":true,"auth":true,"storage":true,"realtime":true}'::jsonb,'active'),
('stable_audio','Stable Audio / Stability AI','ai_audio','api','{"text_to_audio":true,"sound_design":true,"commercial_terms_required":true}'::jsonb,'active'),
('suno','Suno','ai_music','manual','{"music_generation":true,"manual_export":true,"license_review_required":true}'::jsonb,'manual_review'),
('udio','Udio','ai_music','manual','{"music_generation":true,"manual_export":true,"license_review_required":true}'::jsonb,'manual_review'),
('elevenlabs','ElevenLabs','ai_audio','api','{"voice":true,"sound_effects":true,"music_availability_may_vary":true,"license_review_required":true}'::jsonb,'active'),
('fl_studio','FL Studio','daw','export','{"daw_session_tracking":true,"stem_export_tracking":true}'::jsonb,'active'),
('logic_pro','Logic Pro','daw','export','{"daw_session_tracking":true,"stem_export_tracking":true}'::jsonb,'active'),
('ableton_live','Ableton Live','daw','export','{"daw_session_tracking":true,"stem_export_tracking":true}'::jsonb,'active'),
('pro_tools','Pro Tools','daw','export','{"daw_session_tracking":true,"stem_export_tracking":true}'::jsonb,'active')
on conflict (provider_key) do update set
  name = excluded.name,
  category = excluded.category,
  connection_mode = excluded.connection_mode,
  capabilities = excluded.capabilities,
  status = excluded.status;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sonara_is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
  );
$$;

create or replace function public.sonara_has_org_role(org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and m.role = any(allowed_roles)
  );
$$;

-- General-public wording and setup metadata for business verticals.
create table if not exists public.business_vertical_templates (
  id uuid primary key default gen_random_uuid(),
  vertical_key text unique not null,
  label text not null,
  plain_language_description text not null,
  recommended_pages jsonb not null default '[]'::jsonb,
  recommended_apps jsonb not null default '[]'::jsonb,
  recommended_modules jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Physical business locations: salon chair shop, restaurant, food truck stop, ice cream stand, office, pop-up, etc.
create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  location_type text not null default 'storefront' check (location_type in ('storefront','mobile','truck','trailer','stand','kiosk','office','home_based','online','event','other')),
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text default 'US',
  phone text,
  public_notes text,
  operating_hours jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Services/products that real customers can buy or request.
create table if not exists public.business_service_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  item_type text not null default 'service' check (item_type in ('service','menu_item','product','package','rental','consultation','custom')),
  description text,
  price_cents integer default 0,
  currency text default 'usd',
  duration_minutes integer,
  inventory_tracked boolean default false,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  sku text,
  category text,
  quantity numeric default 0,
  unit text default 'each',
  reorder_point numeric,
  cost_cents integer,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Vehicles, trailers, food trucks, gear, chairs, freezers, ovens, audio equipment, etc.
create table if not exists public.business_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  asset_type text not null default 'equipment' check (asset_type in ('vehicle','trailer','food_truck','equipment','station','chair','freezer','oven','instrument','audio_gear','computer','other')),
  identifier text,
  status text not null default 'active' check (status in ('active','maintenance','retired','archived')),
  service_due_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Appointments/bookings for salons, consultations, catering, service businesses, etc.
create table if not exists public.business_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  location_id uuid references public.business_locations(id) on delete set null,
  customer_id uuid references public.customer_records(id) on delete set null,
  service_item_id uuid references public.business_service_items(id) on delete set null,
  employee_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('requested','scheduled','confirmed','completed','cancelled','no_show')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Employee and owner-controlled workforce system.
create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  manager_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  job_title text,
  employment_type text not null default 'employee' check (employment_type in ('employee','contractor','seasonal','temporary','intern')),
  access_status text not null default 'invited' check (access_status in ('invited','active','disabled','archived')),
  emergency_contact jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists employee_profiles_org_idx on public.employee_profiles(organization_id);
create index if not exists employee_profiles_user_idx on public.employee_profiles(user_id);

create table if not exists public.employee_wage_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.employee_profiles(id) on delete cascade,
  pay_type text not null default 'hourly' check (pay_type in ('hourly','salary','piece_rate','commission','tip_pool','custom')),
  rate_cents integer not null default 0,
  currency text default 'usd',
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  employee_id uuid references public.employee_profiles(id) on delete cascade,
  role_label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','worked','missed','cancelled','changed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  employee_id uuid references public.employee_profiles(id) on delete cascade,
  shift_id uuid references public.employee_shifts(id) on delete set null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_minutes integer default 0,
  total_minutes integer generated always as (
    case
      when clock_out_at is null then null
      else greatest(0, floor(extract(epoch from (clock_out_at - clock_in_at)) / 60)::integer - coalesce(break_minutes, 0))
    end
  ) stored,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','corrected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employee_pay_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date,
  status text not null default 'open' check (status in ('open','review','approved','paid','archived')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, period_start, period_end)
);

create table if not exists public.employee_pay_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_id uuid references public.employee_profiles(id) on delete cascade,
  pay_period_id uuid references public.employee_pay_periods(id) on delete cascade,
  gross_pay_cents integer default 0,
  net_pay_cents integer default 0,
  currency text default 'usd',
  hours_worked numeric default 0,
  deductions jsonb not null default '[]'::jsonb,
  additions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','paid','void')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, pay_period_id)
);

create table if not exists public.employee_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  audience text not null default 'all_staff' check (audience in ('all_staff','managers','location','individual','custom')),
  location_id uuid references public.business_locations(id) on delete set null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Creator Studio audio, DAW export, AI music workflow, sound/animation/vibration layer.
create table if not exists public.music_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  project_type text not null default 'song' check (project_type in ('song','album','ep','beat','sound_pack','score','podcast','commercial','custom')),
  key_signature text,
  bpm numeric,
  mood text,
  status text not null default 'draft' check (status in ('draft','writing','producing','mixing','mastering','released','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  title text not null,
  track_number integer,
  duration_seconds integer,
  status text not null default 'draft' check (status in ('draft','demo','final','released','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_stems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  music_track_id uuid references public.music_tracks(id) on delete cascade,
  stem_type text not null default 'other' check (stem_type in ('vocal','drums','bass','instrument','synth','guitar','piano','strings','fx','reference','mix','master','other')),
  file_url text,
  file_name text,
  format text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.daw_export_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  daw_name text not null check (daw_name in ('fl_studio','ableton_live','logic_pro','pro_tools','studio_one','reaper','garageband','cubase','other')),
  export_format text not null default 'wav_zip' check (export_format in ('wav_zip','stems_zip','midi','json_notes','csv_cue_sheet','project_notes','other')),
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text unique not null,
  display_name text not null,
  category text not null default 'music_generation' check (category in ('music_generation','voice','stem_separation','mastering','sound_design','lyrics','video','distribution','other')),
  website_url text,
  integration_mode text not null default 'manual_link' check (integration_mode in ('manual_link','api_available','export_only','disabled')),
  public_description text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete set null,
  provider_id uuid references public.music_ai_providers(id) on delete set null,
  job_type text not null default 'prompt' check (job_type in ('prompt','generate_music','generate_voice','separate_stems','master','sound_design','video','export_notes','other')),
  prompt text,
  source_url text,
  result_url text,
  status text not null default 'draft' check (status in ('draft','queued','sent','completed','failed','archived')),
  result_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.audio_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete set null,
  music_track_id uuid references public.music_tracks(id) on delete set null,
  analyzed_file_url text,
  analysis_type text not null default 'general' check (analysis_type in ('general','mix','master','loudness','frequency','tempo','key','structure','vocal','other')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.app_experience_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete cascade,
  sound_enabled boolean default false,
  haptics_enabled boolean default false,
  animation_level text not null default 'balanced' check (animation_level in ('off','reduced','balanced','expressive')),
  vibration_pattern jsonb not null default '[]'::jsonb,
  sonic_branding jsonb not null default '{}'::jsonb,
  motion_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(platform_id)
);

-- RLS
alter table public.business_vertical_templates enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_service_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.business_assets enable row level security;
alter table public.business_appointments enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.employee_wage_rates enable row level security;
alter table public.employee_shifts enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.employee_pay_periods enable row level security;
alter table public.employee_pay_statements enable row level security;
alter table public.employee_posts enable row level security;
alter table public.music_projects enable row level security;
alter table public.music_tracks enable row level security;
alter table public.music_stems enable row level security;
alter table public.daw_export_profiles enable row level security;
alter table public.music_ai_providers enable row level security;
alter table public.music_ai_jobs enable row level security;
alter table public.audio_analysis_reports enable row level security;
alter table public.app_experience_settings enable row level security;

-- Public read for active template/provider registries.
drop policy if exists "public read active business vertical templates" on public.business_vertical_templates;
create policy "public read active business vertical templates" on public.business_vertical_templates for select using (status = 'active');

drop policy if exists "public read active music ai providers" on public.music_ai_providers;
create policy "public read active music ai providers" on public.music_ai_providers for select using (status = 'active');

-- Service role manages all operational tables.
drop policy if exists "service role manages business vertical templates" on public.business_vertical_templates;
create policy "service role manages business vertical templates" on public.business_vertical_templates for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages business locations" on public.business_locations;
create policy "service role manages business locations" on public.business_locations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages business service items" on public.business_service_items;
create policy "service role manages business service items" on public.business_service_items for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages inventory" on public.inventory_items;
create policy "service role manages inventory" on public.inventory_items for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages business assets" on public.business_assets;
create policy "service role manages business assets" on public.business_assets for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages appointments" on public.business_appointments;
create policy "service role manages appointments" on public.business_appointments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages employees" on public.employee_profiles;
create policy "service role manages employees" on public.employee_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages wage rates" on public.employee_wage_rates;
create policy "service role manages wage rates" on public.employee_wage_rates for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages shifts" on public.employee_shifts;
create policy "service role manages shifts" on public.employee_shifts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages time entries" on public.employee_time_entries;
create policy "service role manages time entries" on public.employee_time_entries for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages pay periods" on public.employee_pay_periods;
create policy "service role manages pay periods" on public.employee_pay_periods for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages pay statements" on public.employee_pay_statements;
create policy "service role manages pay statements" on public.employee_pay_statements for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages employee posts" on public.employee_posts;
create policy "service role manages employee posts" on public.employee_posts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages music projects" on public.music_projects;
create policy "service role manages music projects" on public.music_projects for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages music tracks" on public.music_tracks;
create policy "service role manages music tracks" on public.music_tracks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages music stems" on public.music_stems;
create policy "service role manages music stems" on public.music_stems for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages daw exports" on public.daw_export_profiles;
create policy "service role manages daw exports" on public.daw_export_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages music ai providers" on public.music_ai_providers;
create policy "service role manages music ai providers" on public.music_ai_providers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages music ai jobs" on public.music_ai_jobs;
create policy "service role manages music ai jobs" on public.music_ai_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages audio analysis" on public.audio_analysis_reports;
create policy "service role manages audio analysis" on public.audio_analysis_reports for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages app experience" on public.app_experience_settings;
create policy "service role manages app experience" on public.app_experience_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Employee self-service read policies. Sensitive wage/pay details still require employee ownership or service-role/admin server access.
drop policy if exists "employees read own profile" on public.employee_profiles;
create policy "employees read own profile" on public.employee_profiles for select using (user_id = auth.uid());

drop policy if exists "employees read own shifts" on public.employee_shifts;
create policy "employees read own shifts" on public.employee_shifts for select using (employee_id in (select id from public.employee_profiles where user_id = auth.uid()));

drop policy if exists "employees read own time entries" on public.employee_time_entries;
create policy "employees read own time entries" on public.employee_time_entries for select using (employee_id in (select id from public.employee_profiles where user_id = auth.uid()));

drop policy if exists "employees read own pay statements" on public.employee_pay_statements;
create policy "employees read own pay statements" on public.employee_pay_statements for select using (employee_id in (select id from public.employee_profiles where user_id = auth.uid()));

drop policy if exists "employees read company posts" on public.employee_posts;
create policy "employees read company posts" on public.employee_posts for select using (
  organization_id in (select organization_id from public.employee_profiles where user_id = auth.uid() and access_status = 'active')
);

insert into public.business_vertical_templates (vertical_key, label, plain_language_description, recommended_pages, recommended_apps, recommended_modules, status)
values
('hair_salon','Hair Salon','Appointments, services, staff schedules, customer records, tips, products, and employee time tracking.','["Home","Services","Prices","Book Appointment","Contact"]'::jsonb,'["Appointments","Customers","Employees","Inventory","Payments"]'::jsonb,'["Service Menu","Staff Schedule","Time Clock","Customer Notes","Product Inventory"]'::jsonb,'active'),
('restaurant','Restaurant','Menu, orders, reservations, staff posts, inventory, payroll exports, and customer support.','["Home","Menu","Hours & Location","Order","Contact"]'::jsonb,'["Menu","Orders","Reservations","Employees","Inventory","Payments"]'::jsonb,'["Menu Items","Order Queue","Time Clock","Inventory Count","Staff Announcements"]'::jsonb,'active'),
('food_truck','Food Truck','Mobile locations, menu, vehicle/trailer assets, event schedule, orders, inventory, staff, and payments.','["Home","Menu","Where We Are","Catering","Contact"]'::jsonb,'["Locations","Menu","Orders","Vehicle/Trailer","Employees","Payments"]'::jsonb,'["Mobile Schedule","Menu Items","Truck Checklist","Time Clock","Inventory Count"]'::jsonb,'active'),
('ice_cream_stand','Ice Cream Stand','Menu, seasonal hours, inventory, staff shifts, location updates, simple orders, and customer messages.','["Home","Flavors","Hours","Location","Contact"]'::jsonb,'["Flavors","Inventory","Employees","Orders","Support"]'::jsonb,'["Flavor List","Inventory Count","Time Clock","Shift Posts","Customer Messages"]'::jsonb,'active'),
('general_service','General Service Business','Services, quotes, appointments, customer records, orders, support, employees, and billing readiness.','["Home","Services","Pricing","Request Quote","Contact"]'::jsonb,'["Quotes","Appointments","Customers","Employees","Payments","Support"]'::jsonb,'["Quote Form","Service List","Time Clock","Customer Records","Invoice Prep"]'::jsonb,'active')
on conflict (vertical_key) do update set label = excluded.label, plain_language_description = excluded.plain_language_description, recommended_pages = excluded.recommended_pages, recommended_apps = excluded.recommended_apps, recommended_modules = excluded.recommended_modules, status = excluded.status, updated_at = now();

insert into public.music_ai_providers (provider_key, display_name, category, website_url, integration_mode, public_description, status)
values
('suno','Suno','music_generation','https://suno.com','manual_link','Music generation workflow link and export tracker. API use must be configured only if available and permitted by provider terms.','active'),
('udio','Udio','music_generation','https://www.udio.com','manual_link','Music generation workflow link and export tracker. API use must be configured only if available and permitted by provider terms.','active'),
('elevenlabs','ElevenLabs','voice','https://elevenlabs.io','manual_link','Voice and audio workflow reference. Store prompts/results only with user permission and rights review.','active'),
('moises','Moises','stem_separation','https://moises.ai','manual_link','Stem separation and practice workflow reference. Store user-provided exports and notes.','active'),
('bandlab','BandLab','distribution','https://www.bandlab.com','manual_link','Collaboration and creation workflow reference.','active')
on conflict (provider_key) do update set display_name = excluded.display_name, category = excluded.category, website_url = excluded.website_url, integration_mode = excluded.integration_mode, public_description = excluded.public_description, status = excluded.status, updated_at = now();

-- updated_at triggers
drop trigger if exists business_vertical_templates_set_updated_at on public.business_vertical_templates;
create trigger business_vertical_templates_set_updated_at before update on public.business_vertical_templates for each row execute function public.set_updated_at();
drop trigger if exists business_locations_set_updated_at on public.business_locations;
create trigger business_locations_set_updated_at before update on public.business_locations for each row execute function public.set_updated_at();
drop trigger if exists business_service_items_set_updated_at on public.business_service_items;
create trigger business_service_items_set_updated_at before update on public.business_service_items for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();
drop trigger if exists business_assets_set_updated_at on public.business_assets;
create trigger business_assets_set_updated_at before update on public.business_assets for each row execute function public.set_updated_at();
drop trigger if exists business_appointments_set_updated_at on public.business_appointments;
create trigger business_appointments_set_updated_at before update on public.business_appointments for each row execute function public.set_updated_at();
drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;
create trigger employee_profiles_set_updated_at before update on public.employee_profiles for each row execute function public.set_updated_at();
drop trigger if exists employee_wage_rates_set_updated_at on public.employee_wage_rates;
create trigger employee_wage_rates_set_updated_at before update on public.employee_wage_rates for each row execute function public.set_updated_at();
drop trigger if exists employee_shifts_set_updated_at on public.employee_shifts;
create trigger employee_shifts_set_updated_at before update on public.employee_shifts for each row execute function public.set_updated_at();
drop trigger if exists employee_time_entries_set_updated_at on public.employee_time_entries;
create trigger employee_time_entries_set_updated_at before update on public.employee_time_entries for each row execute function public.set_updated_at();
drop trigger if exists employee_pay_periods_set_updated_at on public.employee_pay_periods;
create trigger employee_pay_periods_set_updated_at before update on public.employee_pay_periods for each row execute function public.set_updated_at();
drop trigger if exists employee_pay_statements_set_updated_at on public.employee_pay_statements;
create trigger employee_pay_statements_set_updated_at before update on public.employee_pay_statements for each row execute function public.set_updated_at();
drop trigger if exists employee_posts_set_updated_at on public.employee_posts;
create trigger employee_posts_set_updated_at before update on public.employee_posts for each row execute function public.set_updated_at();
drop trigger if exists music_projects_set_updated_at on public.music_projects;
create trigger music_projects_set_updated_at before update on public.music_projects for each row execute function public.set_updated_at();
drop trigger if exists music_tracks_set_updated_at on public.music_tracks;
create trigger music_tracks_set_updated_at before update on public.music_tracks for each row execute function public.set_updated_at();
drop trigger if exists music_stems_set_updated_at on public.music_stems;
create trigger music_stems_set_updated_at before update on public.music_stems for each row execute function public.set_updated_at();
drop trigger if exists daw_export_profiles_set_updated_at on public.daw_export_profiles;
create trigger daw_export_profiles_set_updated_at before update on public.daw_export_profiles for each row execute function public.set_updated_at();
drop trigger if exists music_ai_providers_set_updated_at on public.music_ai_providers;
create trigger music_ai_providers_set_updated_at before update on public.music_ai_providers for each row execute function public.set_updated_at();
drop trigger if exists music_ai_jobs_set_updated_at on public.music_ai_jobs;
create trigger music_ai_jobs_set_updated_at before update on public.music_ai_jobs for each row execute function public.set_updated_at();
drop trigger if exists app_experience_settings_set_updated_at on public.app_experience_settings;
create trigger app_experience_settings_set_updated_at before update on public.app_experience_settings for each row execute function public.set_updated_at();

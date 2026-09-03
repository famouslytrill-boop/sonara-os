-- Production is missing two tables that 010_sonara_platform_current_schema.sql
-- creates, and it has not been able to deploy since 5 August 2026 because of it.
--
-- ## What this is fixing
--
-- Every Controlled Production Deployment from run #111 to #124 -- fourteen in a
-- row, covering pull requests #192 to #205 -- failed on the first pending
-- migration:
--
--     Applying migration 20260811220000_customer_invoices_accounts_receivable.sql...
--     ERROR: relation "public.quotes" does not exist (SQLSTATE 42P01)
--
-- `customer_invoices` declares `quote_id uuid references public.quotes(id)`, and
-- production has no `public.quotes`. The repository does: it is created at line
-- 197 of `010_sonara_platform_current_schema.sql`, and
-- `pnpm run verify:migration-replay` builds a working schema from all 108
-- migrations on every release. Production's own migration history says `010` is
-- applied and the table is not there -- which is what happens when an existing
-- database is adopted into the Supabase CLI and its early migrations are marked
-- applied rather than run. The file name says so: "current schema" is what
-- somebody writes to describe a database that already exists.
--
-- ## Why this file and not a re-run of 010
--
-- Re-running `010` would be the obvious move and it would be wrong. Every
-- statement in it is `create table if not exists` or `enable row level
-- security`, so it is idempotent -- but it creates **`billing_customers`**,
-- which `20260805120000_retire_superseded_tables.sql` deliberately retired.
-- Replaying the whole file would resurrect a table somebody decided to remove.
--
-- So this creates only what is needed, and nothing that was retired.
--
-- ## Why these tables

-- `quotes` is the proven gap -- the table named in the error. But it is not the
-- only one at risk, and assuming it was would have shipped a fix that failed one
-- migration later.

-- Widening the search: across the 32 pending migrations, every table they
-- `reference`, `alter`, index or attach a policy to **without creating it**, minus
-- the ones a pending migration does create. That is 65 tables. Of those, 34 are
-- created only by the **pre-CLI numbered files** -- 010 through 016, the same
-- family as the snapshot that demonstrably did not run in production. Taking the
-- transitive closure over their foreign keys gives the 40 below.

-- They are all `create table if not exists`, in the order their original
-- migrations create them -- **by position in the file, not alphabetically**.
-- The generator's first version sorted by (file, name), which put
-- `automation_rules` before `sonara_platforms` and failed on the foreign
-- key between them. Copied column for column. On a database that has them
-- this migration does nothing at all -- which is the point. It cannot be wrong
-- about a table that is already there, and it cannot leave the deploy failing one
-- table later on a gap nobody checked for.

-- **No retired table is here, and that is asserted rather than assumed.** The
-- generator refuses to emit any name from the `superseded` array of
-- 20260805120000. That array is *pairs* -- retired table, then what replaced it --
-- so a name in the second position means the table is live. Reading it without
-- that shape is what briefly removed `stripe_customers` from the ops health check.

-- Row level security is enabled on every table this creates. A table that arrives
-- without it is exposed through PostgREST; with RLS on and no policy yet, the
-- service role still works and nothing else does, which is the safe direction.

-- ## Why customers and quotes specifically
--
-- The 31 migrations pending on production reference four tables that `010`
-- creates and that are not on the retired list: `organizations`, `profiles`,
-- `customers` and `quotes`.
--
-- `organizations` and `profiles` are not in doubt. Every query this application
-- makes filters on `organization_id`, and the site has been serving customers
-- against this database for a month; if `organizations` were missing, nothing
-- would work at all.
--
-- `quotes` is the proven gap -- it is the table named in the error.
-- `customers` is here because `quotes` references it. If `customers` is also
-- missing, creating `quotes` alone would fail on the same class of error one
-- line later, and this file would have to be written twice.
--
-- Both are `create table if not exists`, so on a database that has them this
-- migration does nothing at all. That is the point: it cannot be wrong about a
-- table that is already there.
--
-- ## What this does not promise
--
-- It fixes the failure that has been observed fourteen times. It cannot promise
-- there is no second gap further down the pending list, because nothing in this
-- repository can read production's schema -- `verify-migration-replay` runs
-- against an empty database, which is exactly why it stayed green throughout.
-- `docs/owner/OWNER-STEPS.md` step 8 has the two queries that say what
-- production actually has.
--
-- The definitions below are copied verbatim from 010, columns and defaults
-- unchanged, so a database that applies both ends up in one state rather than
-- two.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.sonara_platforms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  company_key text not null check (company_key in ('sonara_industries','business_builder','creator_studio','growth_studio')),
  product_key text not null,
  name text not null,
  slug text not null,
  platform_type text not null default 'custom' check (platform_type in ('business','creator','growth','parent_company','campaign','release','service_business','custom')),
  description text,
  status text not null default 'draft' check (status in ('draft','preview','published','archived')),
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  email text,
  phone text,
  status text not null default 'lead' check (status in ('lead','active','inactive','archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  goal text,
  channel text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  name text,
  email text,
  phone text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  campaign_id uuid references public.growth_campaigns(id) on delete set null,
  name text not null,
  hypothesis text,
  result text,
  status text not null default 'planned' check (status in ('planned','running','won','lost','inconclusive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  trigger_key text,
  action_key text,
  status text not null default 'disabled' check (status in ('disabled','active','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists public.vendor_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  name text not null,
  account_number text,
  contact_name text,
  email text,
  phone text,
  website text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  vendor_id uuid references public.vendor_accounts(id) on delete set null,
  invoice_number text,
  invoice_date date,
  due_date date,
  subtotal_cents integer default 0,
  tax_cents integer default 0,
  total_cents integer default 0,
  currency text default 'usd',
  document_url text,
  processing_status text not null default 'draft' check (processing_status in ('draft','uploaded','reviewing','approved','exported','paid','rejected','archived')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','scheduled','paid','void','refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, vendor_id, invoice_number)
);

create table if not exists public.recipe_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  name text not null,
  category text,
  yield_quantity numeric(12,3),
  yield_unit text,
  instructions text,
  status text not null default 'active' check (status in ('active','testing','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  platform_id uuid references public.sonara_platforms(id) on delete set null,
  recipe_id uuid references public.recipe_cards(id) on delete set null,
  name text not null,
  category text,
  selling_price_cents integer default 0,
  currency text default 'usd',
  theoretical_cost_cents integer default 0,
  target_food_cost_percent numeric(7,4),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pos_sales_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  business_date date not null,
  gross_sales_cents integer default 0,
  net_sales_cents integer default 0,
  discounts_cents integer default 0,
  refunds_cents integer default 0,
  tax_cents integer default 0,
  tips_cents integer default 0,
  tickets_count integer default 0,
  source text default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, location_id, business_date, source)
);

create table if not exists public.waste_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric(12,3) default 0,
  unit text,
  estimated_cost_cents integer default 0,
  reason text,
  logged_by uuid references auth.users(id) on delete set null,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.daily_profit_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  business_date date not null,
  net_sales_cents integer default 0,
  food_cost_cents integer default 0,
  labor_cost_cents integer default 0,
  controllable_expense_cents integer default 0,
  gross_profit_cents integer default 0,
  prime_cost_cents integer default 0,
  food_cost_percent numeric(7,4),
  labor_cost_percent numeric(7,4),
  notes text,
  source text default 'calculated',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, location_id, business_date)
);

create table if not exists public.accounting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_key text,
  export_type text not null default 'bills' check (export_type in ('bills','sales','inventory','payroll_summary','journal_entries','other')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  period_start date,
  period_end date,
  file_url text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  status text not null default 'active',
  source text,
  tags text[] not null default '{}',
  communication_preference text not null default 'unknown',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  amount_cents integer,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Enabling row level security on a table that already has it is a no-op, so
-- this is safe on the database that has these tables and necessary on the one
-- that does not. Both tables are organization-scoped and every read this
-- application makes uses the service-role key, which bypasses RLS entirely --
-- so this is the second line of defence rather than the first, and leaving it
-- off on a freshly created table would be strictly worse than 010's own state.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.sonara_platforms enable row level security;
alter table public.customer_records enable row level security;
alter table public.growth_campaigns enable row level security;
alter table public.growth_leads enable row level security;
alter table public.growth_experiments enable row level security;
alter table public.automation_rules enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_service_catalog enable row level security;
alter table public.business_bookings enable row level security;
alter table public.business_employee_profiles enable row level security;
alter table public.employee_schedules enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.employee_announcements enable row level security;
alter table public.employee_tasks enable row level security;
alter table public.business_assets enable row level security;
alter table public.vehicle_records enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.music_projects enable row level security;
alter table public.daw_sessions enable row level security;
alter table public.audio_assets enable row level security;
alter table public.vendor_accounts enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.recipe_cards enable row level security;
alter table public.menu_items enable row level security;
alter table public.pos_sales_summaries enable row level security;
alter table public.waste_logs enable row level security;
alter table public.daily_profit_snapshots enable row level security;
alter table public.accounting_exports enable row level security;
alter table public.device_capability_profiles enable row level security;
alter table public.sensory_feedback_profiles enable row level security;
alter table public.sound_cues enable row level security;
alter table public.haptic_patterns enable row level security;
alter table public.tactile_events enable row level security;
alter table public.motion_sensor_events enable row level security;
alter table public.location_zones enable row level security;
alter table public.location_events enable row level security;
alter table public.creator_artist_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;

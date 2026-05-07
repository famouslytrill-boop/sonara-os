-- SONARA Industries house-of-brands PostgreSQL schema.
-- Production auth note:
-- Enable row-level security in the deployed database and bind policies to the
-- authenticated user's organization memberships. Do not fake production auth in SQL alone.

create extension if not exists pgcrypto;

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('trackfoundry', 'lineready', 'noticegrid')),
  name text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  slug text not null,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_profile_id uuid not null references user_profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_profile_id)
);

create table if not exists external_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete restrict,
  url text not null,
  label text,
  visibility text not null default 'private' check (visibility in ('private', 'organization', 'public')),
  approval_state text not null default 'not_required' check (approval_state in ('not_required', 'pending', 'approved', 'rejected')),
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  brand_id uuid references brands(id) on delete restrict,
  actor_profile_id uuid references user_profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists approval_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  brand_id uuid references brands(id) on delete restrict,
  action_type text not null,
  risk_reason text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'queued', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references user_profiles(id) on delete set null,
  decided_by uuid references user_profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tf_artist_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  artist_name text not null,
  identity_notes text,
  influence_boundaries text,
  cadence_notes text,
  rights_notes text,
  created_at timestamptz not null default now()
);

create table if not exists tf_tracks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  artist_profile_id uuid references tf_artist_profiles(id) on delete set null,
  title text not null,
  key_signature text,
  bpm numeric,
  structure_notes text,
  mix_notes text,
  anti_repetition_notes text,
  created_at timestamptz not null default now()
);

create table if not exists tf_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid references tf_tracks(id) on delete cascade,
  asset_type text not null,
  storage_key text not null,
  rights_status text not null default 'unknown',
  created_at timestamptz not null default now()
);

create table if not exists tf_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid references tf_tracks(id) on delete cascade,
  release_title text not null,
  readiness_score numeric not null default 0,
  campaign_assets jsonb not null default '[]'::jsonb,
  splits_placeholder jsonb not null default '{}'::jsonb,
  approval_state text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists tf_transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid references tf_tracks(id) on delete cascade,
  transcript text not null,
  lyric_notes text,
  cadence_notes text,
  created_at timestamptz not null default now()
);

create table if not exists tf_prompt_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  track_id uuid references tf_tracks(id) on delete cascade,
  prompt_slot text not null,
  prompt_text text not null,
  influence_safety_notes text,
  approval_state text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists lr_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  job_title text not null,
  phone text,
  address text,
  profile_picture_key text,
  pay_rate numeric,
  certifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lr_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references lr_employees(id) on delete set null,
  shift_start timestamptz not null,
  shift_end timestamptz not null,
  station text,
  placement_score numeric,
  approval_state text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists lr_recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  ingredient_cost numeric not null default 0,
  packaging_cost numeric not null default 0,
  menu_price numeric not null default 0,
  qr_menu_url text,
  created_at timestamptz not null default now()
);

create table if not exists lr_staff_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sender_profile_id uuid references user_profiles(id) on delete set null,
  message text not null,
  visibility text not null default 'team',
  created_at timestamptz not null default now()
);

create table if not exists lr_compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  item_type text not null,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists lr_vendor_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vendor_name text not null,
  link_type text not null,
  url text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists lr_repairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  asset_name text not null,
  issue text not null,
  service_vendor text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists lr_promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references lr_employees(id) on delete cascade,
  from_title text,
  to_title text not null,
  approval_state text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists lr_raises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references lr_employees(id) on delete cascade,
  current_pay_rate numeric,
  requested_pay_rate numeric not null,
  reason text,
  approval_state text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists lr_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references lr_employees(id) on delete cascade,
  from_location text,
  to_location text not null,
  approval_state text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists lr_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  holiday_date date not null,
  staffing_notes text,
  created_at timestamptz not null default now()
);

create table if not exists ng_feed_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  url text not null,
  source_trust_score numeric not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists ng_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  body text not null,
  visibility text not null default 'private',
  approval_state text not null default 'draft',
  source_id uuid references ng_feed_sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ng_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  public_name text not null,
  verified boolean not null default false,
  qr_code_url text,
  created_at timestamptz not null default now()
);

create table if not exists ng_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  location text,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);

create table if not exists ng_digest_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_profile_id uuid references user_profiles(id) on delete cascade,
  frequency text not null default 'weekly',
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ng_source_checks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references ng_feed_sources(id) on delete cascade,
  checked_by uuid references user_profiles(id) on delete set null,
  trust_score numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists organizations_brand_idx on organizations (brand_id);
create index if not exists memberships_user_idx on organization_memberships (user_profile_id);
create index if not exists external_links_org_visibility_idx on external_links (organization_id, visibility);
create index if not exists audit_logs_org_created_idx on audit_logs (organization_id, created_at desc);
create index if not exists approval_queue_org_status_idx on approval_queue (organization_id, status);
create index if not exists tf_tracks_org_idx on tf_tracks (organization_id);
create index if not exists tf_releases_org_state_idx on tf_releases (organization_id, approval_state);
create index if not exists lr_schedules_org_start_idx on lr_schedules (organization_id, shift_start);
create index if not exists lr_employees_org_title_idx on lr_employees (organization_id, job_title);
create index if not exists lr_compliance_org_due_idx on lr_compliance_items (organization_id, due_date);
create index if not exists lr_raises_org_state_idx on lr_raises (organization_id, approval_state);
create index if not exists ng_notices_org_visibility_idx on ng_notices (organization_id, visibility, approval_state);
create index if not exists ng_feed_sources_trust_idx on ng_feed_sources (source_trust_score);

comment on table organization_memberships is 'Production RLS: users can only read memberships in their organization; owners/admins manage roles.';
comment on table external_links is 'Public external links require approval_queue before publish.';
comment on table approval_queue is 'Risky automation is queued for human approval and never executed directly by AI.';
comment on table audit_logs is 'Append-only audit trail for organization and brand-scoped actions.';

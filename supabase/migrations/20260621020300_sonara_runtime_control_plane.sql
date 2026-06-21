create extension if not exists pgcrypto;

create table if not exists public.sonara_write_api_registry (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  route_path text not null,
  method text not null default 'POST',
  target_table text not null,
  action_type text not null,
  access_level text not null default 'owner',
  status text not null default 'planned',
  produces_result text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(module_key, route_path, method)
);

create table if not exists public.sonara_permission_matrix (
  id uuid primary key default gen_random_uuid(),
  product_area text not null,
  module_key text not null,
  actor_role text not null,
  can_read boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  can_export boolean not null default false,
  can_admin boolean not null default false,
  status text not null default 'planned',
  created_at timestamptz default now(),
  unique(product_area, module_key, actor_role)
);

create table if not exists public.sonara_webhook_verification_registry (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  endpoint_path text not null,
  required_secret_env text not null,
  required_events jsonb not null default '[]'::jsonb,
  status text not null default 'setup_required',
  last_verified_at timestamptz,
  created_at timestamptz default now(),
  unique(provider_key, endpoint_path)
);

create table if not exists public.sonara_storage_bucket_registry (
  id uuid primary key default gen_random_uuid(),
  bucket_key text unique not null,
  product_area text not null,
  public_access boolean not null default false,
  allowed_file_types jsonb not null default '[]'::jsonb,
  max_size_mb integer,
  access_level text not null default 'owner',
  status text not null default 'setup_required',
  created_at timestamptz default now()
);

create table if not exists public.sonara_realtime_channel_registry (
  id uuid primary key default gen_random_uuid(),
  channel_key text unique not null,
  product_area text not null,
  topic_pattern text not null,
  private_required boolean not null default true,
  rls_required boolean not null default true,
  status text not null default 'planned',
  created_at timestamptz default now()
);

create table if not exists public.sonara_worker_job_registry (
  id uuid primary key default gen_random_uuid(),
  job_key text unique not null,
  product_area text not null,
  worker_type text not null,
  input_table text,
  output_table text,
  queue_name text,
  status text not null default 'planned',
  created_at timestamptz default now()
);

create table if not exists public.sonara_ui_capability_registry (
  id uuid primary key default gen_random_uuid(),
  capability_key text unique not null,
  label text not null,
  product_area text not null,
  capability_type text not null,
  permission_required boolean not null default false,
  progressive_enhancement boolean not null default true,
  status text not null default 'planned',
  created_at timestamptz default now()
);

create table if not exists public.sonara_control_plane_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text unique not null,
  label text not null,
  check_type text not null,
  target_key text not null,
  expected_result text not null,
  status text not null default 'planned',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- SONARA Industries v3 production MVP scaffold.
-- Run in Supabase SQL Editor or through the Supabase CLI after reviewing for your project.

create extension if not exists pgcrypto;

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  company_key text not null check (company_key in ('soundos','tableos','alertos','parent_admin')),
  industry text,
  city text,
  state text,
  country text default 'US',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','editor','viewer','billing_admin','security_admin')),
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

create table if not exists public.organization_app_access (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null check (company_key in ('soundos','tableos','alertos','parent_admin')),
  enabled boolean default true,
  created_at timestamptz default now(),
  unique (org_id, company_key)
);

create table if not exists public.app_scopes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  scope text not null check (scope in ('soundos.read','soundos.write','tableos.read','tableos.write','alertos.read','alertos.write','billing.manage','security.manage','admin.all')),
  created_at timestamptz default now(),
  unique (org_id, company_key, scope)
);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, target_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org_id and user_id = auth.uid() and role = target_role
  );
$$;

create or replace function public.has_company_access(target_org_id uuid, target_company_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_app_access
    where org_id = target_org_id and company_key = target_company_key and enabled = true
  ) and public.is_org_member(target_org_id);
$$;

create or replace function public.has_scope(target_org_id uuid, target_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.app_scopes scopes
    join public.organization_members members on members.org_id = scopes.org_id
    where scopes.org_id = target_org_id
      and scopes.scope = target_scope
      and members.user_id = auth.uid()
      and members.role in ('owner','admin','manager','editor','billing_admin','security_admin')
  );
$$;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  company_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  allowed boolean default true,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.approval_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  item_type text not null,
  item_id uuid,
  risk_level text default 'medium',
  status text default 'pending',
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.external_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  label text not null,
  link_type text not null,
  url text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.uploaded_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  bucket text not null,
  storage_path text not null,
  asset_type text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  status text default 'created',
  external_source text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  asset_id uuid references public.uploaded_assets(id) on delete cascade,
  queue_name text not null,
  job_type text not null,
  status text default 'queued',
  idempotency_key text unique,
  attempts int default 0,
  error text,
  result jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  company_key text not null,
  user_id uuid references auth.users(id),
  title text not null,
  body text,
  status text default 'queued',
  created_at timestamptz default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  company_key text not null,
  severity text default 'medium',
  event_type text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  plan_key text not null,
  features jsonb default '{}'::jsonb,
  status text default 'inactive',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, company_key)
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan_key text not null,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.billing_events (
  id text primary key,
  org_id uuid references public.organizations(id) on delete set null,
  company_key text,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  processed_at timestamptz default now()
);

create table if not exists public.connector_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  connector_type text not null,
  source_url text,
  external_source text,
  source_trust_score numeric default 50,
  last_successful_import_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.connector_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  company_key text not null,
  connector_source_id uuid references public.connector_sources(id) on delete cascade,
  status text default 'queued',
  external_source text,
  result jsonb default '{}'::jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  company_key text default 'parent_admin',
  backup_type text not null,
  status text default 'queued',
  storage_path text,
  error text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

-- SoundOS
create table if not exists public.artists (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', name text not null, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.artist_dna_profiles (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', artist_id uuid references public.artists(id) on delete cascade, profile jsonb default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.songs (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', artist_id uuid references public.artists(id), title text not null, metadata jsonb default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.projects (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', title text not null, status text default 'draft', metadata jsonb default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.releases (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', project_id uuid references public.projects(id), title text not null, status text default 'planned', metadata jsonb default '{}'::jsonb, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.audio_analysis (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', asset_id uuid references public.uploaded_assets(id), result jsonb default '{}'::jsonb, status text default 'queued', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.transcription_jobs (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', asset_id uuid references public.uploaded_assets(id), status text default 'queued', transcript text, segments jsonb default '[]'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.anti_repetition_checks (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', project_id uuid references public.projects(id), warnings jsonb default '[]'::jsonb, status text default 'ready', created_at timestamptz default now());
create table if not exists public.soundos_readiness_scores (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'soundos', project_id uuid references public.projects(id), score numeric not null, checks jsonb default '{}'::jsonb, created_at timestamptz default now());

-- TableOS
create table if not exists public.restaurants (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', name text not null, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.restaurant_locations (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', restaurant_id uuid references public.restaurants(id), name text not null, address text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.employees (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', location_id uuid references public.restaurant_locations(id), full_name text not null, status text default 'active', created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.job_titles (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', title text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.staff_profiles (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', employee_id uuid references public.employees(id), profile_image_asset_id uuid references public.uploaded_assets(id), metadata jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.staff_chat_threads (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', title text not null, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.staff_chat_messages (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', thread_id uuid references public.staff_chat_threads(id) on delete cascade, body text not null, created_by uuid references auth.users(id), created_at timestamptz default now());
create table if not exists public.schedules (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', location_id uuid references public.restaurant_locations(id), starts_on date, status text default 'draft', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.shifts (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', schedule_id uuid references public.schedules(id), employee_id uuid references public.employees(id), starts_at timestamptz, ends_at timestamptz, role text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.labor_cost_snapshots (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', projected_sales numeric, labor_cost numeric, labor_percent numeric, created_at timestamptz default now());
create table if not exists public.menu_items (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', name text not null, price numeric, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.recipes (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', menu_item_id uuid references public.menu_items(id), name text not null, servings numeric default 1, instructions text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.recipe_ingredients (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', recipe_id uuid references public.recipes(id) on delete cascade, name text not null, quantity numeric, unit text, unit_cost numeric, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.vendors (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', name text not null, contact text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.vendor_links (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', vendor_id uuid references public.vendors(id), label text not null, url text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.repairs (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', title text not null, status text default 'open', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.service_records (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', repair_id uuid references public.repairs(id), notes text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.permits (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', title text not null, expires_at date, asset_id uuid references public.uploaded_assets(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.certifications (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', employee_id uuid references public.employees(id), title text not null, expires_at date, asset_id uuid references public.uploaded_assets(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.inspections (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', title text not null, inspected_at date, result text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.raises (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', employee_id uuid references public.employees(id), amount numeric, effective_at date, approval_status text default 'pending', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.promotions (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', employee_id uuid references public.employees(id), new_title text, effective_at date, approval_status text default 'pending', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.transfers (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', employee_id uuid references public.employees(id), from_location_id uuid, to_location_id uuid, effective_at date, approval_status text default 'pending', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.holidays (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', name text not null, holiday_date date not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.qr_links (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'tableos', label text not null, target_url text not null, token text unique default encode(gen_random_bytes(12), 'hex'), created_at timestamptz default now(), updated_at timestamptz default now());

-- AlertOS
create table if not exists public.alert_sources (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', source_type text not null, source_url text, source_trust_score numeric default 50, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.imported_feed_items (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', alert_source_id uuid references public.alert_sources(id), title text not null, body text, external_source text, source_url text, status text default 'needs_review', raw jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.public_alerts (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', title text not null, body text, severity numeric default 0, status text default 'draft', approved_by uuid references auth.users(id), created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.public_events (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', title text not null, starts_at timestamptz, ends_at timestamptz, status text default 'draft', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.transit_updates (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', title text not null, route_id text, status text default 'needs_review', raw jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.weather_alerts (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', title text not null, zone text, status text default 'needs_review', raw jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.organization_broadcasts (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', title text not null, body text, status text default 'pending_approval', created_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.alert_subscriptions (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', user_id uuid references auth.users(id), channel text not null, target text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.alert_delivery_attempts (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', public_alert_id uuid references public.public_alerts(id), channel text not null, status text default 'queued', error text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.alertos_trust_scores (id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade, company_key text default 'alertos', source_id uuid references public.alert_sources(id), score numeric default 50, reasons jsonb default '[]'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_org_id uuid;
  target_company_key text;
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_org_id := old.org_id;
    target_company_key := coalesce(old.company_key, 'parent_admin');
    target_id := old.id;
  else
    target_org_id := new.org_id;
    target_company_key := coalesce(new.company_key, 'parent_admin');
    target_id := new.id;
  end if;

  insert into public.audit_logs(org_id, company_key, user_id, action, target_table, target_id, metadata)
  values (target_org_id, target_company_key, auth.uid(), tg_op, tg_table_name, target_id, jsonb_build_object('source', 'trigger'));

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','approval_queue','external_links','uploaded_assets','media_jobs','entitlements','billing_customers','billing_subscriptions','connector_sources','connector_runs',
    'artists','artist_dna_profiles','songs','projects','releases','audio_analysis','transcription_jobs',
    'restaurants','restaurant_locations','employees','job_titles','staff_profiles','staff_chat_threads','schedules','shifts','menu_items','recipes','recipe_ingredients','vendors','vendor_links','repairs','service_records','permits','certifications','inspections','raises','promotions','transfers','holidays','qr_links',
    'alert_sources','imported_feed_items','public_alerts','public_events','transit_updates','weather_alerts','organization_broadcasts','alert_subscriptions','alert_delivery_attempts','alertos_trust_scores'
  ]
  loop
    execute format('drop trigger if exists set_updated_at_trigger on public.%I', table_name);
    execute format('create trigger set_updated_at_trigger before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;

  foreach table_name in array array[
    'organizations','organization_members','organization_app_access','uploaded_assets','media_jobs','billing_subscriptions','connector_sources','public_alerts','organization_broadcasts','raises','promotions','transfers'
  ]
  loop
    execute format('drop trigger if exists audit_row_change_trigger on public.%I', table_name);
    execute format('create trigger audit_row_change_trigger after insert or update or delete on public.%I for each row execute function public.audit_row_change()', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','organizations','organization_members','organization_app_access','app_scopes','audit_logs','approval_queue','external_links','uploaded_assets','media_jobs','notifications','security_events','entitlements','billing_customers','billing_subscriptions','billing_events','connector_sources','connector_runs','backup_runs',
    'artists','artist_dna_profiles','songs','projects','releases','audio_analysis','transcription_jobs','anti_repetition_checks','soundos_readiness_scores',
    'restaurants','restaurant_locations','employees','job_titles','staff_profiles','staff_chat_threads','staff_chat_messages','schedules','shifts','labor_cost_snapshots','menu_items','recipes','recipe_ingredients','vendors','vendor_links','repairs','service_records','permits','certifications','inspections','raises','promotions','transfers','holidays','qr_links',
    'alert_sources','imported_feed_items','public_alerts','public_events','transit_updates','weather_alerts','organization_broadcasts','alert_subscriptions','alert_delivery_attempts','alertos_trust_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'approval_queue','external_links','uploaded_assets','media_jobs','notifications','security_events','entitlements','billing_customers','billing_subscriptions','connector_sources','connector_runs','backup_runs',
    'artists','artist_dna_profiles','songs','projects','releases','audio_analysis','transcription_jobs','anti_repetition_checks','soundos_readiness_scores',
    'restaurants','restaurant_locations','employees','job_titles','staff_profiles','staff_chat_threads','staff_chat_messages','schedules','shifts','labor_cost_snapshots','menu_items','recipes','recipe_ingredients','vendors','vendor_links','repairs','service_records','permits','certifications','inspections','raises','promotions','transfers','holidays','qr_links',
    'alert_sources','imported_feed_items','public_alerts','public_events','transit_updates','weather_alerts','organization_broadcasts','alert_subscriptions','alert_delivery_attempts','alertos_trust_scores'
  ]
  loop
    execute format('drop policy if exists tenant_members_select on public.%I', table_name);
    execute format('create policy tenant_members_select on public.%I for select using (public.is_org_member(org_id) and public.has_company_access(org_id, company_key))', table_name);
    execute format('drop policy if exists tenant_members_modify on public.%I', table_name);
    execute format('create policy tenant_members_modify on public.%I for all using (public.has_company_access(org_id, company_key)) with check (public.has_company_access(org_id, company_key))', table_name);
  end loop;
end $$;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations for select using (public.is_org_member(id));

drop policy if exists organizations_owner_update on public.organizations;
create policy organizations_owner_update on public.organizations for update using (public.has_org_role(id, 'owner') or public.has_org_role(id, 'admin'));

drop policy if exists organization_members_visible_to_members on public.organization_members;
create policy organization_members_visible_to_members on public.organization_members for select using (public.is_org_member(org_id));

drop policy if exists organization_members_owner_manage on public.organization_members;
create policy organization_members_owner_manage on public.organization_members for all using (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'owner') or public.has_org_role(org_id, 'admin'));

create index if not exists organizations_company_created_idx on public.organizations(company_key, created_at desc);
create index if not exists org_members_org_user_idx on public.organization_members(org_id, user_id);
create index if not exists uploaded_assets_org_company_created_idx on public.uploaded_assets(org_id, company_key, created_at desc);
create index if not exists media_jobs_org_company_status_idx on public.media_jobs(org_id, company_key, status);
create index if not exists connector_runs_org_company_status_idx on public.connector_runs(org_id, company_key, status, created_at desc);
create index if not exists audit_logs_org_company_created_idx on public.audit_logs(org_id, company_key, created_at desc);
create index if not exists imported_feed_items_external_source_idx on public.imported_feed_items(external_source, status, created_at desc);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets(id, name, public)
    values
      ('profile-images', 'profile-images', false),
      ('soundos-media', 'soundos-media', false),
      ('tableos-documents', 'tableos-documents', false),
      ('alertos-imports', 'alertos-imports', false),
      ('public-assets', 'public-assets', true)
    on conflict (id) do nothing;
  end if;
end $$;

comment on table public.public_alerts is 'AlertOS public alerts require human approval before broadcast or mass delivery.';
comment on table public.raises is 'TableOS raise records are workflow records only; employment decisions require human approval.';
comment on table public.uploaded_assets is 'Storage/media backups are separate from database backups.';

-- SONARA Prompt Library
-- Original SONARA implementation informed by reviewed public prompt-library patterns.
-- Upstream prompt data may enter only through reviewed CC0 import batches with provenance.

create extension if not exists pgcrypto;

create table if not exists public.sonara_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  product_area text not null,
  title text not null,
  slug text not null,
  description text,
  content text not null,
  prompt_type text not null default 'text',
  visibility text not null default 'private',
  status text not null default 'draft',
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  model_compatibility jsonb not null default '[]'::jsonb,
  mcp_compatibility jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  source_type text not null default 'user_created',
  source_repository text,
  source_commit text,
  license_status text not null default 'original_or_authorized',
  provenance jsonb not null default '{}'::jsonb,
  moderation jsonb not null default '{}'::jsonb,
  current_version integer not null default 1,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sonara_prompt_templates_product_chk check (product_area in ('business_builder','creator_studio','growth_studio')),
  constraint sonara_prompt_templates_type_chk check (prompt_type in ('text','image','video','audio','structured','skill','workflow')),
  constraint sonara_prompt_templates_visibility_chk check (visibility in ('private','organization','public')),
  constraint sonara_prompt_templates_status_chk check (status in ('draft','review_required','published','archived','blocked')),
  constraint sonara_prompt_templates_title_length_chk check (char_length(title) between 1 and 160),
  constraint sonara_prompt_templates_content_length_chk check (char_length(content) between 1 and 24000),
  unique (organization_id, slug)
);

create table if not exists public.sonara_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.sonara_prompt_templates(id) on delete cascade,
  version integer not null,
  title text not null,
  content text not null,
  change_note text,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sonara_prompt_versions_version_chk check (version > 0),
  constraint sonara_prompt_versions_status_chk check (status in ('draft','review_required','published','archived','blocked')),
  unique (template_id, version)
);

create table if not exists public.sonara_prompt_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.sonara_prompt_template_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.sonara_prompt_templates(id) on delete cascade,
  tag_id uuid not null references public.sonara_prompt_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, tag_id)
);

create table if not exists public.sonara_prompt_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  product_area text not null,
  name text not null,
  description text,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sonara_prompt_collections_product_chk check (product_area in ('business_builder','creator_studio','growth_studio')),
  constraint sonara_prompt_collections_visibility_chk check (visibility in ('private','organization')),
  unique (organization_id, product_area, name)
);

create table if not exists public.sonara_prompt_collection_items (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection_id uuid not null references public.sonara_prompt_collections(id) on delete cascade,
  template_id uuid not null references public.sonara_prompt_templates(id) on delete cascade,
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, template_id)
);

create table if not exists public.sonara_prompt_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_template_id uuid not null references public.sonara_prompt_templates(id) on delete cascade,
  target_template_id uuid not null references public.sonara_prompt_templates(id) on delete cascade,
  label text not null default 'next',
  connection_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint sonara_prompt_connections_no_self_chk check (source_template_id <> target_template_id),
  unique (source_template_id, target_template_id)
);

create table if not exists public.sonara_prompt_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.sonara_prompt_templates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  product_area text not null,
  source_slug text,
  template_version integer not null default 1,
  input_values jsonb not null default '{}'::jsonb,
  rendered_prompt text not null,
  prompt_fingerprint text not null,
  model_slug text not null default 'provider_neutral',
  status text not null default 'prepared',
  output_payload jsonb not null default '{}'::jsonb,
  execution_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint sonara_prompt_runs_product_chk check (product_area in ('business_builder','creator_studio','growth_studio')),
  constraint sonara_prompt_runs_status_chk check (status in ('prepared','queued','completed','failed','cancelled')),
  constraint sonara_prompt_runs_rendered_length_chk check (char_length(rendered_prompt) between 1 and 48000)
);

create table if not exists public.sonara_prompt_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.sonara_prompt_templates(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sonara_prompt_reports_reason_chk check (reason in ('spam','inappropriate','copyright','misleading','credential_request','safety_bypass','other')),
  constraint sonara_prompt_reports_status_chk check (status in ('pending','reviewed','dismissed','blocked'))
);

create table if not exists public.sonara_prompt_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source_repository text not null,
  source_commit text not null,
  declared_license text not null,
  record_count integer not null default 0,
  imported_count integer not null default 0,
  rejected_count integer not null default 0,
  status text not null default 'review_required',
  review_payload jsonb not null default '{}'::jsonb,
  rollback_manifest jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sonara_prompt_import_batches_count_chk check (record_count between 0 and 10000),
  constraint sonara_prompt_import_batches_license_chk check (upper(declared_license) in ('CC0','CC0-1.0','MIT')),
  constraint sonara_prompt_import_batches_status_chk check (status in ('review_required','approved','importing','completed','failed','rolled_back','blocked'))
);

create index if not exists sonara_prompt_templates_org_product_updated_idx on public.sonara_prompt_templates (organization_id, product_area, updated_at desc);
create index if not exists sonara_prompt_templates_org_status_visibility_idx on public.sonara_prompt_templates (organization_id, status, visibility);
create index if not exists sonara_prompt_templates_tags_gin_idx on public.sonara_prompt_templates using gin (tags);
create index if not exists sonara_prompt_versions_template_created_idx on public.sonara_prompt_versions (template_id, created_at desc);
create index if not exists sonara_prompt_collections_org_product_idx on public.sonara_prompt_collections (organization_id, product_area, updated_at desc);
create index if not exists sonara_prompt_connections_source_order_idx on public.sonara_prompt_connections (source_template_id, connection_order);
create index if not exists sonara_prompt_runs_org_product_created_idx on public.sonara_prompt_runs (organization_id, product_area, created_at desc);
create index if not exists sonara_prompt_runs_template_created_idx on public.sonara_prompt_runs (template_id, created_at desc);
create index if not exists sonara_prompt_reports_org_status_idx on public.sonara_prompt_reports (organization_id, status, created_at desc);
create index if not exists sonara_prompt_import_batches_org_status_idx on public.sonara_prompt_import_batches (organization_id, status, created_at desc);

create or replace function public.set_sonara_prompt_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sonara_prompt_templates_updated_at on public.sonara_prompt_templates;
create trigger set_sonara_prompt_templates_updated_at
before update on public.sonara_prompt_templates
for each row execute function public.set_sonara_prompt_updated_at();

drop trigger if exists set_sonara_prompt_collections_updated_at on public.sonara_prompt_collections;
create trigger set_sonara_prompt_collections_updated_at
before update on public.sonara_prompt_collections
for each row execute function public.set_sonara_prompt_updated_at();

drop trigger if exists set_sonara_prompt_import_batches_updated_at on public.sonara_prompt_import_batches;
create trigger set_sonara_prompt_import_batches_updated_at
before update on public.sonara_prompt_import_batches
for each row execute function public.set_sonara_prompt_updated_at();

create or replace function public.capture_initial_sonara_prompt_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sonara_prompt_versions (
    organization_id, template_id, version, title, content, change_note, status, created_by
  ) values (
    new.organization_id, new.id, new.current_version, new.title, new.content, 'Initial version', new.status, new.created_by
  ) on conflict (template_id, version) do nothing;
  return new;
end;
$$;

drop trigger if exists capture_initial_sonara_prompt_version on public.sonara_prompt_templates;
create trigger capture_initial_sonara_prompt_version
after insert on public.sonara_prompt_templates
for each row execute function public.capture_initial_sonara_prompt_version();

create or replace function public.create_sonara_prompt_version(
  p_template_id uuid,
  p_title text,
  p_content text,
  p_change_note text default null,
  p_status text default 'draft'
)
returns setof public.sonara_prompt_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.sonara_prompt_templates%rowtype;
  v_next_version integer;
  v_version public.sonara_prompt_versions%rowtype;
begin
  select * into v_template
  from public.sonara_prompt_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'prompt_template_not_found';
  end if;

  if auth.role() <> 'service_role' and not public.is_org_member(v_template.organization_id) then
    raise exception 'prompt_template_access_denied';
  end if;

  if p_title is null or char_length(trim(p_title)) not between 1 and 160 then
    raise exception 'prompt_title_invalid';
  end if;

  if p_content is null or char_length(trim(p_content)) not between 1 and 24000 then
    raise exception 'prompt_content_invalid';
  end if;

  if p_status not in ('draft','review_required','published','archived','blocked') then
    raise exception 'prompt_status_invalid';
  end if;

  v_next_version := v_template.current_version + 1;

  update public.sonara_prompt_templates
  set title = trim(p_title),
      content = trim(p_content),
      status = p_status,
      current_version = v_next_version,
      updated_at = now()
  where id = p_template_id;

  insert into public.sonara_prompt_versions (
    organization_id, template_id, version, title, content, change_note, status, created_by
  ) values (
    v_template.organization_id,
    p_template_id,
    v_next_version,
    trim(p_title),
    trim(p_content),
    nullif(trim(coalesce(p_change_note, '')), ''),
    p_status,
    auth.uid()
  ) returning * into v_version;

  return next v_version;
end;
$$;

revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text) from public, anon;
grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text) to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sonara_prompt_templates',
    'sonara_prompt_versions',
    'sonara_prompt_tags',
    'sonara_prompt_template_tags',
    'sonara_prompt_collections',
    'sonara_prompt_collection_items',
    'sonara_prompt_connections',
    'sonara_prompt_runs',
    'sonara_prompt_reports',
    'sonara_prompt_import_batches'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists "org members can read %1$s" on public.%1$I', table_name);
    execute format('create policy "org members can read %1$s" on public.%1$I for select using (public.is_org_member(organization_id) or auth.role() = ''service_role'')', table_name);

    execute format('drop policy if exists "org members can insert %1$s" on public.%1$I', table_name);
    execute format('create policy "org members can insert %1$s" on public.%1$I for insert with check (public.is_org_member(organization_id) or auth.role() = ''service_role'')', table_name);

    execute format('drop policy if exists "org contributors can update %1$s" on public.%1$I', table_name);
    execute format('create policy "org contributors can update %1$s" on public.%1$I for update using (public.has_org_role(organization_id, array[''owner'',''admin'',''business_owner'',''creator'',''agency'',''member'']) or auth.role() = ''service_role'') with check (public.has_org_role(organization_id, array[''owner'',''admin'',''business_owner'',''creator'',''agency'',''member'']) or auth.role() = ''service_role'')', table_name);

    execute format('drop policy if exists "org owners can delete %1$s" on public.%1$I', table_name);
    execute format('create policy "org owners can delete %1$s" on public.%1$I for delete using (public.is_org_owner_or_admin(organization_id) or auth.role() = ''service_role'')', table_name);

    execute format('drop policy if exists "service role manages %1$s" on public.%1$I', table_name);
    execute format('create policy "service role manages %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', table_name);
  end loop;
end $$;

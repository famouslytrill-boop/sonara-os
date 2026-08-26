-- Somewhere for a sub-app's records to live.
--
-- The five business_sub_app_* tables were created on 30 May 2026 and nothing
-- has ever read them. business_sub_app_database_schemas holds a `fields` jsonb
-- describing what a record looks like, and there is **no table holding the
-- records**. A customer could design a record type and have nowhere to put one.
--
-- That is why this is the first migration of the sub-app build rather than the
-- last: without it the feature is a schema designer with no records, which is
-- the shape lib/sonara-subsystem-registry.cjs already described as "Designed,
-- never built."
--
-- One table, not one table per schema. Creating a real table per customer
-- record type would mean this application issuing DDL at runtime with the
-- service-role key, on a database whose migrations are frozen and checksummed
-- precisely so nothing does that. The rows are jsonb, validated in
-- lib/sonara-sub-apps.cjs on the way in against the schema's own field list.
create table if not exists public.business_sub_app_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sub_app_id uuid not null references public.business_sub_apps(id) on delete cascade,
  schema_id uuid not null references public.business_sub_app_database_schemas(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  -- The record itself, keyed by the schema's field keys. Validated before it
  -- gets here; the database holds shape, not meaning.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reading one record type's rows is the only query this table serves, so it is
-- the only index it gets.
create index if not exists business_sub_app_records_schema_idx
  on public.business_sub_app_records (organization_id, schema_id, created_at desc);

create index if not exists business_sub_app_records_sub_app_idx
  on public.business_sub_app_records (organization_id, sub_app_id);

alter table public.business_sub_app_records enable row level security;

drop policy if exists "service role can manage business_sub_app_records" on public.business_sub_app_records;
create policy "service role can manage business_sub_app_records" on public.business_sub_app_records
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Values the status columns will actually hold.
--
-- All five sub-app tables were created with `status text not null default
-- 'draft'` and no check constraint, so every one of them accepts any string --
-- the same gap research_sources carried until 19 August 2026. Nothing had
-- written to them yet, so there is nothing to normalise first; these constrain
-- them before the first row rather than after.
alter table public.business_sub_apps
  drop constraint if exists business_sub_apps_status_check;
alter table public.business_sub_apps
  add constraint business_sub_apps_status_check
  check (status in ('draft', 'in_use', 'retired'));

alter table public.business_sub_app_database_schemas
  drop constraint if exists business_sub_app_database_schemas_status_check;
alter table public.business_sub_app_database_schemas
  add constraint business_sub_app_database_schemas_status_check
  check (status in ('draft', 'in_use', 'retired'));

-- A schema whose fields are not a list cannot render a form, and a schema with
-- no fields is a record type nothing can be entered against.
alter table public.business_sub_app_database_schemas
  drop constraint if exists business_sub_app_database_schemas_fields_check;
alter table public.business_sub_app_database_schemas
  add constraint business_sub_app_database_schemas_fields_check
  check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) > 0);

-- A record type is identified by its key within its sub-app, and two with the
-- same key would make the page at that key ambiguous.
create unique index if not exists business_sub_app_database_schemas_key_idx
  on public.business_sub_app_database_schemas (sub_app_id, schema_key);

comment on table public.business_sub_app_records is
  'Rows belonging to one customer-defined record type. `data` is keyed by the field keys in the parent schema''s `fields` array and is validated against them by lib/sonara-sub-apps.cjs before insert.';

comment on column public.business_sub_app_database_schemas.fields is
  'The field list, as an array of {key, label, type, required} objects and, for a choice field, `choices`. The seven permitted types are in lib/sonara-sub-apps.cjs; each one renders as an input, validates on the way in, and reads back as the same value.';

-- business_sub_app_deployments is deliberately left alone.
--
-- It carries a `deployment_url`, and this product cannot fill it: there is no
-- build step, no per-tenant hosting, and one serverless function serving every
-- route. A sub-app lives inside SONARA at a path under its owner's workspace.
-- Writing a URL there would be a promise this codebase cannot keep, so nothing
-- writes to that table until something can.

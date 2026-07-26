-- Prompt Library production-boundary hotfix.
-- Safe whether the original Prompt Library migration has already been applied or
-- is applied immediately before this migration.

alter table public.sonara_prompt_versions
  add column if not exists input_schema jsonb not null default '{}'::jsonb;

create or replace function public.capture_initial_sonara_prompt_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sonara_prompt_versions (
    organization_id,
    template_id,
    version,
    title,
    content,
    input_schema,
    change_note,
    status,
    created_by
  ) values (
    new.organization_id,
    new.id,
    new.current_version,
    new.title,
    new.content,
    new.input_schema,
    'Initial version',
    new.status,
    new.created_by
  ) on conflict (template_id, version) do nothing;
  return new;
end;
$$;

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
  v_variables text[];
  v_properties jsonb;
  v_input_schema jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'prompt_version_service_role_required';
  end if;

  select * into v_template
  from public.sonara_prompt_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'prompt_template_not_found';
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

  select coalesce(
    array_agg(distinct matched[1] order by matched[1]),
    array[]::text[]
  )
  into v_variables
  from regexp_matches(
    trim(p_content),
    '\{\{\s*([A-Za-z][A-Za-z0-9_]{0,63})\s*\}\}',
    'g'
  ) as matched;

  if exists (
    select 1
    from unnest(v_variables) as variable_name
    where variable_name ~* '(password|secret|api_?key|access_?token|refresh_?token|private_?key|card_?number|cvv|cvc|ssn)'
  ) then
    raise exception 'prompt_protected_variable_name';
  end if;

  select coalesce(
    jsonb_object_agg(
      variable_name,
      jsonb_build_object('type', 'string', 'maxLength', 6000)
    ),
    '{}'::jsonb
  )
  into v_properties
  from unnest(v_variables) as variable_name;

  v_input_schema := jsonb_build_object(
    'type', 'object',
    'properties', v_properties,
    'required', to_jsonb(v_variables)
  );

  v_next_version := v_template.current_version + 1;

  update public.sonara_prompt_templates
  set title = trim(p_title),
      content = trim(p_content),
      input_schema = v_input_schema,
      status = p_status,
      current_version = v_next_version,
      updated_at = now()
  where id = p_template_id;

  insert into public.sonara_prompt_versions (
    organization_id,
    template_id,
    version,
    title,
    content,
    input_schema,
    change_note,
    status,
    created_by
  ) values (
    v_template.organization_id,
    p_template_id,
    v_next_version,
    trim(p_title),
    trim(p_content),
    v_input_schema,
    nullif(trim(coalesce(p_change_note, '')), ''),
    p_status,
    v_template.created_by
  ) returning * into v_version;

  return next v_version;
end;
$$;

revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text)
  to service_role;

-- The Prompt Library is server-mediated. Earlier privilege-hardening migrations
-- make new Data API objects opt-in, so grant only the server role and keep
-- browser roles away from direct table access.
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
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

-- Preserve private visibility even if browser privileges are deliberately added
-- in a future reviewed migration.
drop policy if exists "org members can read sonara_prompt_templates"
  on public.sonara_prompt_templates;
drop policy if exists "members read visible prompt templates"
  on public.sonara_prompt_templates;
create policy "members read visible prompt templates"
on public.sonara_prompt_templates
for select
using (
  auth.role() = 'service_role'
  or (
    public.is_org_member(organization_id)
    and (
      (visibility = 'private' and created_by = auth.uid())
      or visibility = 'organization'
      or (visibility = 'public' and status = 'published')
    )
  )
);

drop policy if exists "org members can read sonara_prompt_collections"
  on public.sonara_prompt_collections;
drop policy if exists "members read visible prompt collections"
  on public.sonara_prompt_collections;
create policy "members read visible prompt collections"
on public.sonara_prompt_collections
for select
using (
  auth.role() = 'service_role'
  or (
    public.is_org_member(organization_id)
    and (
      visibility = 'organization'
      or (visibility = 'private' and created_by = auth.uid())
    )
  )
);

drop policy if exists "org members can read sonara_prompt_versions"
  on public.sonara_prompt_versions;
drop policy if exists "members read visible prompt versions"
  on public.sonara_prompt_versions;
create policy "members read visible prompt versions"
on public.sonara_prompt_versions
for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.sonara_prompt_templates as template
    where template.id = sonara_prompt_versions.template_id
      and public.is_org_member(template.organization_id)
      and (
        (template.visibility = 'private' and template.created_by = auth.uid())
        or template.visibility = 'organization'
        or (template.visibility = 'public' and template.status = 'published')
      )
  )
);

notify pgrst, 'reload schema';

-- Deep production database reconciliation for SONARA Industries.
-- Returns metadata only. No customer rows, credentials, or secret values are exposed.
-- The snapshot is service-role-only and is used after every controlled migration push.

grant usage on schema public to service_role;

create or replace function public.sonara_database_deep_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  migration_versions jsonb := '[]'::jsonb;
  result jsonb;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $sql$
      select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
      from supabase_migrations.schema_migrations
    $sql$ into migration_versions;
  end if;

  with public_tables as (
    select
      classes.oid,
      classes.relname,
      classes.relrowsecurity,
      classes.relforcerowsecurity
    from pg_catalog.pg_class classes
    join pg_catalog.pg_namespace namespaces on namespaces.oid = classes.relnamespace
    where namespaces.nspname = 'public'
      and classes.relkind in ('r', 'p')
  ),
  table_details as (
    select jsonb_agg(
      jsonb_build_object(
        'name', tables.relname,
        'rls_enabled', tables.relrowsecurity,
        'rls_forced', tables.relforcerowsecurity,
        'column_count', (
          select count(*)
          from pg_catalog.pg_attribute attributes
          where attributes.attrelid = tables.oid
            and attributes.attnum > 0
            and not attributes.attisdropped
        ),
        'primary_key_count', (
          select count(*)
          from pg_catalog.pg_constraint constraints
          where constraints.conrelid = tables.oid
            and constraints.contype = 'p'
        ),
        'foreign_key_count', (
          select count(*)
          from pg_catalog.pg_constraint constraints
          where constraints.conrelid = tables.oid
            and constraints.contype = 'f'
        ),
        'check_constraint_count', (
          select count(*)
          from pg_catalog.pg_constraint constraints
          where constraints.conrelid = tables.oid
            and constraints.contype = 'c'
        ),
        'index_count', (
          select count(*)
          from pg_catalog.pg_index indexes
          where indexes.indrelid = tables.oid
        ),
        'valid_index_count', (
          select count(*)
          from pg_catalog.pg_index indexes
          where indexes.indrelid = tables.oid
            and indexes.indisvalid
            and indexes.indisready
        ),
        'policy_count', (
          select count(*)
          from pg_catalog.pg_policy policies
          where policies.polrelid = tables.oid
        ),
        'trigger_count', (
          select count(*)
          from pg_catalog.pg_trigger triggers
          where triggers.tgrelid = tables.oid
            and not triggers.tgisinternal
        ),
        'service_role_select', pg_catalog.has_table_privilege('service_role', format('public.%I', tables.relname), 'SELECT'),
        'service_role_insert', pg_catalog.has_table_privilege('service_role', format('public.%I', tables.relname), 'INSERT'),
        'service_role_update', pg_catalog.has_table_privilege('service_role', format('public.%I', tables.relname), 'UPDATE'),
        'service_role_delete', pg_catalog.has_table_privilege('service_role', format('public.%I', tables.relname), 'DELETE')
      ) order by tables.relname
    ) as value
    from public_tables tables
  ),
  schema_details as (
    select jsonb_agg(
      jsonb_build_object(
        'name', expected.name,
        'available', pg_catalog.to_regnamespace(expected.name) is not null
      ) order by expected.name
    ) as value
    from unnest(array['public', 'auth', 'storage', 'supabase_migrations']::text[]) expected(name)
  ),
  function_details as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', procedures.proname,
        'identity_arguments', pg_catalog.pg_get_function_identity_arguments(procedures.oid),
        'security_definer', procedures.prosecdef
      ) order by procedures.proname, pg_catalog.pg_get_function_identity_arguments(procedures.oid)
    ), '[]'::jsonb) as value
    from pg_catalog.pg_proc procedures
    join pg_catalog.pg_namespace namespaces on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
  ),
  bucket_details as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', buckets.id,
        'public', buckets.public,
        'file_size_limit', buckets.file_size_limit,
        'allowed_mime_types', buckets.allowed_mime_types
      ) order by buckets.id
    ), '[]'::jsonb) as value
    from storage.buckets buckets
  ),
  extension_details as (
    select coalesce(jsonb_agg(
      jsonb_build_object('name', extensions.extname, 'version', extensions.extversion)
      order by extensions.extname
    ), '[]'::jsonb) as value
    from pg_catalog.pg_extension extensions
  )
  select jsonb_build_object(
    'generated_at', statement_timestamp(),
    'schemas', schema_details.value,
    'public_table_count', coalesce(jsonb_array_length(table_details.value), 0),
    'public_tables', coalesce(table_details.value, '[]'::jsonb),
    'public_functions', function_details.value,
    'storage_buckets', bucket_details.value,
    'applied_migrations', migration_versions,
    'extensions', extension_details.value
  )
  into result
  from schema_details, table_details, function_details, bucket_details, extension_details;

  return result;
end;
$function$;

revoke execute on function public.sonara_database_deep_snapshot() from public, anon, authenticated;
grant execute on function public.sonara_database_deep_snapshot() to service_role;

comment on function public.sonara_database_deep_snapshot() is
  'Service-role-only production metadata snapshot covering schemas, every public table, RLS, policies, constraints, indexes, triggers, privileges, storage buckets, functions, extensions, and applied migration versions.';

do $$
begin
  if has_function_privilege('anon', 'public.sonara_database_deep_snapshot()'::regprocedure, 'execute')
    or has_function_privilege('authenticated', 'public.sonara_database_deep_snapshot()'::regprocedure, 'execute') then
    raise exception 'deep database snapshot is executable by a public Data API role';
  end if;

  if not has_function_privilege('service_role', 'public.sonara_database_deep_snapshot()'::regprocedure, 'execute') then
    raise exception 'service role cannot execute the deep database snapshot';
  end if;
end $$;

notify pgrst, 'reload schema';

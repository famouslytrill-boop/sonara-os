-- Schema-aware first owner bootstrap for SONARA Industries.
-- Replace placeholders locally before running:
--   <OWNER_EMAIL>
--   <OWNER_ORG_NAME>
--   <OWNER_ORG_SLUG>
--
-- Requirements:
-- - The auth user must already exist in auth.users.
-- - Run only from the Supabase SQL editor or a trusted admin context.
-- - Do not disable RLS.
-- - Do not commit a real owner email.

do $$
declare
  owner_email text := '<OWNER_EMAIL>';
  owner_org_name text := '<OWNER_ORG_NAME>';
  owner_org_slug text := '<OWNER_ORG_SLUG>';
  auth_user_id uuid;
  target_organization_id uuid;
  unknown_required_columns text[];
  organization_columns text[] := array['name'];
  organization_values text[];
  membership_table text;
  membership_org_column text;
  membership_exists boolean := false;
  membership_columns text[];
  membership_values text[];
  update_assignments text[] := array[]::text[];
begin
  select users.id
    into auth_user_id
  from auth.users users
  where lower(users.email) = lower(owner_email)
  limit 1;

  if auth_user_id is null then
    raise exception 'Create/login with this email first using Supabase Auth, then rerun owner bootstrap.';
  end if;

  if to_regclass('public.user_profiles') is not null then
    insert into public.user_profiles (id, display_name, email)
    select auth_user_id, owner_org_name || ' Owner', owner_email
    where not exists (
      select 1 from public.user_profiles where id = auth_user_id
    );
  end if;

  if to_regclass('public.organizations') is null then
    raise exception 'public.organizations does not exist. Apply reviewed migrations before owner bootstrap.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'slug'
  ) then
    execute 'select id from public.organizations where slug = $1 limit 1'
      into target_organization_id
      using owner_org_slug;
  end if;

  if target_organization_id is null then
    select id
      into target_organization_id
    from public.organizations
    where name = owner_org_name
    limit 1;
  end if;

  if target_organization_id is null then
    select coalesce(array_agg(column_name order by column_name), array[]::text[])
      into unknown_required_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and is_nullable = 'NO'
      and column_default is null
      and column_name not in (
        'name',
        'slug',
        'kind',
        'status',
        'created_by',
        'company_key',
        'country',
        'metadata'
      );

    if array_length(unknown_required_columns, 1) is not null then
      raise exception 'Organization schema has required columns that owner bootstrap cannot fill safely: %',
        array_to_string(unknown_required_columns, ', ');
    end if;

    organization_values := array[quote_literal(owner_org_name)];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'slug'
    ) then
      organization_columns := organization_columns || 'slug';
      organization_values := organization_values || quote_literal(owner_org_slug);
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'kind'
    ) then
      organization_columns := organization_columns || 'kind';
      organization_values := organization_values || quote_literal('internal');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'status'
    ) then
      organization_columns := organization_columns || 'status';
      organization_values := organization_values || quote_literal('active');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'created_by'
    ) then
      organization_columns := organization_columns || 'created_by';
      organization_values := organization_values || quote_literal(auth_user_id::text);
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'company_key'
    ) then
      organization_columns := organization_columns || 'company_key';
      organization_values := organization_values || quote_literal('sonara');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'country'
    ) then
      organization_columns := organization_columns || 'country';
      organization_values := organization_values || quote_literal('US');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations' and column_name = 'metadata'
    ) then
      organization_columns := organization_columns || 'metadata';
      organization_values := organization_values || quote_literal('{"source":"owner_bootstrap"}') || '::jsonb';
    end if;

    execute format(
      'insert into public.organizations (%s) values (%s) returning id',
      array_to_string(organization_columns, ', '),
      array_to_string(organization_values, ', ')
    )
    into target_organization_id;
  end if;

  if to_regclass('public.organization_members') is not null then
    membership_table := 'organization_members';
    membership_org_column := 'organization_id';
  elsif to_regclass('public.organization_memberships') is not null then
    membership_table := 'organization_memberships';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_memberships'
        and column_name = 'organization_id'
    ) then
      membership_org_column := 'organization_id';
    else
      membership_org_column := 'org_id';
    end if;
  else
    raise exception 'No organization membership table exists. Expected public.organization_members or public.organization_memberships.';
  end if;

  execute format(
    'select exists (select 1 from public.%I where %I = $1 and user_id = $2)',
    membership_table,
    membership_org_column
  )
  into membership_exists
  using target_organization_id, auth_user_id;

  if membership_exists then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'role'
    ) then
      update_assignments := update_assignments || 'role = ''owner''';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'status'
    ) then
      update_assignments := update_assignments || 'status = ''active''';
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'updated_at'
    ) then
      update_assignments := update_assignments || 'updated_at = now()';
    end if;

    if array_length(update_assignments, 1) is not null then
      execute format(
        'update public.%I set %s where %I = $1 and user_id = $2',
        membership_table,
        array_to_string(update_assignments, ', '),
        membership_org_column
      )
      using target_organization_id, auth_user_id;
    end if;
  else
    membership_columns := array[membership_org_column, 'user_id'];
    membership_values := array[quote_literal(target_organization_id::text), quote_literal(auth_user_id::text)];

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'role'
    ) then
      membership_columns := membership_columns || 'role';
      membership_values := membership_values || quote_literal('owner');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'status'
    ) then
      membership_columns := membership_columns || 'status';
      membership_values := membership_values || quote_literal('active');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = membership_table and column_name = 'created_by'
    ) then
      membership_columns := membership_columns || 'created_by';
      membership_values := membership_values || quote_literal(auth_user_id::text);
    end if;

    execute format(
      'insert into public.%I (%s) values (%s)',
      membership_table,
      array_to_string(membership_columns, ', '),
      array_to_string(membership_values, ', ')
    );
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (organization_id, created_by, event_type, entity_type, entity_id, metadata)
    select
      target_organization_id,
      auth_user_id,
      'owner_bootstrap',
      'organization_membership',
      auth_user_id,
      '{"source":"manual_owner_bootstrap"}'::jsonb;
  end if;
end $$;

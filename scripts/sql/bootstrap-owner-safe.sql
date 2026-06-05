-- SONARA owner bootstrap.
-- Run manually in the Supabase SQL editor after OWNER_EMAIL_HERE has signed in once.
-- This script does not weaken RLS and does not create a hidden backdoor user.

do $$
declare
  owner_email text := 'OWNER_EMAIL_HERE';
  owner_user_id uuid;
  org_id uuid;
  membership_id uuid;
  columns text[];
  values text[];
  updates text[];
begin
  if owner_email = 'OWNER_EMAIL_HERE' then
    raise exception 'Replace OWNER_EMAIL_HERE with the real owner email before running bootstrap.';
  end if;

  select id
    into owner_user_id
    from auth.users
   where lower(email) = lower(owner_email)
   order by created_at asc
   limit 1;

  if owner_user_id is null then
    raise exception 'Create/sign in with this Supabase Auth user first, then rerun bootstrap.';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organizations'
       and column_name = 'company_key'
  ) then
    execute $sql$
      select id
        from public.organizations
       where company_key = 'sonara'
          or slug = 'sonara-industries'
       order by created_at asc nulls last
       limit 1
    $sql$ into org_id;
  else
    select id
      into org_id
      from public.organizations
     where slug = 'sonara-industries'
     order by created_at asc nulls last
     limit 1;
  end if;

  if org_id is null then
    columns := array['name'];
    values := array[quote_literal('SONARA Industries')];

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'slug') then
      columns := columns || 'slug';
      values := values || quote_literal('sonara-industries');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'company_key') then
      columns := columns || 'company_key';
      values := values || quote_literal('sonara');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'country') then
      columns := columns || 'country';
      values := values || quote_literal('US');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'owner_id') then
      columns := columns || 'owner_id';
      values := values || (quote_literal(owner_user_id::text) || '::uuid');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'owner_user_id') then
      columns := columns || 'owner_user_id';
      values := values || (quote_literal(owner_user_id::text) || '::uuid');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'metadata') then
      columns := columns || 'metadata';
      values := values || (quote_literal('{}') || '::jsonb');
    end if;

    execute format(
      'insert into public.organizations (%s) values (%s) returning id',
      array_to_string(columns, ', '),
      array_to_string(values, ', ')
    ) into org_id;
  else
    updates := array['name = ' || quote_literal('SONARA Industries')];

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'slug') then
      updates := updates || ('slug = ' || quote_literal('sonara-industries'));
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'company_key') then
      updates := updates || ('company_key = ' || quote_literal('sonara'));
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'country') then
      updates := updates || ('country = ' || quote_literal('US'));
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'owner_id') then
      updates := updates || ('owner_id = ' || quote_literal(owner_user_id::text) || '::uuid');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'owner_user_id') then
      updates := updates || ('owner_user_id = ' || quote_literal(owner_user_id::text) || '::uuid');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'updated_at') then
      updates := updates || 'updated_at = now()';
    end if;

    execute format(
      'update public.organizations set %s where id = %L::uuid',
      array_to_string(updates, ', '),
      org_id::text
    );
  end if;

  select id
    into membership_id
    from public.organization_memberships
   where organization_id = org_id
     and user_id = owner_user_id
   limit 1;

  if membership_id is null then
    insert into public.organization_memberships (organization_id, user_id, role, status)
    values (org_id, owner_user_id, 'owner', 'active');
  else
    update public.organization_memberships
       set role = 'owner',
           status = 'active',
           updated_at = now()
     where id = membership_id;
  end if;

  raise notice 'Owner bootstrap complete for organization % and user %', org_id, owner_user_id;
end $$;

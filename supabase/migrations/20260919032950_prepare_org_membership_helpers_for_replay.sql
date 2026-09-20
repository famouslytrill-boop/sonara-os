-- Replay bridge for immutable organization authorization hardening.
--
-- Production has 20260919032900 recorded, but the two helpers below still use
-- the historical input name target_org_id. The frozen 20260919033000 migration
-- replaces those signatures with target_organization_id, and PostgreSQL refuses
-- CREATE OR REPLACE FUNCTION when that would rename an existing input
-- parameter.
--
-- Do not edit 20260919033000. This migration sorts immediately before it and
-- changes only the replay precondition: it preserves the legacy helper bodies
-- while normalizing the input parameter name. The following frozen migration
-- then performs the actual organization_memberships hardening.
--
-- Policies depending on either function are captured from pg_depend, removed
-- temporarily, and reconstructed from PostgreSQL's own catalog expressions.
-- DROP FUNCTION intentionally has no CASCADE. Any dependency that is not a
-- policy makes this migration fail closed instead of silently deleting it.

do $bridge$
declare
  helper record;
  helper_oid oid;
  argument_names text[];
  unexpected_dependencies text;
  policy_rows jsonb;
  policy_row jsonb;
  role_sql text;
  command_sql text;
  using_sql text;
  check_sql text;
  captured_count integer;
  restored_count integer;
begin
  for helper in
    select *
    from (
      values
        (
          'public.is_org_member(uuid)'::text,
          'is_org_member'::text,
          'target_org_id'::text,
          'target_organization_id'::text
        ),
        (
          'public.has_org_role(uuid,text)'::text,
          'has_org_role_scalar'::text,
          'target_org_id'::text,
          'target_organization_id'::text
        )
    ) as helpers(signature, helper_key, legacy_argument_name, canonical_argument_name)
  loop
    select to_regprocedure(helper.signature)::oid
      into helper_oid;

    if helper_oid is null then
      raise exception 'organization replay bridge failed: % does not exist', helper.signature;
    end if;

    select p.proargnames
      into argument_names
      from pg_proc p
      where p.oid = helper_oid;

    if coalesce(argument_names[1], '') = helper.canonical_argument_name then
      raise notice 'organization replay bridge: % parameter already canonical; no change required', helper.signature;
      continue;
    end if;

    if coalesce(argument_names[1], '') <> helper.legacy_argument_name then
      raise exception
        'organization replay bridge failed: % has unexpected first input parameter name %',
        helper.signature,
        coalesce(argument_names[1], '<unnamed>');
    end if;

    -- Policies are the only dependency class this bridge knows how to capture
    -- and rebuild. Anything else must stop the migration before a DROP occurs.
    select string_agg(
      format(
        '%s:%s',
        d.classid::regclass::text,
        d.objid::text
      ),
      ', ' order by d.classid::regclass::text, d.objid
    )
      into unexpected_dependencies
      from pg_depend d
      where d.refobjid = helper_oid
        and d.deptype in ('n', 'a')
        and d.classid <> 'pg_policy'::regclass;

    if unexpected_dependencies is not null then
      raise exception
        'organization replay bridge failed: % has unsupported dependencies: %',
        helper.signature,
        unexpected_dependencies;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'schema_name', dependencies.schema_name,
          'table_name', dependencies.table_name,
          'policy_name', dependencies.policy_name,
          'permissive', dependencies.permissive,
          'command', dependencies.command,
          'roles', dependencies.roles,
          'using_expression', dependencies.using_expression,
          'check_expression', dependencies.check_expression
        )
        order by dependencies.schema_name, dependencies.table_name, dependencies.policy_name
      ),
      '[]'::jsonb
    )
      into policy_rows
      from (
        select distinct
          p.oid,
          n.nspname as schema_name,
          c.relname as table_name,
          p.polname as policy_name,
          p.polpermissive as permissive,
          p.polcmd as command,
          to_jsonb(p.polroles) as roles,
          pg_get_expr(p.polqual, p.polrelid) as using_expression,
          pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
        from pg_depend d
        join pg_policy p
          on d.classid = 'pg_policy'::regclass
         and d.objid = p.oid
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where d.refobjid = helper_oid
          and d.deptype in ('n', 'a')
      ) dependencies;

    captured_count := jsonb_array_length(policy_rows);
    if captured_count = 0 then
      raise exception
        'organization replay bridge failed: no dependent policies captured for %',
        helper.signature;
    end if;

    for policy_row in
      select value from jsonb_array_elements(policy_rows)
    loop
      execute format(
        'drop policy %I on %I.%I',
        policy_row->>'policy_name',
        policy_row->>'schema_name',
        policy_row->>'table_name'
      );
    end loop;

    if helper.helper_key = 'is_org_member' then
      -- No CASCADE: a dependency not captured above must abort this statement.
      drop function public.is_org_member(uuid);

      execute $function$
        create function public.is_org_member(target_organization_id uuid)
        returns boolean
        language sql
        stable
        security definer
        set search_path = ''
        as 'select exists (
          select 1
          from public.organization_members
          where org_id = target_organization_id
            and user_id = auth.uid()
        )'
      $function$;

      revoke all on function public.is_org_member(uuid) from public;
      grant execute on function public.is_org_member(uuid) to authenticated, service_role;
    elsif helper.helper_key = 'has_org_role_scalar' then
      -- Preserve the pre-hardening body. 20260919033000 changes the identity
      -- source and active-status rule after this replay-only rename succeeds.
      drop function public.has_org_role(uuid, text);

      execute $function$
        create function public.has_org_role(target_organization_id uuid, target_role text)
        returns boolean
        language sql
        stable
        security definer
        set search_path = 'public'
        as 'select exists (
          select 1
          from public.organization_members
          where org_id = target_organization_id
            and user_id = auth.uid()
            and role = target_role
        )'
      $function$;

      revoke all on function public.has_org_role(uuid, text) from public;
      grant execute on function public.has_org_role(uuid, text) to authenticated, service_role;
    else
      raise exception 'organization replay bridge failed: unknown helper key %', helper.helper_key;
    end if;

    restored_count := 0;
    for policy_row in
      select value from jsonb_array_elements(policy_rows)
    loop
      select string_agg(
        case
          when role_oid::oid = 0 then 'public'
          else quote_ident(pg_get_userbyid(role_oid::oid))
        end,
        ', ' order by ordinal
      )
        into role_sql
        from jsonb_array_elements_text(policy_row->'roles')
          with ordinality as roles(role_oid, ordinal);

      if role_sql is null or role_sql = '' then
        raise exception
          'organization replay bridge failed: policy % has no reconstructable roles',
          policy_row->>'policy_name';
      end if;

      command_sql := case policy_row->>'command'
        when '*' then 'all'
        when 'r' then 'select'
        when 'a' then 'insert'
        when 'w' then 'update'
        when 'd' then 'delete'
        else null
      end;

      if command_sql is null then
        raise exception
          'organization replay bridge failed: policy % has unknown command %',
          policy_row->>'policy_name',
          policy_row->>'command';
      end if;

      using_sql := case
        when policy_row->>'using_expression' is null then ''
        else format(' using (%s)', policy_row->>'using_expression')
      end;

      check_sql := case
        when policy_row->>'check_expression' is null then ''
        else format(' with check (%s)', policy_row->>'check_expression')
      end;

      execute format(
        'create policy %I on %I.%I as %s for %s to %s%s%s',
        policy_row->>'policy_name',
        policy_row->>'schema_name',
        policy_row->>'table_name',
        case when (policy_row->>'permissive')::boolean then 'permissive' else 'restrictive' end,
        command_sql,
        role_sql,
        using_sql,
        check_sql
      );

      restored_count := restored_count + 1;
    end loop;

    if restored_count <> captured_count then
      raise exception
        'organization replay bridge failed: % captured % policies but restored %',
        helper.signature,
        captured_count,
        restored_count;
    end if;

    select p.proargnames
      into argument_names
      from pg_proc p
      where p.oid = to_regprocedure(helper.signature)::oid;

    if coalesce(argument_names[1], '') <> helper.canonical_argument_name then
      raise exception
        'organization replay bridge failed: % first parameter is still %',
        helper.signature,
        coalesce(argument_names[1], '<unnamed>');
    end if;
  end loop;
end
$bridge$;

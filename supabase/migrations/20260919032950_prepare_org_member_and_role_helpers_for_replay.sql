-- Backfilled compatibility bridge for immutable tenant-hardening replay.
--
-- Production evidence from 2026-09-20 showed that the live database still
-- carried two legacy helper signatures:
--
--   public.is_org_member(target_org_id uuid)
--   public.has_org_role(target_org_id uuid, target_role text)
--
-- The frozen 20260919033000 tenant-boundary hardening migration replaces those
-- same function signatures while using target_organization_id. PostgreSQL does
-- not permit CREATE OR REPLACE FUNCTION to rename an existing input parameter,
-- so production stopped with SQLSTATE 42P13 before the hardening could run.
--
-- Do not edit the frozen hardening migration. This bridge sorts immediately
-- before it, changes only the replay precondition, and is a no-op wherever the
-- helper parameter names are already canonical.
--
-- Production inspection also proved that the only catalog-tracked dependencies
-- on the two drifted helpers are RLS policies. Those policies are captured from
-- PostgreSQL's own catalog, dropped temporarily, and recreated with the same
-- command, role list, permissive/restrictive mode, USING expression and WITH
-- CHECK expression. DROP FUNCTION is intentionally used without CASCADE: any
-- dependency outside the captured policy set blocks this migration rather than
-- being deleted silently.

do $bridge$
declare
  member_oid oid;
  scalar_role_oid oid;
  array_role_oid oid;
  owner_oid oid;

  member_arg_1 text;
  scalar_role_arg_1 text;
  scalar_role_arg_2 text;
  array_role_arg_1 text;
  array_role_arg_2 text;
  owner_arg_1 text;

  rebuild_member boolean := false;
  rebuild_scalar_role boolean := false;

  policy_rows jsonb := '[]'::jsonb;
  policy_row jsonb;
  role_sql text;
  command_sql text;
  using_sql text;
  check_sql text;
  captured_count integer := 0;
  restored_count integer := 0;
begin
  select to_regprocedure('public.is_org_member(uuid)')::oid
    into member_oid;
  select to_regprocedure('public.has_org_role(uuid,text)')::oid
    into scalar_role_oid;
  select to_regprocedure('public.has_org_role(uuid,text[])')::oid
    into array_role_oid;
  select to_regprocedure('public.is_org_owner_or_admin(uuid)')::oid
    into owner_oid;

  if member_oid is null
     or scalar_role_oid is null
     or array_role_oid is null
     or owner_oid is null then
    raise exception
      'tenant replay bridge failed: required organization authorization helper is missing';
  end if;

  select p.proargnames[1]
    into member_arg_1
    from pg_proc p
    where p.oid = member_oid;

  select p.proargnames[1], p.proargnames[2]
    into scalar_role_arg_1, scalar_role_arg_2
    from pg_proc p
    where p.oid = scalar_role_oid;

  select p.proargnames[1], p.proargnames[2]
    into array_role_arg_1, array_role_arg_2
    from pg_proc p
    where p.oid = array_role_oid;

  select p.proargnames[1]
    into owner_arg_1
    from pg_proc p
    where p.oid = owner_oid;

  if member_arg_1 = 'target_organization_id' then
    raise notice 'tenant replay bridge: is_org_member parameter already canonical';
  elsif member_arg_1 = 'target_org_id' then
    rebuild_member := true;
  else
    raise exception
      'tenant replay bridge failed: unexpected is_org_member input parameter name %',
      member_arg_1;
  end if;

  if scalar_role_arg_1 = 'target_organization_id'
     and scalar_role_arg_2 = 'target_role' then
    raise notice 'tenant replay bridge: scalar has_org_role parameters already canonical';
  elsif scalar_role_arg_1 = 'target_org_id'
        and scalar_role_arg_2 = 'target_role' then
    rebuild_scalar_role := true;
  else
    raise exception
      'tenant replay bridge failed: unexpected scalar has_org_role input parameter names %, %',
      scalar_role_arg_1,
      scalar_role_arg_2;
  end if;

  if array_role_arg_1 <> 'target_organization_id'
     or array_role_arg_2 <> 'allowed_roles' then
    raise exception
      'tenant replay bridge failed: unexpected array has_org_role input parameter names %, %',
      array_role_arg_1,
      array_role_arg_2;
  end if;

  if owner_arg_1 <> 'target_organization_id' then
    raise exception
      'tenant replay bridge failed: unexpected is_org_owner_or_admin input parameter name %',
      owner_arg_1;
  end if;

  if not rebuild_member and not rebuild_scalar_role then
    raise notice 'tenant replay bridge: all helper parameter names are canonical; no change required';
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema_name', n.nspname,
        'table_name', c.relname,
        'policy_name', p.polname,
        'permissive', p.polpermissive,
        'command', p.polcmd,
        'roles', to_jsonb(p.polroles),
        'using_expression', pg_get_expr(p.polqual, p.polrelid),
        'check_expression', pg_get_expr(p.polwithcheck, p.polrelid)
      )
      order by n.nspname, c.relname, p.polname
    ),
    '[]'::jsonb
  )
    into policy_rows
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where (
      rebuild_member
      and exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_policy'::regclass
          and d.objid = p.oid
          and d.refclassid = 'pg_proc'::regclass
          and d.refobjid = member_oid
      )
    )
    or (
      rebuild_scalar_role
      and exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_policy'::regclass
          and d.objid = p.oid
          and d.refclassid = 'pg_proc'::regclass
          and d.refobjid = scalar_role_oid
      )
    );

  captured_count := jsonb_array_length(policy_rows);

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

  if rebuild_member then
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
        from public.organization_memberships memberships
        where memberships.organization_id = target_organization_id
          and memberships.user_id = (select auth.uid())
          and memberships.status = ''active''
      )'
    $function$;

    revoke all on function public.is_org_member(uuid) from public;
    grant execute on function public.is_org_member(uuid) to authenticated, service_role;
  end if;

  if rebuild_scalar_role then
    drop function public.has_org_role(uuid, text);

    execute $function$
      create function public.has_org_role(target_organization_id uuid, target_role text)
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as 'select exists (
        select 1
        from public.organization_memberships memberships
        where memberships.organization_id = target_organization_id
          and memberships.user_id = (select auth.uid())
          and memberships.status = ''active''
          and memberships.role = target_role
      )'
    $function$;

    revoke all on function public.has_org_role(uuid, text) from public;
    grant execute on function public.has_org_role(uuid, text) to authenticated, service_role;
  end if;

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
        'tenant replay bridge failed: policy % has no reconstructable roles',
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
        'tenant replay bridge failed: policy % has unknown command %',
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
      case
        when (policy_row->>'permissive')::boolean then 'permissive'
        else 'restrictive'
      end,
      command_sql,
      role_sql,
      using_sql,
      check_sql
    );

    restored_count := restored_count + 1;
  end loop;

  if restored_count <> captured_count then
    raise exception
      'tenant replay bridge failed: captured % dependent policies but restored %',
      captured_count,
      restored_count;
  end if;

  select p.proargnames[1]
    into member_arg_1
    from pg_proc p
    where p.oid = to_regprocedure('public.is_org_member(uuid)')::oid;

  select p.proargnames[1], p.proargnames[2]
    into scalar_role_arg_1, scalar_role_arg_2
    from pg_proc p
    where p.oid = to_regprocedure('public.has_org_role(uuid,text)')::oid;

  if member_arg_1 <> 'target_organization_id'
     or scalar_role_arg_1 <> 'target_organization_id'
     or scalar_role_arg_2 <> 'target_role' then
    raise exception
      'tenant replay bridge failed: helper parameter canonicalization did not persist';
  end if;

  raise notice
    'tenant replay bridge: canonicalized helpers and restored % dependent policies',
    restored_count;
end
$bridge$;

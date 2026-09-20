-- Backfilled compatibility bridge for immutable migration replay.
--
-- 20260603090000 created public.is_org_owner_or_admin(uuid) with the input
-- parameter name _org_id. The already-applied 20260919033000 migration replaces
-- the same signature while naming the parameter target_organization_id.
-- PostgreSQL does not permit CREATE OR REPLACE FUNCTION to rename an existing
-- input parameter, so a fresh replay stops before the hardening migration.
--
-- The applied migration is frozen and must not be edited. This migration sorts
-- immediately before it and changes only the precondition that made replay
-- impossible. On an already-advanced production database the helper already
-- has target_organization_id, so this migration is deliberately a no-op. The
-- controlled deployment uses supabase db push --include-all, so this backfilled
-- version can still be recorded safely in production history.
--
-- On a fresh replay, policies depending on the helper must survive the function
-- recreation. Their definitions are read from PostgreSQL's own catalog, removed
-- temporarily, and recreated byte-for-semantics from the captured expressions.
-- DROP FUNCTION is intentionally used without CASCADE: any dependency we failed
-- to account for makes this migration fail instead of silently deleting it.

do $bridge$
declare
  helper_oid oid;
  argument_name text;
  policy_rows jsonb;
  policy_row jsonb;
  role_sql text;
  command_sql text;
  using_sql text;
  check_sql text;
  captured_count integer := 0;
  restored_count integer := 0;
begin
  select to_regprocedure('public.is_org_owner_or_admin(uuid)')::oid
    into helper_oid;

  if helper_oid is null then
    raise exception 'replay bridge failed: public.is_org_owner_or_admin(uuid) does not exist';
  end if;

  select p.proargnames[1]
    into argument_name
    from pg_proc p
    where p.oid = helper_oid;

  if argument_name = 'target_organization_id' then
    raise notice 'replay bridge: helper parameter already canonical; no change required';
  elsif argument_name = '_org_id' then
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
      where coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%is_org_owner_or_admin%'
         or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%is_org_owner_or_admin%';

    captured_count := jsonb_array_length(policy_rows);
    if captured_count = 0 then
      raise exception 'replay bridge failed: no dependent policies were captured';
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

    -- No CASCADE: an unrecorded dependency must block this bridge.
    drop function public.is_org_owner_or_admin(uuid);

    execute $function$
      create function public.is_org_owner_or_admin(target_organization_id uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as 'select public.has_org_role(target_organization_id, array[''owner'',''admin'']::text[])'
    $function$;

    revoke all on function public.is_org_owner_or_admin(uuid) from public;
    grant execute on function public.is_org_owner_or_admin(uuid) to authenticated, service_role;

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
        from jsonb_array_elements_text(policy_row->'roles') with ordinality as roles(role_oid, ordinal);

      if role_sql is null or role_sql = '' then
        raise exception 'replay bridge failed: policy % has no reconstructable roles', policy_row->>'policy_name';
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
        raise exception 'replay bridge failed: policy % has unknown command %',
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
      raise exception 'replay bridge failed: captured % dependent policies but restored %',
        captured_count,
        restored_count;
    end if;

    select p.proargnames[1]
      into argument_name
      from pg_proc p
      where p.oid = to_regprocedure('public.is_org_owner_or_admin(uuid)')::oid;

    if argument_name <> 'target_organization_id' then
      raise exception 'replay bridge failed: helper parameter is still %', argument_name;
    end if;
  else
    raise exception 'replay bridge failed: unexpected helper input parameter name %', argument_name;
  end if;
end
$bridge$;

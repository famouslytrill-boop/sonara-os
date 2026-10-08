-- Defense-in-depth for server-only public tables.
--
-- Live review on 2026-10-08 found 66 RLS-enabled public tables with no policy.
-- Most client roles already lacked data privileges, but the 13 tables below
-- still carried SELECT/INSERT/UPDATE/DELETE grants for both anon and
-- authenticated. With RLS and no policy those operations are already denied at
-- the row layer, but retaining broad grants leaves an unnecessary second-layer
-- dependency on RLS never being disabled or misconfigured.
--
-- This migration intentionally does NOT add customer policies to server-only
-- tables merely to silence the advisor. It revokes browser-role table
-- privileges while preserving service_role access. Preconditions fail closed if
-- any table has acquired a policy or lost its current server-only posture.
begin;

create temporary table browser_grant_hardening_targets (
  table_name text primary key
) on commit drop;

insert into browser_grant_hardening_targets(table_name) values
  ('audit_logs'),
  ('billing_events'),
  ('db_health_snapshots'),
  ('platform_jobs'),
  ('prompt_templates'),
  ('sonara_control_plane_checks'),
  ('sonara_launch_settings'),
  ('sonara_realtime_channel_registry'),
  ('sonara_storage_bucket_registry'),
  ('sonara_ui_capability_registry'),
  ('sonara_webhook_verification_registry'),
  ('sonara_worker_job_registry'),
  ('sonara_write_api_registry');

do $preflight$
declare
  target text;
  relation_name text;
  rls_enabled boolean;
  policy_count integer;
  role_name text;
begin
  if (select count(*) from browser_grant_hardening_targets) <> 13 then
    raise exception 'browser grant hardening target set drifted; expected 13 tables';
  end if;

  for target in
    select table_name from browser_grant_hardening_targets order by table_name
  loop
    relation_name := format('public.%I', target);

    if to_regclass(relation_name) is null then
      raise exception 'browser grant hardening target % does not exist', relation_name;
    end if;

    select c.relrowsecurity
      into rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = target
       and c.relkind in ('r','p');

    if rls_enabled is distinct from true then
      raise exception 'browser grant hardening target % is not RLS-enabled', relation_name;
    end if;

    select count(*)
      into policy_count
      from pg_policies
     where schemaname = 'public'
       and tablename = target;

    if policy_count <> 0 then
      raise exception 'browser grant hardening target % now has % policies; review intent before changing grants',
        relation_name, policy_count;
    end if;

    -- Production currently has all four DML grants on these targets, while a
    -- fresh replay can legitimately have none because the later default-
    -- privilege hardening prevents this historical drift from being recreated.
    -- Accept those two exact states only. A partial grant set means the reviewed
    -- posture has changed and needs a new decision rather than a blind revoke.
    foreach role_name in array array['anon','authenticated']
    loop
      if (
        has_table_privilege(role_name, relation_name, 'SELECT')::int
        + has_table_privilege(role_name, relation_name, 'INSERT')::int
        + has_table_privilege(role_name, relation_name, 'UPDATE')::int
        + has_table_privilege(role_name, relation_name, 'DELETE')::int
      ) not in (0, 4)
      then
        raise exception 'browser grant precondition drift for role % on %', role_name, relation_name;
      end if;
    end loop;

    -- The backend must retain its existing Data API capability. service_role
    -- bypasses RLS, but it still needs ordinary table privileges.
    if not has_table_privilege('service_role', relation_name, 'SELECT')
       or not has_table_privilege('service_role', relation_name, 'INSERT')
       or not has_table_privilege('service_role', relation_name, 'UPDATE')
       or not has_table_privilege('service_role', relation_name, 'DELETE')
    then
      raise exception 'service_role DML privilege missing on %; refusing browser-only hardening', relation_name;
    end if;
  end loop;
end
$preflight$;

do $revoke_browser_grants$
declare
  target text;
begin
  for target in
    select table_name from browser_grant_hardening_targets order by table_name
  loop
    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      target
    );
  end loop;
end
$revoke_browser_grants$;

do $postflight$
declare
  target text;
  relation_name text;
  role_name text;
begin
  for target in
    select table_name from browser_grant_hardening_targets order by table_name
  loop
    relation_name := format('public.%I', target);

    foreach role_name in array array['anon','authenticated']
    loop
      if has_table_privilege(role_name, relation_name, 'SELECT')
         or has_table_privilege(role_name, relation_name, 'INSERT')
         or has_table_privilege(role_name, relation_name, 'UPDATE')
         or has_table_privilege(role_name, relation_name, 'DELETE')
         or has_table_privilege(role_name, relation_name, 'TRUNCATE')
         or has_table_privilege(role_name, relation_name, 'REFERENCES')
         or has_table_privilege(role_name, relation_name, 'TRIGGER')
      then
        raise exception 'browser role % still has a table privilege on %', role_name, relation_name;
      end if;
    end loop;

    if not has_table_privilege('service_role', relation_name, 'SELECT')
       or not has_table_privilege('service_role', relation_name, 'INSERT')
       or not has_table_privilege('service_role', relation_name, 'UPDATE')
       or not has_table_privilege('service_role', relation_name, 'DELETE')
    then
      raise exception 'service_role DML privilege was changed on %', relation_name;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=target
    ) then
      raise exception 'browser grant hardening unexpectedly created a policy on %', relation_name;
    end if;
  end loop;
end
$postflight$;

commit;

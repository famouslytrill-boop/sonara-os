-- Harden service-role-only RLS policies and remove remaining auth init-plan warnings.
--
-- Two equivalent policy shapes were common in the historical schema:
--   TO public USING (auth.role() = 'service_role')
--   TO service_role USING (auth.role() = 'service_role')
--
-- The first makes every role enter a permissive policy only to fail the predicate,
-- which creates avoidable policy overlap. Both forms also repeat an auth helper that
-- is unnecessary once the policy is scoped to the service_role role itself.
--
-- This migration rewrites only policies whose complete predicate is the service-role
-- test. Mixed policies such as "member OR service role" are deliberately excluded.
-- It also wraps four remaining auth.uid() ownership checks in SELECT, which lets
-- PostgreSQL evaluate the value once per statement instead of once per row.
--
-- No policy is dropped and no customer/member predicate is broadened.
begin;

do $service_role_policy_hardening$
declare
  policy_row record;
  normalized_qual text;
  normalized_check text;
  qual_is_service_role boolean;
  check_is_service_role boolean;
  rewritten_count integer := 0;
begin
  for policy_row in
    select schemaname, tablename, policyname, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and array_length(roles, 1) = 1
      and roles[1]::text in ('public', 'service_role')
      and (
        coalesce(qual, '') ilike '%auth.role()%service_role%'
        or coalesce(with_check, '') ilike '%auth.role()%service_role%'
      )
    order by tablename, policyname
  loop
    normalized_qual := regexp_replace(lower(coalesce(policy_row.qual, '')), '[[:space:]()]', '', 'g');
    normalized_check := regexp_replace(lower(coalesce(policy_row.with_check, '')), '[[:space:]()]', '', 'g');

    qual_is_service_role := normalized_qual in (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    );

    check_is_service_role := normalized_check in (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    );

    if policy_row.cmd in ('ALL', 'UPDATE') and qual_is_service_role and check_is_service_role then
      execute format(
        'alter policy %I on %I.%I to service_role using (true) with check (true)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename
      );
      rewritten_count := rewritten_count + 1;
    elsif policy_row.cmd in ('SELECT', 'DELETE') and qual_is_service_role and policy_row.with_check is null then
      execute format(
        'alter policy %I on %I.%I to service_role using (true)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename
      );
      rewritten_count := rewritten_count + 1;
    elsif policy_row.cmd = 'INSERT' and policy_row.qual is null and check_is_service_role then
      execute format(
        'alter policy %I on %I.%I to service_role with check (true)',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename
      );
      rewritten_count := rewritten_count + 1;
    end if;
  end loop;

  if rewritten_count = 0 then
    raise exception 'service-role policy hardening matched zero policies; refusing vacuous success';
  end if;

  raise notice 'tightened % pure service-role RLS policies', rewritten_count;
end
$service_role_policy_hardening$;

do $ownership_initplan_hardening$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'business_employee_profiles'
      and policyname = 'business_employee_profiles_select_own'
  ) then
    alter policy business_employee_profiles_select_own
      on public.business_employee_profiles
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sonara_platforms'
      and policyname = 'sonara_platforms_select_own'
  ) then
    alter policy sonara_platforms_select_own
      on public.sonara_platforms
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_notifications'
      and policyname = 'user_notifications_select_own'
  ) then
    alter policy user_notifications_select_own
      on public.user_notifications
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'user_preferences_select_own'
  ) then
    alter policy user_preferences_select_own
      on public.user_preferences
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$ownership_initplan_hardening$;

-- Fail if a pure service-role predicate survived. Mixed member/admin policies are
-- intentionally not part of this check.
do $verify_service_role_policy_hardening$
declare
  remaining integer;
begin
  select count(*)
  into remaining
  from (
    select
      cmd,
      with_check,
      regexp_replace(lower(coalesce(qual, '')), '[[:space:]()]', '', 'g') as normalized_qual,
      regexp_replace(lower(coalesce(with_check, '')), '[[:space:]()]', '', 'g') as normalized_check
    from pg_policies
    where schemaname = 'public'
      and array_length(roles, 1) = 1
      and roles[1]::text in ('public', 'service_role')
  ) policies
  where normalized_qual in (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    )
     or normalized_check in (
      'auth.role=''service_role''::text',
      'auth.role=''service_role''',
      'selectauth.roleasrole=''service_role''::text',
      'selectauth.roleasrole=''service_role'''
    );

  if remaining <> 0 then
    raise exception '% pure service-role RLS policies still evaluate auth.role()', remaining;
  end if;
end
$verify_service_role_policy_hardening$;

commit;

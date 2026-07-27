-- Phase 0 hardening: close the function EXECUTE boundary left open after
-- 20260718064853_data_api_privilege_hardening.sql.
--
-- Verified against production before writing this migration:
--   * Excluding extension-owned functions, all 25 `public` functions are owned
--     by `postgres`. 22 carry an explicit, closed ACL from the 20260718 work.
--   * Three still grant EXECUTE to PUBLIC (which includes `anon`):
--       - public.capture_initial_sonara_prompt_version()  -- NULL acl (default)
--       - public.set_sonara_prompt_updated_at()           -- NULL acl (default)
--       - public.current_user_id()                        -- explicit "=X/postgres"
--
-- Severity notes, so this is not over-read:
--   * The first two are trigger functions added by 20260726163000, after the
--     hardening. Triggers fire regardless of the invoking role's EXECUTE
--     privilege, and directly invoking a trigger-returning function raises an
--     error, so practical exploitability is low. Closed here so the exposure
--     does not persist and the Supabase advisor stops reporting it.
--   * current_user_id() is SECURITY INVOKER (not DEFINER) and only returns
--     auth.uid(), so its reachability is not a privilege-escalation vector.
--
-- No customer data is modified by this migration.

-- 1. Trigger helpers are not RPC endpoints. Not even service_role needs direct
--    EXECUTE: the triggers fire on their own.
revoke execute on function public.capture_initial_sonara_prompt_version()
  from public, anon, authenticated, service_role;
revoke execute on function public.set_sonara_prompt_updated_at()
  from public, anon, authenticated, service_role;

-- 2. public.current_user_id() exists in production but is created by no
--    migration in this repository -- it is schema drift. Codify it so the
--    migration history reproduces production, and pin its search_path (the
--    Supabase linter flags it as `function_search_path_mutable`). The body
--    schema-qualifies auth.uid(), so an empty search_path resolves correctly.
--
--    Verified that zero RLS policies reference this function, so restricting it
--    breaks no existing authorization path.
create or replace function public.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

-- create or replace preserves the pre-existing ACL, so the PUBLIC grant must be
-- revoked explicitly. Mirror how 20260718064853 treats authorization helpers.
revoke execute on function public.current_user_id() from public, anon;
grant execute on function public.current_user_id() to authenticated, service_role;

-- 3. Fail the migration if the intended boundary did not take effect, and catch
--    the whole class going forward rather than these three functions. Mirrors
--    the self-verifying pattern established by 20260718064853. Extension-owned
--    functions are excluded because their grants belong to the extension.
do $$
declare
  offending text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into offending
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public'
    and d.objid is null
    and (
      p.proacl is null
      or array_to_string(p.proacl, ',') ~ '(^|,)=X/'
    );

  if offending is not null then
    raise exception
      'Functions in public still grant EXECUTE to PUBLIC: %. Declare an explicit grant/revoke for each.',
      offending;
  end if;
end $$;

do $$
declare
  config text[];
begin
  select p.proconfig into config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'current_user_id';

  -- PostgreSQL normalises `set search_path = ''` and stores the proconfig entry
  -- as `search_path=""` -- quoted, not bare. An earlier revision of this
  -- assertion compared against the bare form and failed the migration even
  -- though the ALTER had succeeded. Accept both spellings.
  if config is null or not exists (
    select 1
    from unnest(config) as entry
    where entry in ('search_path=', 'search_path=""')
  ) then
    raise exception
      'public.current_user_id() does not have a pinned empty search_path (got %)', config;
  end if;
end $$;

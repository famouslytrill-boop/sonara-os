-- The four authorization functions that live in the database and in no migration.
--
-- docs/owner/OWNER-STEPS.md item 3 called this the most serious item on that
-- list, and the reason was not that the functions were dangerous -- it was that
-- nobody could read them. An authorization primitive nobody can read is one
-- nobody can review, and no care about its EXECUTE grant compensates for not
-- knowing what it does.
--
-- The owner ran the pg_get_functiondef query on 19 August 2026 and supplied all
-- four. They are recorded below exactly as the database returned them.
--
-- ============================================================================
-- THIS MIGRATION CREATES NOTHING, REPLACES NOTHING, AND DROPS NOTHING.
-- ============================================================================
--
-- That is a decision, not an oversight, and there are three reasons for it.
--
-- 1. Two of them cannot be created here. `has_scope` reads public.app_scopes
--    and public.organization_members; `has_company_access` reads
--    public.organization_app_access. **None of those three tables exists in any
--    migration in this repository, or anywhere else in it.** A LANGUAGE sql
--    function body is parsed and validated when the function is created, so a
--    `create or replace` of either one against a database without those tables
--    fails -- and it would fail on deploy, on the authorization path.
--
-- 2. Re-creating an authorization primitive that cannot be tested from here, on
--    a live database, is acting past the evidence. Nothing in this repository
--    can execute Postgres, so a definition written here is a definition nobody
--    has run.
--
-- 3. There is nothing to gain. Nothing calls them -- see below.
--
-- What this migration is for is the thing that was actually missing: the
-- definitions, in version control, where somebody can read them and where a
-- change to them shows up in a diff.
--
--
-- WHAT READING THEM ESTABLISHED
--
-- **They come from a different schema generation.** `has_scope` joins
-- public.organization_members on org_id. This project's table is
-- public.organization_memberships and its column is organization_id -- a
-- different name and a different column, not a typo. Together with app_scopes
-- and organization_app_access, which appear nowhere here at all, these two
-- functions describe a permission model this product does not have.
--
-- **is_admin() and is_current_user_admin() are byte-identical.** Same body, same
-- volatility, same search_path, two names. One of them is redundant, and which
-- one is the owner's call rather than this file's.
--
-- **No policy in any migration calls any of the four.** Measured on 19 August
-- 2026: `is_org_member` is called in more than thirty places across five
-- migrations; these four are called in none. That is the fact that matters most
-- for OWNER-STEPS item 4, where the advisor asks for EXECUTE to be revoked from
-- `authenticated` on twelve SECURITY DEFINER functions and the danger is that
-- `is_org_member` alone backs 202 policies across 64 tables. These four back
-- none of the policies this repository can see.
--
-- It stops there, and the reason is the same limitation that produced this file:
-- **policies are being created outside migrations too.** These four functions
-- existed in the database and in no migration, which is proof that the schema
-- has content this repository cannot see. So "no migration calls them" is not
-- "nothing calls them", and the preview-branch test in OWNER-STEPS item 4 is
-- still the way to find out.
--
-- **All four are hardened the way a SECURITY DEFINER function should be.**
-- Every one sets `search_path TO 'public'`, which is what stops a caller
-- redirecting an unqualified name inside the body to a table they control. That
-- is worth recording as a thing that is right, because the advisor's warning
-- reads as though these are careless and they are not.
--
--
-- ============================================================================
-- THE DEFINITIONS, AS RETURNED BY pg_get_functiondef ON 19 AUGUST 2026
-- ============================================================================
--
-- ---------------------------------------------------------------- is_admin()
-- CREATE OR REPLACE FUNCTION public.is_admin()
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select exists (
--     select 1
--     from public.profiles
--     where id = auth.uid()
--       and role in ('owner', 'admin')
--   );
-- $function$
--
-- Reads only public.profiles, which this repository does create. Of the four,
-- this is the one that plainly works.
--
--
-- ------------------------------------------------- is_current_user_admin()
-- CREATE OR REPLACE FUNCTION public.is_current_user_admin()
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select exists (
--     select 1
--     from public.profiles
--     where id = auth.uid()
--       and role in ('owner', 'admin')
--   );
-- $function$
--
-- Byte-identical to is_admin() above.
--
--
-- ------------------------------- has_scope(target_org_id uuid, target_scope text)
-- CREATE OR REPLACE FUNCTION public.has_scope(target_org_id uuid, target_scope text)
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select exists (
--     select 1
--     from public.app_scopes scopes
--     join public.organization_members members on members.org_id = scopes.org_id
--     where scopes.org_id = target_org_id
--       and scopes.scope = target_scope
--       and members.user_id = auth.uid()
--       and members.role in ('owner','admin','manager','editor','billing_admin','security_admin')
--   );
-- $function$
--
-- Depends on public.app_scopes and public.organization_members. Neither is in
-- this repository. Note also the six roles it names -- owner, admin, manager,
-- editor, billing_admin, security_admin -- which is a richer role model than
-- organization_memberships carries.
--
--
-- --------------- has_company_access(target_org_id uuid, target_company_key text)
-- CREATE OR REPLACE FUNCTION public.has_company_access(target_org_id uuid, target_company_key text)
--  RETURNS boolean
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
--   select exists (
--     select 1 from public.organization_app_access
--     where org_id = target_org_id and company_key = target_company_key and enabled = true
--   ) and public.is_org_member(target_org_id);
-- $function$
--
-- Depends on public.organization_app_access, which is not in this repository.
-- It does call public.is_org_member, which is -- so it is half-anchored to this
-- schema and half to another.
--
--
-- ============================================================================
-- A REPORT, RUN AT MIGRATION TIME
-- ============================================================================
--
-- Nothing above executes. This does, and it only raises notices: it says which
-- of the four functions and which of their dependency tables the database it is
-- running against actually has. That answers, from inside the live database,
-- the question this repository cannot answer from outside it.
--
-- It changes nothing, so it is safe to run on any database, and it is safe to
-- run twice.
do $report$
declare
  present text[] := array[]::text[];
  absent text[] := array[]::text[];
  target text;
begin
  foreach target in array array[
    'public.is_admin()',
    'public.is_current_user_admin()',
    'public.has_scope(uuid, text)',
    'public.has_company_access(uuid, text)'
  ] loop
    if to_regprocedure(target) is not null then
      present := present || target;
    else
      absent := absent || target;
    end if;
  end loop;

  raise notice 'Undeclared authorization functions present: %', coalesce(array_to_string(present, ', '), 'none');
  raise notice 'Undeclared authorization functions absent:  %', coalesce(array_to_string(absent, ', '), 'none');

  present := array[]::text[];
  absent := array[]::text[];

  foreach target in array array[
    'public.app_scopes',
    'public.organization_members',
    'public.organization_app_access'
  ] loop
    if to_regclass(target) is not null then
      present := present || target;
    else
      absent := absent || target;
    end if;
  end loop;

  raise notice 'Tables those functions read, present: %', coalesce(array_to_string(present, ', '), 'none');
  raise notice 'Tables those functions read, ABSENT:  %', coalesce(array_to_string(absent, ', '), 'none');

  if array_length(absent, 1) > 0 then
    raise notice 'A function whose table is absent cannot succeed. This is a report, not a failure -- nothing here depends on those functions.';
  end if;
end
$report$;

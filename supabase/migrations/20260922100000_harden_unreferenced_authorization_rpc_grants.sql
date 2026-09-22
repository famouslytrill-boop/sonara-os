-- Narrow grant hardening for authorization helpers that are not policy dependencies.
--
-- The Supabase advisor reports these helpers as authenticated-callable SECURITY
-- DEFINER functions. The RLS policy audit found no policy dependency and the
-- repository has no direct RPC call site for any of them. Keep the server role
-- available, but remove the exposed Data API execution path and pin the
-- function search_path to an empty value where the function exists.
--
-- Four helpers are production-only drift: they are recorded in the repository's
-- advisor evidence but are not created by a migration. Conditional execution
-- keeps a clean replay valid while still hardening an environment where they
-- exist. Policy helpers are deliberately not listed here.

do $hardening$
declare
  signature text;
begin
  foreach signature in array array[
    'public.has_company_access(uuid,text)',
    'public.has_scope(uuid,text)',
    'public.is_admin()',
    'public.is_current_user_admin()',
    'public.sonara_has_org_role(uuid,text[])'
  ]
  loop
    if to_regprocedure(signature) is not null then
      execute format('alter function %s set search_path = %L', signature, '');
      execute format('revoke execute on function %s from public, anon, authenticated', signature);
      execute format('grant execute on function %s to service_role', signature);
    end if;
  end loop;
end
$hardening$;

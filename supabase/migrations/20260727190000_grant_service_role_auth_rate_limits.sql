-- Declare the Data API surface for public.sonara_auth_rate_limits.
--
-- 20260727171000 created the table but never granted anything to service_role,
-- and the production deploy for 20f348a failed post-migration with:
--
--   Supabase deep verification failed (1):
--   - service role cannot read table: public.sonara_auth_rate_limits
--
-- This is exactly the boundary that 20260718064853_data_api_privilege_hardening
-- was built to enforce. That migration revoked default privileges so new public
-- objects are opt-in:
--
--   alter default privileges for role postgres in schema public
--     revoke select, insert, update, delete on tables from anon, authenticated, service_role;
--
-- The new table therefore landed with service_role holding `Dxtm` -- TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN, everything except the four verbs that revoke
-- names. The design worked; the migration that added the table simply failed to
-- declare its surface, which is the declaration this migration supplies.
--
-- The application itself does not need these grants: it reaches the counters
-- only through public.sonara_consume_rate_limit(), which is SECURITY DEFINER and
-- owned by postgres. The grants exist so the table satisfies the platform-wide
-- invariant that the service role can read every table in the Data API contract.
-- anon and authenticated remain fully revoked, and RLS stays on with no policy,
-- so the table is closed to every non-bypass role.
--
-- No customer data is modified by this migration.

grant select, insert, update, delete on table public.sonara_auth_rate_limits to service_role;

-- Keep the negative half of the boundary explicit rather than assumed.
revoke all on table public.sonara_auth_rate_limits from anon, authenticated;

do $$
begin
  if not has_table_privilege('service_role', 'public.sonara_auth_rate_limits', 'SELECT') then
    raise exception 'service_role cannot SELECT public.sonara_auth_rate_limits';
  end if;

  if not has_table_privilege('service_role', 'public.sonara_auth_rate_limits', 'INSERT') then
    raise exception 'service_role cannot INSERT public.sonara_auth_rate_limits';
  end if;

  if not has_table_privilege('service_role', 'public.sonara_auth_rate_limits', 'UPDATE') then
    raise exception 'service_role cannot UPDATE public.sonara_auth_rate_limits';
  end if;

  if has_table_privilege('anon', 'public.sonara_auth_rate_limits', 'SELECT')
     or has_table_privilege('authenticated', 'public.sonara_auth_rate_limits', 'SELECT') then
    raise exception 'anon or authenticated can read public.sonara_auth_rate_limits; the counter table must stay closed';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sonara_auth_rate_limits' and c.relrowsecurity
  ) then
    raise exception 'public.sonara_auth_rate_limits must keep row level security enabled';
  end if;
end $$;

-- PROPOSAL ONLY: not a migration; DO NOT EXECUTE ON PRODUCTION from CI.
-- SONARA Industries, 2026-10-08. Generate an official migration using the
-- repository's Supabase CLI after staging preview, approval and ACL snapshot.
--
-- Background:
-- Both public.support_requests and public.feedback_reports currently grant
-- broad table privileges to anon and authenticated, while RLS policies allow
-- direct anonymous INSERT. This bypasses Express-side validation, honeypot
-- and the durable request limiter.
--
-- Preconditions:
--  1. Enumerate every caller and confirm public writes use the server
--     /contact and /support/request endpoints (and any separate feedback
--     handler is server-mediated).
--  2. Preserve signed BEFORE snapshot of pg_class.relacl and pg_policies.
--  3. Prove server-side service_role INSERT and customer reading work in staging.
--  4. Prove a direct REST insert as anon and authenticated is DENIED with 42501.
--  5. Human approval, exact-head CI, migration replay and backup/restore proof.
--
-- Do not "fix" failures by granting ALL on these tables again.

begin;

-- Remove broad browser privileges including INSERT and TRUNCATE; table RLS is
-- still enabled, but privileges should enforce the first access-control gate.
revoke all privileges on table
  public.support_requests,
  public.feedback_reports
from anon, authenticated;

-- Preserve authenticated read behavior. Existing SELECT policies still
-- restrict customer reading to auth.uid() = user_id.
grant select on table
  public.support_requests,
  public.feedback_reports
to authenticated;

-- The service_role grant remains unchanged for the existing Express server.
-- Do not add an anonymous policy or fallback write pathway.

commit;

-- Staging validation, run after the planned migration:
--
-- select c.relname,
--   has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
--   has_table_privilege('anon',c.oid,'TRUNCATE') as anon_truncate,
--   has_table_privilege('authenticated',c.oid,'INSERT') as user_insert,
--   has_table_privilege('authenticated',c.oid,'SELECT') as user_select,
--   has_table_privilege('service_role',c.oid,'INSERT') as service_insert,
--   c.relrowsecurity as rls_enabled
-- from pg_class c join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public' and c.relname in ('support_requests','feedback_reports');
--
-- Expected for both: false,false,false,true,true,true.
-- Follow with HTTP tests for /contact and /support/request on staging.
--
-- Rollback is NOT automatic. Capture the exact prior ACL entries and use an
-- approval-gated restoration restricted to proven required roles/privileges;
-- restoring blanket grants on public intake tables recreates the vulnerability.

-- P0: REAL PostgreSQL RLS probe for SONARA's cohort-reporting boundary.
-- Executed ONLY by scripts/verify-migration-replay.mjs against its disposable
-- native PostgreSQL cluster. NEVER run on a live Supabase instance.
-- Creates two synthetic organizations, a non-BYPASSRLS reporting login, and
-- temporary policy/grant fixtures; cleans up after the read-only session.
\set ON_ERROR_STOP on

-- This fixture performs CREATE ROLE, GRANT and INSERT. Never permit it to
-- start unless running as the throwaway native replay's owner over a local
-- Unix socket in the expected database. This must be evaluated BEFORE writes.
DO $replay_only$
BEGIN
  IF current_database() <> 'replay'
     OR current_user <> 'postgres'
     OR session_user <> 'postgres'
     OR inet_server_addr() IS NOT NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname = current_user AND rolsuper = true
     )
  THEN
    RAISE EXCEPTION 'cohort RLS fixture is restricted to local disposable native replay';
  END IF;
END
$replay_only$;

BEGIN;
SET LOCAL statement_timeout = '20s';

CREATE ROLE sonara_cohort_reader LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT USAGE ON SCHEMA public, auth TO sonara_cohort_reader;
GRANT SELECT ON public.organizations, public.activity_events TO sonara_cohort_reader;

INSERT INTO auth.users(id,email) VALUES
  ('c1111111-1111-4111-8111-111111111111', 'cohort-a@example.invalid'),
  ('c2222222-2222-4222-8222-222222222222', 'cohort-b@example.invalid');
INSERT INTO public.profiles(id,email) VALUES
  ('c1111111-1111-4111-8111-111111111111', 'cohort-a@example.invalid'),
  ('c2222222-2222-4222-8222-222222222222', 'cohort-b@example.invalid');
INSERT INTO public.organizations(id,name,owner_id,created_at) VALUES
  ('c3333333-3333-4333-8333-333333333333', 'Cohort fixture A', 'c1111111-1111-4111-8111-111111111111', '2026-09-01T10:00:00Z'),
  ('c4444444-4444-4444-8444-444444444444', 'Cohort fixture B', 'c2222222-2222-4222-8222-222222222222', '2026-09-01T10:00:00Z');
INSERT INTO public.activity_events(organization_id,event_type,created_at) VALUES
  ('c3333333-3333-4333-8333-333333333333', 'account.organization_created', '2026-09-01T10:00:00Z'),
  ('c3333333-3333-4333-8333-333333333333', 'creator_studio.output_downloaded', '2026-09-01T10:15:00Z'),
  ('c4444444-4444-4444-8444-444444444444', 'account.organization_created', '2026-09-01T10:00:00Z');

-- No broad USING (true) policy. A role whose membership is authorized for A
-- must NOT be able to see B even when its SQL explicitly requests B.
-- Existing policies remain intact; if any applicable permissive policy leaks
-- B to this reader, this probe FAILS rather than papering over that leak.
CREATE POLICY sonara_cohort_fixture_org
  ON public.organizations FOR SELECT TO sonara_cohort_reader
  USING (id = 'c3333333-3333-4333-8333-333333333333'::uuid);
CREATE POLICY sonara_cohort_fixture_events
  ON public.activity_events FOR SELECT TO sonara_cohort_reader
  USING (organization_id = 'c3333333-3333-4333-8333-333333333333'::uuid);
COMMIT;

-- This changes *both* session_user and current_user, unlike SET ROLE.
-- The native cluster was initialized as PostgreSQL superuser "postgres";
-- no real customer authentication or production credentials are involved.
SET SESSION AUTHORIZATION sonara_cohort_reader;
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';

DO $cohort_proof$
DECLARE
  role_record record;
BEGIN
  SELECT r.rolsuper, r.rolbypassrls INTO role_record
    FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;
  IF current_user <> 'sonara_cohort_reader'
     OR session_user <> 'sonara_cohort_reader'
     OR role_record.rolsuper IS DISTINCT FROM false
     OR role_record.rolbypassrls IS DISTINCT FROM false
     OR current_setting('transaction_read_only') <> 'on'
     OR current_setting('transaction_isolation') <> 'repeatable read'
     OR NOT row_security_active('public.organizations'::regclass)
     OR NOT row_security_active('public.activity_events'::regclass)
  THEN
    RAISE EXCEPTION 'cohort reporting role or transaction identity is not safe';
  END IF;

  IF (SELECT count(*) FROM public.organizations) <> 1
    OR (SELECT count(*) FROM public.activity_events) <> 2
  THEN RAISE EXCEPTION 'cohort reader sees wrong tenant population'; END IF;

  -- Typed roster predicates (the same form used by the application reader):
  -- A must be accessible; B must be invisible even if explicitly requested.
  IF (SELECT count(*) FROM public.organizations
        WHERE id = ANY(ARRAY['c3333333-3333-4333-8333-333333333333']::uuid[])) <> 1
    OR (SELECT count(*) FROM public.activity_events
        WHERE organization_id = ANY(ARRAY['c3333333-3333-4333-8333-333333333333']::uuid[])) <> 2
    OR (SELECT count(*) FROM public.organizations
        WHERE id = ANY(ARRAY['c4444444-4444-4444-8444-444444444444']::uuid[])) <> 0
    OR (SELECT count(*) FROM public.activity_events
        WHERE organization_id = ANY(ARRAY['c4444444-4444-4444-8444-444444444444']::uuid[])) <> 0
  THEN RAISE EXCEPTION 'cohort roster predicate exposed or lost tenant rows'; END IF;

  -- The normal SQL query, with organization/event join and time boundaries.
  IF (SELECT count(*)
        FROM public.activity_events e
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE o.created_at >= '2026-09-01T00:00:00Z'::timestamptz
          AND o.created_at < '2026-09-02T00:00:00Z'::timestamptz
          AND e.created_at <= '2026-09-15T00:00:00Z'::timestamptz
          AND e.organization_id = ANY(ARRAY[
            'c3333333-3333-4333-8333-333333333333',
            'c4444444-4444-4444-8444-444444444444']::uuid[])) <> 2
  THEN RAISE EXCEPTION 'cohort reporting join isolation failed'; END IF;
END
$cohort_proof$;

SELECT 'p0_cohort_reader_rls_snapshot_passed';
ROLLBACK;
RESET SESSION AUTHORIZATION;

-- MUTATION PROBE: show that a newly applicable permissive PUBLIC policy
-- would leak synthetic tenant B, and that the read-only cohort isolation
-- assertion above was not vacuous. All schema mutations here are rolled
-- back before cleanup. Do not leave the intentional leak in the fixture.
BEGIN;
CREATE POLICY sonara_cohort_fixture_mutant_public
  ON public.organizations FOR SELECT TO PUBLIC USING (true);
CREATE POLICY sonara_cohort_fixture_mutant_events
  ON public.activity_events FOR SELECT TO PUBLIC USING (true);
SET LOCAL ROLE sonara_cohort_reader;
DO $cohort_policy_mutation$
BEGIN
  IF (SELECT count(*) FROM public.organizations
      WHERE id = 'c4444444-4444-4444-8444-444444444444') <> 1
    OR (SELECT count(*) FROM public.activity_events
      WHERE organization_id = 'c4444444-4444-4444-8444-444444444444') <> 1
  THEN
    RAISE EXCEPTION 'cohort negative RLS guard not sensitive to a permissive policy leak';
  END IF;
END
$cohort_policy_mutation$;
ROLLBACK;

-- Cleanup is explicit even though the native replay cluster is destroyed.
-- On assertion failure psql stops, and its throwaway cluster is discarded.
BEGIN;
DROP POLICY sonara_cohort_fixture_events ON public.activity_events;
DROP POLICY sonara_cohort_fixture_org ON public.organizations;
REVOKE SELECT ON public.organizations, public.activity_events FROM sonara_cohort_reader;
REVOKE USAGE ON SCHEMA public, auth FROM sonara_cohort_reader;
-- Older migrations define the activity FK without ON DELETE CASCADE.
-- Delete dependent rows first so this fixture cleans up on every replay.
DELETE FROM public.activity_events WHERE organization_id IN
  ('c3333333-3333-4333-8333-333333333333','c4444444-4444-4444-8444-444444444444');
DELETE FROM public.organizations WHERE id IN
  ('c3333333-3333-4333-8333-333333333333','c4444444-4444-4444-8444-444444444444');
DELETE FROM public.profiles WHERE id IN
  ('c1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222');
DELETE FROM auth.users WHERE id IN
  ('c1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222');
DROP ROLE sonara_cohort_reader;
COMMIT;

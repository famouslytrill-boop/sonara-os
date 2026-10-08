-- P0: isolated, disposable PostgreSQL replay fixture.
-- NEVER execute against a live Supabase project: it inserts synthetic users
-- and temporarily grants creator_follows SELECT, then rolls back everything.
-- The native-replay harness executes this against a throwaway local cluster.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id,email) VALUES
 ('a1111111-1111-4111-8111-111111111111','rls-fixture-a@example.invalid'),
 ('b2222222-2222-4222-8222-222222222222','rls-fixture-b@example.invalid');

INSERT INTO public.organizations (id,name,company_key,created_by,owner_id) VALUES
 ('a3333333-3333-4333-8333-333333333333','RLS Fixture A','parent_admin','a1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111'),
 ('b4444444-4444-4444-8444-444444444444','RLS Fixture B','parent_admin','b2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222');

INSERT INTO public.organization_memberships (organization_id,user_id,role,status) VALUES
 ('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','owner','active'),
 ('b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','owner','active');

INSERT INTO public.device_permission_grants (user_id,capability,state) VALUES
 ('a1111111-1111-4111-8111-111111111111','camera','granted'),
 ('b2222222-2222-4222-8222-222222222222','camera','granted');

INSERT INTO public.user_preferences (user_id,language,unit_system) VALUES
 ('a1111111-1111-4111-8111-111111111111','en-US','imperial'),
 ('b2222222-2222-4222-8222-222222222222','en-US','imperial');

INSERT INTO public.creator_artist_profiles (id,artist_name,artist_key,organization_id,user_id) VALUES
 ('a5555555-5555-4555-8555-555555555555','Test Creator A','p0_rls_fixture_a','a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111'),
 ('b6666666-6666-4666-8666-666666666666','Test Creator B','p0_rls_fixture_b','b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222');

INSERT INTO public.creator_follows (artist_profile_id,follower_user_id) VALUES
 ('a5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111'),
 ('b6666666-6666-4666-8666-666666666666','b2222222-2222-4222-8222-222222222222');

-- Production has no authenticated SELECT grant on creator_follows.
-- Staging-only transactional grant lets us exercise its row predicate,
-- while the production grant is separately checked for its fail-closed posture.
DO $proof$
BEGIN
  IF has_table_privilege('authenticated','public.creator_follows','SELECT') THEN
    RAISE EXCEPTION 'creator_follows unexpectedly publicly exposed before fixture';
  END IF;
END
$proof$;
GRANT SELECT ON public.creator_follows TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $test_a$
DECLARE denied boolean;
BEGIN
  IF (SELECT count(*) FROM public.organizations) <> 1
     OR (SELECT count(*) FROM public.organization_memberships) <> 1
     OR (SELECT count(*) FROM public.device_permission_grants) <> 1
     OR (SELECT count(*) FROM public.user_preferences) <> 1
     OR (SELECT count(*) FROM public.creator_follows) <> 1
  THEN RAISE EXCEPTION 'user A cross-tenant read isolation failed'; END IF;

  IF NOT public.is_org_member('a3333333-3333-4333-8333-333333333333')
     OR public.is_org_member('b4444444-4444-4444-8444-444444444444')
     OR NOT public.sonara_is_org_member('a3333333-3333-4333-8333-333333333333')
     OR public.sonara_is_org_member('b4444444-4444-4444-8444-444444444444')
     OR NOT public.is_org_owner_or_admin('a3333333-3333-4333-8333-333333333333')
     OR public.is_org_owner_or_admin('b4444444-4444-4444-8444-444444444444')
  THEN RAISE EXCEPTION 'privileged organization helper did not enforce user A'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.device_permission_grants(user_id,capability,state)
      VALUES ('b2222222-2222-4222-8222-222222222222','microphone','granted');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'user A could insert device grant belonging to B'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.organizations (name,company_key)
      VALUES ('Forged Organization','parent_admin');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'authenticated user could directly create an organization'; END IF;
END
$test_a$;

-- Positive INSERT must genuinely work. A deny-only fixture can otherwise
-- pass on tables whose grants accidentally block everyone.
INSERT INTO public.device_permission_grants(user_id,capability,state)
VALUES ('a1111111-1111-4111-8111-111111111111','microphone','granted');
INSERT INTO public.user_preferences(user_id,language,unit_system)
VALUES ('a1111111-1111-4111-8111-111111111111','es','metric')
ON CONFLICT (user_id) DO UPDATE SET language=excluded.language,unit_system=excluded.unit_system;
DO $test_a_writes$
BEGIN
  IF (SELECT count(*) FROM public.device_permission_grants) <> 2
    OR (SELECT language FROM public.user_preferences LIMIT 1) <> 'es'
  THEN RAISE EXCEPTION 'user A ownership-positive writes failed'; END IF;
  UPDATE public.user_preferences SET language='fr'
    WHERE user_id='b2222222-2222-4222-8222-222222222222';
  IF FOUND THEN RAISE EXCEPTION 'user A updated user B preferences'; END IF;
  DELETE FROM public.user_preferences WHERE user_id='a1111111-1111-4111-8111-111111111111';
  IF FOUND THEN RAISE EXCEPTION 'user A deleted own preferences without DELETE policy'; END IF;
  UPDATE public.organizations SET name='Illegal Rename'
    WHERE id='b4444444-4444-4444-8444-444444444444';
  IF FOUND THEN RAISE EXCEPTION 'user A updated organization B'; END IF;
END
$test_a_writes$;

SELECT set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
DO $test_b$
BEGIN
  IF (SELECT count(*) FROM public.organizations) <> 1
    OR (SELECT count(*) FROM public.organization_memberships) <> 1
    OR (SELECT count(*) FROM public.creator_follows) <> 1
    OR (SELECT count(*) FROM public.device_permission_grants) <> 1
    OR (SELECT count(*) FROM public.user_preferences) <> 1
  THEN RAISE EXCEPTION 'user B cross-tenant read isolation failed'; END IF;
  IF NOT public.is_org_member('b4444444-4444-4444-8444-444444444444')
    OR public.is_org_member('a3333333-3333-4333-8333-333333333333')
  THEN RAISE EXCEPTION 'privileged organization helper did not enforce user B'; END IF;
END
$test_b$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','anon',true);
DO $test_anon$
DECLARE blocked boolean;
BEGIN
  blocked := false;
  BEGIN PERFORM count(*) FROM public.organizations;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'anon could read private organizations'; END IF;

  blocked := false;
  BEGIN
    INSERT INTO public.device_permission_grants(user_id,capability,state)
      VALUES ('a1111111-1111-4111-8111-111111111111','location','granted');
  EXCEPTION WHEN insufficient_privilege THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'anon could create user device grant'; END IF;
END
$test_anon$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $test_service$
BEGIN
  IF (SELECT count(*) FROM public.organizations) <> 2
    OR (SELECT count(*) FROM public.device_permission_grants) <> 3
    OR (SELECT count(*) FROM public.creator_follows) <> 2
  THEN RAISE EXCEPTION 'service role lost server-only bypass or fixture counts'; END IF;
END
$test_service$;
RESET ROLE;

SELECT 'p0_auth_rls_matrix_staging_passed';
ROLLBACK;

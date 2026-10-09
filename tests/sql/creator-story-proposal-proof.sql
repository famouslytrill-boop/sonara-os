-- Creator Phase 9: ONLY in a freshly cloned, disposable PostgreSQL replay.
-- Parent World Bible and story SQL proposals must have been applied to this
-- disposable copy, NEVER to production or the canonical replay database.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $privileges$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.creator_world_bibles'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.creator_story_drafts'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.creator_story_draft_revisions'::regclass)
    THEN RAISE EXCEPTION 'Creator RLS is not enabled on all three proposed tables'; END IF;
  IF has_table_privilege('anon','public.creator_world_bibles','SELECT')
    OR has_table_privilege('anon','public.creator_story_drafts','SELECT')
    OR has_table_privilege('authenticated','public.creator_story_drafts','SELECT')
    OR has_table_privilege('authenticated','public.creator_story_draft_revisions','INSERT')
    OR has_table_privilege('service_role','public.creator_story_draft_revisions','UPDATE')
    OR has_table_privilege('service_role','public.creator_story_draft_revisions','DELETE')
    OR NOT has_table_privilege('authenticated','public.creator_world_bibles','SELECT')
    OR NOT has_table_privilege('service_role','public.creator_story_drafts','INSERT')
    OR NOT has_table_privilege('service_role','public.creator_story_draft_revisions','INSERT')
    THEN RAISE EXCEPTION 'Creator table grants do not match least-privilege proposal'; END IF;
  IF has_function_privilege('anon',
    'public.sonara_save_story_draft(uuid,uuid,uuid,bigint,text,text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated',
      'public.sonara_save_story_draft(uuid,uuid,uuid,bigint,text,text,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role',
      'public.sonara_save_story_draft(uuid,uuid,uuid,bigint,text,text,jsonb)','EXECUTE')
    THEN RAISE EXCEPTION 'Creator RPC exposed to a client role or withheld from service_role'; END IF;
  IF (SELECT prosecdef FROM pg_proc
    WHERE oid='public.sonara_save_story_draft(uuid,uuid,uuid,bigint,text,text,jsonb)'::regprocedure)
    THEN RAISE EXCEPTION 'Creator RPC must be SECURITY INVOKER'; END IF;
END $privileges$;

-- Match the already-replayed auth, profiles and organization FK requirements.
INSERT INTO auth.users (id,email) VALUES
 ('a1111111-1111-4111-8111-111111111112','story-a@example.invalid'),
 ('b2222222-2222-4222-8222-222222222223','story-b@example.invalid');
INSERT INTO public.profiles (id,email) VALUES
 ('a1111111-1111-4111-8111-111111111112','story-a@example.invalid'),
 ('b2222222-2222-4222-8222-222222222223','story-b@example.invalid');
INSERT INTO public.organizations (id,name,owner_id) VALUES
 ('a3333333-3333-4333-8333-333333333334','Story Test Org A','a1111111-1111-4111-8111-111111111112'),
 ('b4444444-4444-4444-8444-444444444445','Story Test Org B','b2222222-2222-4222-8222-222222222223');
INSERT INTO public.organization_memberships (organization_id,user_id,role,status) VALUES
 ('a3333333-3333-4333-8333-333333333334','a1111111-1111-4111-8111-111111111112','owner','active'),
 ('b4444444-4444-4444-8444-444444444445','b2222222-2222-4222-8222-222222222223','owner','active');

INSERT INTO public.creator_projects (id,organization_id,user_id,title,medium) VALUES
 ('a5555555-5555-4555-8555-555555555556','a3333333-3333-4333-8333-333333333334',
  'a1111111-1111-4111-8111-111111111112','Story A','mixed'),
 ('b6666666-6666-4666-8666-666666666667','b4444444-4444-4444-8444-444444444445',
  'b2222222-2222-4222-8222-222222222223','Story B','mixed');
INSERT INTO public.creator_world_bibles
  (project_id,organization_id,last_editor_id,draft,fingerprint) VALUES
 ('a5555555-5555-4555-8555-555555555556','a3333333-3333-4333-8333-333333333334',
  'a1111111-1111-4111-8111-111111111112',
  '{"title":"Story A","medium":"game","entities":[],"scenes":[{"id":"intro","title":"Opening"}],"resources":{}}'::jsonb,
  repeat('a',64)),
 ('b6666666-6666-4666-8666-666666666667','b4444444-4444-4444-8444-444444444445',
  'b2222222-2222-4222-8222-222222222223',
  '{"title":"Story B","medium":"game","entities":[],"scenes":[{"id":"intro","title":"Other"}],"resources":{}}'::jsonb,
  repeat('a',64));

-- World Bible authenticated SELECT policy is tenant-restricted, not a public
-- list. The service-only story tables never accept direct browser reads.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111112',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $tenant$
BEGIN
  IF (SELECT count(*) FROM public.creator_world_bibles) <> 1
    OR (SELECT count(*) FROM public.creator_world_bibles
       WHERE organization_id='b4444444-4444-4444-8444-444444444445') <> 0
    THEN RAISE EXCEPTION 'Creator World Bible cross-tenant read permitted'; END IF;
END $tenant$;
RESET ROLE;
SET LOCAL ROLE service_role;

DO $story$
DECLARE
  v_org uuid := 'a3333333-3333-4333-8333-333333333334';
  v_project uuid := 'a5555555-5555-4555-8555-555555555556';
  v_user uuid := 'a1111111-1111-4111-8111-111111111112';
  v_other_org uuid := 'b4444444-4444-4444-8444-444444444445';
  v_story jsonb := jsonb_build_object(
    'schema','sonara.interactive-story.v1','version',1,
    'worldFingerprint',repeat('a',64),'startSceneId','intro',
    'state',jsonb_build_array(),
    'scenes',jsonb_build_array(jsonb_build_object(
      'sceneId','intro','prose','Author version one',
      'dialogue',jsonb_build_array(),'choices',jsonb_build_array())));
  v_row record;
  v_conflict boolean;
BEGIN
  SELECT * INTO v_row FROM public.sonara_save_story_draft(
    v_project,v_org,v_user,0,repeat('a',64),repeat('b',64),v_story);
  IF v_row.revision <> 1 THEN RAISE EXCEPTION 'first saved draft revision is not one'; END IF;
  v_conflict := false;
  BEGIN
    PERFORM * FROM public.sonara_save_story_draft(
      v_project,v_org,v_user,0,repeat('a',64),repeat('b',64),v_story);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN v_conflict := true;
  END;
  IF NOT v_conflict THEN RAISE EXCEPTION 'stale first-write CAS unexpectedly succeeded'; END IF;
  v_conflict := false;
  BEGIN
    PERFORM * FROM public.sonara_save_story_draft(
      v_project,v_other_org,v_user,1,repeat('a',64),repeat('b',64),v_story);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN v_conflict := true;
  END;
  IF NOT v_conflict THEN RAISE EXCEPTION 'cross-tenant RPC write unexpectedly succeeded'; END IF;

  v_story := jsonb_set(v_story,'{scenes,0,prose}','"Author version two"'::jsonb);
  SELECT * INTO v_row FROM public.sonara_save_story_draft(
    v_project,v_org,v_user,1,repeat('a',64),repeat('c',64),v_story);
  IF v_row.revision <> 2 OR v_row.fingerprint <> repeat('c',64)
     OR (SELECT count(*) FROM public.creator_story_draft_revisions WHERE project_id=v_project) <> 2
     OR (SELECT story #>> '{scenes,0,prose}' FROM public.creator_story_draft_revisions
         WHERE project_id=v_project AND revision=1) <> 'Author version one'
     OR (SELECT story #>> '{scenes,0,prose}' FROM public.creator_story_drafts
         WHERE project_id=v_project) <> 'Author version two'
    THEN RAISE EXCEPTION 'append-only historical revision or latest snapshot mismatch'; END IF;

  -- World Bible fingerprint changes must prevent updates of old scripts.
  UPDATE public.creator_world_bibles SET fingerprint=repeat('d',64)
    WHERE project_id=v_project;
  v_conflict := false;
  BEGIN
    PERFORM * FROM public.sonara_save_story_draft(
      v_project,v_org,v_user,2,repeat('a',64),repeat('e',64),v_story);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN v_conflict := true;
  END;
  IF NOT v_conflict THEN RAISE EXCEPTION 'World Bible drift was not rejected'; END IF;
  UPDATE public.creator_world_bibles SET fingerprint=repeat('a',64)
    WHERE project_id=v_project;

  -- Archive closes the write path; even direct World Bible updates must
  -- reject an archived parent via the row-locking trigger.
  UPDATE public.creator_projects SET archived_at=now() WHERE id=v_project;
  v_conflict := false;
  BEGIN
    PERFORM * FROM public.sonara_save_story_draft(
      v_project,v_org,v_user,2,repeat('a',64),repeat('e',64),v_story);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN v_conflict := true;
  END;
  IF NOT v_conflict THEN RAISE EXCEPTION 'archived project accepted story revision'; END IF;
  v_conflict := false;
  BEGIN
    UPDATE public.creator_world_bibles SET fingerprint=repeat('e',64)
      WHERE project_id=v_project;
  EXCEPTION WHEN foreign_key_violation THEN v_conflict := true;
  END;
  IF NOT v_conflict THEN RAISE EXCEPTION 'archived project accepted World Bible write'; END IF;
  IF (SELECT count(*) FROM public.creator_story_draft_revisions WHERE project_id=v_project) <> 2
    THEN RAISE EXCEPTION 'refused writes left a history row behind'; END IF;
END $story$;

SELECT 'creator_story_proposal_privileges_rls_cas_archive_passed';
ROLLBACK;

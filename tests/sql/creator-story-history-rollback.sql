-- Disposable PostgreSQL clone only. Simulates append-only history failure
-- by removing one service_role GRANT inside a rolled-back transaction.
\set ON_ERROR_STOP on
BEGIN;
REVOKE INSERT ON public.creator_story_draft_revisions FROM service_role;
SET LOCAL ROLE service_role;

DO $rollback$
DECLARE
  v_denied boolean := false;
  v_project uuid := 'c3333333-3333-4333-8333-333333333333';
  v_org uuid := 'c2222222-2222-4222-8222-222222222222';
  v_user uuid := 'c1111111-1111-4111-8111-111111111111';
  v_story jsonb := jsonb_build_object(
    'schema','sonara.interactive-story.v1','version',1,
    'worldFingerprint',repeat('a',64),'startSceneId','intro',
    'state',jsonb_build_array(),
    'scenes',jsonb_build_array(jsonb_build_object(
      'sceneId','intro','prose','Attempted second revision',
      'dialogue',jsonb_build_array(),'choices',jsonb_build_array())));
BEGIN
  BEGIN
    PERFORM * FROM public.sonara_save_story_draft(
      v_project,v_org,v_user,1,repeat('a',64),repeat('d',64),v_story);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'historical revision INSERT failure did not abort RPC';
  END IF;
  IF (SELECT count(*) FROM public.creator_story_drafts WHERE project_id=v_project
       AND revision=1) <> 1
    OR (SELECT count(*) FROM public.creator_story_draft_revisions
        WHERE project_id=v_project) <> 1
    OR (SELECT count(*) FROM public.creator_story_draft_revisions
        WHERE project_id=v_project AND revision=2) <> 0
    THEN RAISE EXCEPTION 'failed revision-history insert committed a partial latest draft';
  END IF;
END $rollback$;
RESET ROLE;
SELECT 'creator_story_history_failure_rolls_back_latest';
ROLLBACK;

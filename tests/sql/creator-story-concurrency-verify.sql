-- Only for disposable clone after two independent psql connections raced.
\set ON_ERROR_STOP on
DO $race_verify$
DECLARE
  v_project uuid := 'c3333333-3333-4333-8333-333333333333';
BEGIN
  IF (SELECT count(*) FROM public.creator_story_drafts WHERE project_id=v_project) <> 1
    OR (SELECT revision FROM public.creator_story_drafts WHERE project_id=v_project) <> 1
    OR (SELECT count(*) FROM public.creator_story_draft_revisions WHERE project_id=v_project) <> 1
    OR (SELECT revision FROM public.creator_story_draft_revisions WHERE project_id=v_project) <> 1
    OR (SELECT fingerprint FROM public.creator_story_drafts WHERE project_id=v_project)
      IS DISTINCT FROM (SELECT fingerprint FROM public.creator_story_draft_revisions
        WHERE project_id=v_project)
    THEN RAISE EXCEPTION 'concurrent CAS created duplicate or inconsistent Creator revisions';
  END IF;
END $race_verify$;
SELECT 'creator_two_connections_one_history_revision';

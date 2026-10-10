-- Strictly disposable clone only; commits synthetic fixtures for TWO
-- independent PostgreSQL sessions to race. Cluster is torn down after replay.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id,email) VALUES
 ('c1111111-1111-4111-8111-111111111111','race-creator@example.invalid');
INSERT INTO public.profiles (id,email) VALUES
 ('c1111111-1111-4111-8111-111111111111','race-creator@example.invalid');
INSERT INTO public.organizations (id,name,owner_id) VALUES
 ('c2222222-2222-4222-8222-222222222222','Race Creator Organization',
  'c1111111-1111-4111-8111-111111111111');
INSERT INTO public.creator_projects (id,organization_id,user_id,title,medium) VALUES
 ('c3333333-3333-4333-8333-333333333333',
  'c2222222-2222-4222-8222-222222222222',
  'c1111111-1111-4111-8111-111111111111',
  'Race story','mixed');
INSERT INTO public.creator_world_bibles
 (project_id,organization_id,last_editor_id,draft,fingerprint)
 VALUES (
 'c3333333-3333-4333-8333-333333333333',
 'c2222222-2222-4222-8222-222222222222',
 'c1111111-1111-4111-8111-111111111111',
 '{"title":"Race story","medium":"game","entities":[],"scenes":[{"id":"intro","title":"Opening"}],"resources":{}}'::jsonb,
 repeat('a',64)
);
COMMIT;
SELECT 'creator_race_fixture_ready';

-- PROPOSED pgTAP acceptance tests. NOT RUN; do not place in supabase/tests
-- until the reviewed migration has been generated and applied locally.
-- Copy into supabase/tests/database ONLY after isolated Postgres migration replay.
-- supabase test db must execute this with pgTAP enabled on the local test DB.
-- All checks are read-only and transaction-wrapped.
begin;
select plan(22);
select ok(to_regclass('public.growth_channel_blocks') is not null, 'channel blocks table exists');
select ok(to_regclass('public.growth_channel_moderation_events') is not null, 'moderation audit table exists');
select ok(to_regprocedure('public.sonara_growth_channel_block_action(uuid,uuid,text)') is not null, 'bounded atomic block function exists');
select ok(to_regprocedure('public.sonara_moderate_growth_post(uuid,uuid,uuid,text)') is not null, 'atomic moderator function exists');
select ok((select c.relrowsecurity from pg_class c where c.oid=to_regclass('public.growth_channel_blocks')), 'channel block RLS enabled');
select ok((select c.relrowsecurity from pg_class c where c.oid=to_regclass('public.growth_channel_moderation_events')), 'moderation audit RLS enabled');
select ok(not has_table_privilege('anon','public.growth_channel_blocks','SELECT'), 'anonymous clients cannot read blocks');
select ok(not has_table_privilege('authenticated','public.growth_channel_blocks','SELECT'), 'signed-in browser cannot read blocks directly');
select ok(not has_table_privilege('authenticated','public.growth_channel_blocks','INSERT'), 'signed-in browser cannot forge blocks');
select ok(not has_table_privilege('authenticated','public.growth_channel_blocks','DELETE'), 'signed-in browser cannot remove another person''s blocks');
select ok(not has_table_privilege('anon','public.growth_channel_moderation_events','SELECT'), 'anonymous clients cannot read moderator audit');
select ok(not has_table_privilege('authenticated','public.growth_channel_moderation_events','SELECT'), 'signed-in browser cannot read moderator identities');
select ok(not has_table_privilege('service_role','public.growth_channel_moderation_events','UPDATE'), 'service role cannot rewrite moderator history');
select ok(not has_table_privilege('service_role','public.growth_channel_moderation_events','DELETE'), 'service role cannot erase moderator history');
select ok(not has_function_privilege('anon','public.sonara_growth_channel_block_action(uuid,uuid,text)','EXECUTE'), 'anonymous cannot execute channel block RPC');
select ok(not has_function_privilege('authenticated','public.sonara_growth_channel_block_action(uuid,uuid,text)','EXECUTE'), 'browser cannot execute channel block RPC');
select ok(has_function_privilege('service_role','public.sonara_growth_channel_block_action(uuid,uuid,text)','EXECUTE'), 'service role can run verified block RPC');
select ok(not has_function_privilege('anon','public.sonara_moderate_growth_post(uuid,uuid,uuid,text)','EXECUTE'), 'anonymous cannot moderate posts');
select ok(not has_function_privilege('authenticated','public.sonara_moderate_growth_post(uuid,uuid,uuid,text)','EXECUTE'), 'signed-in browser cannot self-moderate');
select ok((select count(*)=0 from pg_policies where schemaname='public' and tablename in ('growth_channel_blocks','growth_channel_moderation_events')), 'private tables do not have public-facing policies');
select is(public.sonara_growth_channel_block_action(NULL::uuid, NULL::uuid, 'block'), 'denied', 'missing actor and channel are denied');
select is(public.sonara_moderate_growth_post(NULL::uuid, NULL::uuid, NULL::uuid, 'remove'), false, 'missing moderator tenant and actor are denied');
select * from finish();
rollback;

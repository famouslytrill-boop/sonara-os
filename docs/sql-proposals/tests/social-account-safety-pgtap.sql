-- REVIEW ONLY — NOT EXECUTED. Run after an isolated numbered migration is applied.
-- Prepared pgTAP privacy, ACL, and denial proofs. These do not replace
-- concurrency/locking, end-to-end session, or report escalation tests.
-- Do not move into supabase/tests until the proposed schema is installed in a
-- throwaway/local database; never run this against production.
begin;
select plan(33);
select ok(to_regclass('public.sonara_social_user_blocks') is not null, 'account blocks table exists');
select ok(to_regclass('public.sonara_social_profile_reports') is not null, 'profile reports table exists');
select ok(to_regclass('public.sonara_social_moderator_grants') is not null, 'independent reviewer grants table exists');
select ok(to_regclass('public.sonara_social_report_review_events') is not null, 'append-only decisions table exists');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.sonara_social_user_blocks')), 'account block row security enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.sonara_social_profile_reports')), 'profile report row security enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.sonara_social_moderator_grants')), 'independent reviewer roster row security enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.sonara_social_report_review_events')), 'review history row security enabled');
select ok(not has_table_privilege('anon','public.sonara_social_user_blocks','SELECT'), 'anonymous blocked relationships remain private');
select ok(not has_table_privilege('authenticated','public.sonara_social_user_blocks','SELECT'), 'authenticated browser cannot enumerate blocks');
select ok(not has_table_privilege('authenticated','public.sonara_social_profile_reports','SELECT'), 'authenticated browser cannot read reporter data');
select ok(not has_table_privilege('authenticated','public.sonara_social_profile_reports','INSERT'), 'browser cannot forge profile reports');
select ok(not has_table_privilege('anon','public.sonara_social_moderator_grants','SELECT'), 'anonymous browser cannot enumerate reviewers');
select ok(not has_table_privilege('authenticated','public.sonara_social_moderator_grants','SELECT'), 'signed-in browser cannot enumerate reviewers');
select ok(not has_table_privilege('service_role','public.sonara_social_moderator_grants','UPDATE'), 'application service-role cannot grant moderator power');
select ok(not has_table_privilege('service_role','public.sonara_social_moderator_grants','INSERT'), 'application service-role cannot provision moderators');
select ok(not has_table_privilege('service_role','public.sonara_social_profile_reports','DELETE'), 'application cannot delete report evidence');
select ok(not has_table_privilege('service_role','public.sonara_social_report_review_events','UPDATE'), 'application cannot rewrite decisions');
select ok(not has_table_privilege('service_role','public.sonara_social_report_review_events','DELETE'), 'application cannot erase decisions');
select ok(to_regprocedure('public.sonara_social_profile_action(uuid,uuid,text,text,text,uuid)') is not null, 'account action RPC exists');
select ok(to_regprocedure('public.sonara_social_decide_report(uuid,uuid,text,text)') is not null, 'review decision RPC exists');
select ok(to_regprocedure('public.sonara_social_moderation_queue(uuid,integer)') is not null, 'independent report queue RPC exists');
select ok(not has_function_privilege('anon','public.sonara_social_decide_report(uuid,uuid,text,text)','EXECUTE'), 'anonymous cannot approve review decisions');
select ok(not has_function_privilege('authenticated','public.sonara_social_decide_report(uuid,uuid,text,text)','EXECUTE'), 'browser cannot approve review decisions');
select ok(has_function_privilege('service_role','public.sonara_social_decide_report(uuid,uuid,text,text)','EXECUTE'), 'trusted server can call audited decision RPC');
select ok(not has_function_privilege('authenticated','public.sonara_social_profile_action(uuid,uuid,text,text,text,uuid)','EXECUTE'), 'browser cannot impersonate an actor via account action RPC');
select ok(not has_function_privilege('anon','public.sonara_social_moderation_queue(uuid,integer)','EXECUTE'), 'anonymous cannot inspect independent moderation queue');
select ok((select count(*)=0 from pg_policies where schemaname='public' and tablename in ('sonara_social_user_blocks','sonara_social_profile_reports','sonara_social_moderator_grants','sonara_social_report_review_events')), 'no browser-facing RLS policies expose safety data');
select ok(exists (select 1 from pg_trigger t where t.tgrelid=to_regclass('public.creator_follows') and t.tgname='sonara_creator_follow_block_guard' and not t.tgisinternal), 'follow insert enforcement trigger installed');
select ok(coalesce((select pg_get_expr(d.adbin,d.adrelid) = 'false' from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid=to_regclass('public.sonara_social_moderator_grants') and a.attname='active'),false), 'moderator grants default inactive');
select is(public.sonara_social_profile_action(null::uuid,null::uuid,'block'), 'denied', 'missing account actor cannot mutate a user block');
select is(public.sonara_social_decide_report(null::uuid,null::uuid,'dismiss','test'), 'denied', 'unknown reviewer cannot create a moderation verdict');
select is((public.sonara_social_moderation_queue(null::uuid, 20) ->> 'authorized')::boolean, false, 'unprovisioned reviewer cannot read cross-tenant reports');
select * from finish();
rollback;

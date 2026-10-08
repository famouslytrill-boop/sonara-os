-- Native disposable PostgreSQL fixture. Synthetic job and grants rollback.
BEGIN;
DO $roles$
BEGIN
 IF has_schema_privilege('anon','sonara_private','USAGE')
    OR has_schema_privilege('authenticated','sonara_private','USAGE')
    OR has_table_privilege('service_role','sonara_private.autonomic_execution_control','UPDATE')
    OR has_table_privilege('authenticated','sonara_private.autonomic_execution_grants','SELECT')
    OR has_function_privilege('anon',
       'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)','EXECUTE')
    OR NOT has_function_privilege('service_role',
       'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'operator gate privileges leak'; END IF;
END;
$roles$;

-- Seed a synthetic already-started job only in this rolled-back fixture.
INSERT INTO sonara_private.autonomic_retry_jobs
  (id,dedupe_key,resource_key,organization_id,operation_id,incident_id,
   attempt,not_before,deadline_at,state,claim_token,fencing_token,started_at)
VALUES (
 '55555555-5555-4555-8555-555555555555',
 'gate-fixture-dedupe',
 '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-optional"]',
 '11111111-1111-4111-8111-111111111111',
 'gate-fixture-operation','gate-fixture-incident',0,
 clock_timestamp()-interval '5 seconds',
 clock_timestamp()+interval '1 hour',
 'started','22222222-2222-4222-8222-222222222222',4,clock_timestamp()
);
SET LOCAL ROLE service_role;
DO $default_deny$
BEGIN
 IF public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',4)
 THEN RAISE EXCEPTION 'default gate unexpectedly enabled'; END IF;
END;
$default_deny$;
RESET ROLE;

-- Prove both global switch and approved specific tenant/resource are needed.
UPDATE sonara_private.autonomic_execution_control
SET enabled=true,updated_at=clock_timestamp() WHERE singleton;
SET LOCAL ROLE service_role;
DO $no_grant$
BEGIN
 IF public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',4)
 THEN RAISE EXCEPTION 'global enabled without tenant approval'; END IF;
END;
$no_grant$;
RESET ROLE;

INSERT INTO sonara_private.autonomic_execution_grants
 (organization_id,resource_key,allowed,requested_by,approved_by,approved_at,expires_at)
VALUES (
 '11111111-1111-4111-8111-111111111111',
 '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-optional"]',
 true,'fixture-requester','fixture-reviewer',clock_timestamp()-interval '1 minute',
 clock_timestamp()+interval '1 hour'
);
SET LOCAL ROLE service_role;
DO $allow$
BEGIN
 IF NOT public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',4)
 THEN RAISE EXCEPTION 'approved fenced job was denied'; END IF;
 IF public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '33333333-3333-4333-8333-333333333333',4)
    OR public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',3)
 THEN RAISE EXCEPTION 'stale claim/fence authorized'; END IF;
END;
$allow$;
RESET ROLE;

UPDATE sonara_private.autonomic_execution_control SET enabled=false WHERE singleton;
SET LOCAL ROLE service_role;
DO $kill$
BEGIN
 IF public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',4)
 THEN RAISE EXCEPTION 'global pause was bypassed'; END IF;
END;
$kill$;
RESET ROLE;

UPDATE sonara_private.autonomic_execution_control SET enabled=true WHERE singleton;
UPDATE sonara_private.autonomic_execution_grants
 SET approved_at=clock_timestamp()-interval '2 hours',
     expires_at=clock_timestamp()-interval '1 hour'
 WHERE requested_by='fixture-requester';
SET LOCAL ROLE service_role;
DO $expired$
BEGIN
 IF public.sonara_autonomic_execution_permitted(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',4)
 THEN RAISE EXCEPTION 'expired tenant approval bypassed'; END IF;
END;
$expired$;
RESET ROLE;
SELECT 'sonara_autonomic_operator_gate_native_passed' AS proof;
ROLLBACK;

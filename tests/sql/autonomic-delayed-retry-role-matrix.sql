-- Read/write behavior on disposable PostgreSQL only. The whole fixture
-- rolls back; never run against a customer or production database.
BEGIN;
DO $privileges$
BEGIN
  IF has_schema_privilege('anon','sonara_private','USAGE')
     OR has_schema_privilege('authenticated','sonara_private','USAGE')
     OR has_function_privilege('anon','public.sonara_schedule_autonomic_retry(text,uuid,text,text,integer,text,timestamptz,timestamptz)','EXECUTE')
     OR has_function_privilege('authenticated','public.sonara_claim_due_autonomic_retry()','EXECUTE')
     OR has_function_privilege('authenticated','public.sonara_complete_autonomic_retry(uuid,uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'delayed repair grants allow browser roles'; END IF;
END;
$privileges$;

SET LOCAL ROLE service_role;
DO $schedule$
DECLARE
  k text := '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-mail"]';
  d text := '["[\"organization\",\"11111111-1111-4111-8111-111111111111\",\"retry_idempotent\",\"fixture-mail\"]","operation-1",0]';
  scheduled record;
  second record;
BEGIN
  SELECT * INTO scheduled FROM public.sonara_schedule_autonomic_retry(
    k, '11111111-1111-4111-8111-111111111111','operation-1','incident-1',
    0,d,clock_timestamp()+interval '15 seconds',clock_timestamp()+interval '1 hour');
  IF scheduled.persisted IS DISTINCT FROM true OR scheduled.duplicate THEN
    RAISE EXCEPTION 'first delayed job not stored';
  END IF;
  IF EXISTS(SELECT 1 FROM public.sonara_claim_due_autonomic_retry()) THEN
    RAISE EXCEPTION 'early execution before persisted due time';
  END IF;
  SELECT * INTO second FROM public.sonara_schedule_autonomic_retry(
    k, '11111111-1111-4111-8111-111111111111','operation-1','incident-2',
    0,d,clock_timestamp()+interval '18 seconds',clock_timestamp()+interval '1 hour');
  IF second.duplicate IS DISTINCT FROM true OR second.persisted THEN
    RAISE EXCEPTION 'same job scheduled twice';
  END IF;
  -- A changed attempt number must not create another in-flight recovery for
  -- the same operation; UNIQUE (organization_id,operation_id) enforces this.
  BEGIN
    PERFORM public.sonara_schedule_autonomic_retry(
      k, '11111111-1111-4111-8111-111111111111', 'operation-1','incident-other',
      1, jsonb_build_array(k, 'operation-1', 1)::text,
      clock_timestamp()+interval '15 seconds',clock_timestamp()+interval '1 hour');
    RAISE EXCEPTION 'attempt-number bypass created concurrent job';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- Required denial of cross-attempt duplicate.
  END;
  SELECT * INTO second FROM public.sonara_schedule_autonomic_retry(
    k, '22222222-2222-4222-8222-222222222222','operation-1','incident-2',
    0,d,clock_timestamp()+interval '15 seconds',clock_timestamp()+interval '1 hour');
  IF second.persisted OR second.duplicate THEN
    RAISE EXCEPTION 'cross-tenant forged resource accepted';
  END IF;
END;
$schedule$;
RESET ROLE;

-- Move the synthetic job clock forward without waiting 15 seconds. This
-- shortens *only the fixture*, not any production job or policy constraint.
UPDATE sonara_private.autonomic_retry_jobs
  SET not_before=clock_timestamp()-interval '2 seconds'
  WHERE operation_id='operation-1' AND organization_id='11111111-1111-4111-8111-111111111111';

SET LOCAL ROLE service_role;
DO $claim$
DECLARE
  c record;
  empty_claim record;
BEGIN
  SELECT * INTO c FROM public.sonara_claim_due_autonomic_retry();
  IF c.job_id IS NULL OR c.claim_token IS NULL OR c.fencing_token <> 1 OR
     c.organization_id <> '11111111-1111-4111-8111-111111111111'::uuid THEN
    RAISE EXCEPTION 'due job was not exclusively claimed with a token';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sonara_claim_due_autonomic_retry()) THEN
    RAISE EXCEPTION 'started job was reclaimed';
  END IF;
  IF public.sonara_complete_autonomic_retry(c.job_id,
    '33333333-3333-4333-8333-333333333333','verified') THEN
    RAISE EXCEPTION 'stale/missing token accepted';
  END IF;
  IF NOT public.sonara_complete_autonomic_retry(c.job_id,c.claim_token,'verified') THEN
    RAISE EXCEPTION 'valid terminal verification refused';
  END IF;
  IF public.sonara_complete_autonomic_retry(c.job_id,c.claim_token,'verified') THEN
    RAISE EXCEPTION 'terminal outcome rewritten';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sonara_claim_due_autonomic_retry()) THEN
    RAISE EXCEPTION 'verified job was replayed';
  END IF;
END;
$claim$;
RESET ROLE;
DO $events$
BEGIN
  IF (SELECT count(*) FROM sonara_private.autonomic_retry_events
      WHERE job_id IN (SELECT id FROM sonara_private.autonomic_retry_jobs
                       WHERE operation_id='operation-1')) <> 3 THEN
    RAISE EXCEPTION 'queued/started/verified audit chain incomplete';
  END IF;
END;
$events$;
SELECT 'sonara_delayed_retry_native_passed' AS proof;
ROLLBACK;

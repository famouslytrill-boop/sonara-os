-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Durable due-time admission for optional idempotent provider retries only.
-- Definition only: no cron, route, worker, extension or production activation.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE sonara_private.autonomic_retry_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  resource_key text NOT NULL,
  organization_id uuid NOT NULL,
  operation_id text NOT NULL,
  incident_id text NOT NULL,
  attempt smallint NOT NULL CHECK (attempt BETWEEN 0 AND 2),
  not_before timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','started','verified','unverified','failed')),
  claim_token uuid,
  fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (length(dedupe_key) BETWEEN 1 AND 2048),
  CHECK (length(resource_key) BETWEEN 1 AND 1024),
  CHECK (length(operation_id) BETWEEN 1 AND 128),
  CHECK (length(incident_id) BETWEEN 1 AND 128),
  CHECK (deadline_at > not_before + interval '1 second'),
  -- One immutable retry envelope per tenant+operation across all attempts.
  -- A changed attempt number cannot evade the duplicate safety budget.
  UNIQUE (organization_id, operation_id)
);
CREATE INDEX autonomic_retry_due_idx
  ON sonara_private.autonomic_retry_jobs (not_before, id) WHERE state = 'queued';

CREATE TABLE sonara_private.autonomic_retry_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES sonara_private.autonomic_retry_jobs(id),
  event_type text NOT NULL CHECK (event_type IN ('queued','started','verified','unverified','failed')),
  claim_token uuid,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (job_id, event_type)
);
ALTER TABLE sonara_private.autonomic_retry_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sonara_private.autonomic_retry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sonara_private.autonomic_retry_jobs, sonara_private.autonomic_retry_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE sonara_private.autonomic_retry_events_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

-- The server-side scheduler is not a tenant-authority oracle: it must first
-- authenticate the incident. These database checks prevent malformed envelopes,
-- cross-tenant keys, and provider retry requests that bypass delay/deadline.
CREATE FUNCTION public.sonara_schedule_autonomic_retry(
  p_resource_key text, p_organization_id uuid, p_operation_id text,
  p_incident_id text, p_attempt integer, p_dedupe_key text,
  p_not_before timestamptz, p_deadline_at timestamptz
) RETURNS TABLE (persisted boolean, duplicate boolean, not_before timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_resource jsonb;
  v_dedupe jsonb;
  v_now timestamptz := clock_timestamp();
  v_inserted uuid;
  v_existing timestamptz;
BEGIN
  IF p_organization_id IS NULL OR p_resource_key IS NULL OR
     length(p_resource_key) NOT BETWEEN 1 AND 1024 OR
     p_operation_id IS NULL OR p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' OR
     p_incident_id IS NULL OR p_incident_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' OR
     p_attempt IS NULL OR p_attempt NOT BETWEEN 0 AND 2 OR
     p_dedupe_key IS NULL OR length(p_dedupe_key) NOT BETWEEN 1 AND 2048 OR
     p_not_before IS NULL OR p_deadline_at IS NULL OR
     p_not_before < v_now - interval '5 seconds' OR
     p_not_before > v_now + interval '31 seconds' OR
     p_deadline_at <= p_not_before + interval '1 second' OR
     p_deadline_at > v_now + interval '24 hours'
  THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END IF;
  BEGIN
    v_resource := p_resource_key::jsonb;
    v_dedupe := p_dedupe_key::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END;
  -- Check types separately: jsonb_array_length raises on a scalar.
  IF jsonb_typeof(v_resource) IS DISTINCT FROM 'array' OR
     jsonb_typeof(v_dedupe) IS DISTINCT FROM 'array' THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END IF;
  IF jsonb_array_length(v_resource) <> 4 OR jsonb_array_length(v_dedupe) <> 3 OR
     v_resource->>0 IS DISTINCT FROM 'organization' OR
     v_resource->>1 IS DISTINCT FROM p_organization_id::text OR
     v_resource->>2 IS DISTINCT FROM 'retry_idempotent' OR
     length(coalesce(v_resource->>3,'')) NOT BETWEEN 1 AND 128 OR
     v_dedupe->>0 IS DISTINCT FROM p_resource_key OR
     v_dedupe->>1 IS DISTINCT FROM p_operation_id OR
     jsonb_typeof(v_dedupe->2) IS DISTINCT FROM 'number' OR
     v_dedupe->>2 IS DISTINCT FROM p_attempt::text
  THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO sonara_private.autonomic_retry_jobs (
    dedupe_key, resource_key, organization_id, operation_id, incident_id,
    attempt, not_before, deadline_at
  ) VALUES (
    p_dedupe_key, p_resource_key, p_organization_id, p_operation_id,
    p_incident_id, p_attempt, p_not_before, p_deadline_at
  ) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT j.not_before INTO v_existing
    FROM sonara_private.autonomic_retry_jobs AS j
    WHERE j.dedupe_key = p_dedupe_key;
    RETURN QUERY SELECT false, v_existing IS NOT NULL, v_existing;
    RETURN;
  END IF;
  INSERT INTO sonara_private.autonomic_retry_events (job_id, event_type)
  VALUES (v_inserted, 'queued');
  RETURN QUERY SELECT true, false, p_not_before;
END;
$fn$;

-- A worker may only see a queued job after its persisted not-before time.
-- The row lock and transition commit *before* any external side effect.
-- Started jobs are deliberately never returned again, even after a crash.
CREATE FUNCTION public.sonara_claim_due_autonomic_retry()
RETURNS TABLE (
  job_id uuid, resource_key text, organization_id uuid, operation_id text,
  attempt smallint, claim_token uuid, fencing_token bigint, deadline_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_job sonara_private.autonomic_retry_jobs%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_job
  FROM sonara_private.autonomic_retry_jobs AS j
  WHERE j.state = 'queued'
    AND j.not_before <= v_now
    AND j.deadline_at > v_now + interval '1 second'
  ORDER BY j.not_before ASC, j.id ASC
  FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE sonara_private.autonomic_retry_jobs AS j
  SET state = 'started', claim_token = gen_random_uuid(),
      fencing_token = j.fencing_token + 1, started_at = v_now
  WHERE j.id = v_job.id
  RETURNING * INTO v_job;
  INSERT INTO sonara_private.autonomic_retry_events
    (job_id, event_type, claim_token)
  VALUES (v_job.id, 'started', v_job.claim_token);
  RETURN QUERY SELECT v_job.id, v_job.resource_key, v_job.organization_id,
    v_job.operation_id, v_job.attempt, v_job.claim_token,
    v_job.fencing_token, v_job.deadline_at;
END;
$fn$;

-- A duplicate/completed/old-token completion is rejected, not silently retried.
CREATE FUNCTION public.sonara_complete_autonomic_retry(
  p_job_id uuid, p_claim_token uuid, p_outcome text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF p_job_id IS NULL OR p_claim_token IS NULL OR
     p_outcome IS NULL OR p_outcome NOT IN ('verified','unverified','failed') THEN
    RETURN false;
  END IF;
  UPDATE sonara_private.autonomic_retry_jobs AS j
  SET state = p_outcome, finished_at = clock_timestamp()
  WHERE j.id = p_job_id AND j.state = 'started' AND j.claim_token = p_claim_token
  RETURNING j.id INTO v_id;
  IF v_id IS NULL THEN RETURN false; END IF;
  INSERT INTO sonara_private.autonomic_retry_events (job_id, event_type, claim_token)
  VALUES (v_id, p_outcome, p_claim_token);
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.sonara_schedule_autonomic_retry(text,uuid,text,text,integer,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sonara_claim_due_autonomic_retry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sonara_complete_autonomic_retry(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sonara_schedule_autonomic_retry(text,uuid,text,text,integer,text,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sonara_claim_due_autonomic_retry() TO service_role;
GRANT EXECUTE ON FUNCTION public.sonara_complete_autonomic_retry(uuid,uuid,text) TO service_role;

DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'sonara_private.autonomic_retry_jobs'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'sonara_private.autonomic_retry_events'::regclass)
     OR has_function_privilege('anon','public.sonara_claim_due_autonomic_retry()','EXECUTE')
     OR has_function_privilege('authenticated','public.sonara_claim_due_autonomic_retry()','EXECUTE')
     OR has_function_privilege('authenticated','public.sonara_schedule_autonomic_retry(text,uuid,text,text,integer,text,timestamptz,timestamptz)','EXECUTE')
     OR has_function_privilege('anon','public.sonara_complete_autonomic_retry(uuid,uuid,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.sonara_claim_due_autonomic_retry()','EXECUTE')
  THEN RAISE EXCEPTION 'Autonomic retry queue privilege/RLS invariant failed'; END IF;
END;
$check$;
COMMIT;

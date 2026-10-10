-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Opt-in execution gate. Never activates an existing retry worker.
-- A separate privileged, reviewed change is required to approve any tenant.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE sonara_private.autonomic_execution_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO sonara_private.autonomic_execution_control (singleton, enabled)
VALUES (true, false);

CREATE TABLE sonara_private.autonomic_execution_grants (
  organization_id uuid NOT NULL,
  resource_key text NOT NULL CHECK (length(resource_key) BETWEEN 1 AND 1024),
  allowed boolean NOT NULL DEFAULT false,
  requested_by text NOT NULL CHECK (length(requested_by) BETWEEN 1 AND 128),
  approved_by text NOT NULL CHECK (length(approved_by) BETWEEN 1 AND 128),
  approved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (requested_by <> approved_by),
  CHECK (expires_at > approved_at),
  CHECK (expires_at <= approved_at + interval '24 hours'),
  PRIMARY KEY (organization_id, resource_key)
);
CREATE INDEX autonomic_execution_grant_expiry_idx
  ON sonara_private.autonomic_execution_grants (expires_at)
  WHERE allowed;

ALTER TABLE sonara_private.autonomic_execution_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE sonara_private.autonomic_execution_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sonara_private.autonomic_execution_control,
  sonara_private.autonomic_execution_grants
  FROM PUBLIC, anon, authenticated, service_role;

-- Check the actual started/claimed database job, never a caller-supplied
-- tenant or resource string. This is a read-only check with zero grants by
-- default and no service_role path to modify the approval tables.
CREATE FUNCTION public.sonara_autonomic_execution_permitted(
  p_job_id uuid, p_claim_token uuid, p_fencing_token bigint
) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM sonara_private.autonomic_retry_jobs AS job
    JOIN sonara_private.autonomic_execution_grants AS approval
      ON approval.organization_id = job.organization_id
      AND approval.resource_key = job.resource_key
    JOIN sonara_private.autonomic_execution_control AS control
      ON control.singleton = true
    WHERE job.id = p_job_id
      AND job.claim_token = p_claim_token
      AND job.fencing_token = p_fencing_token
      AND job.fencing_token > 0
      AND job.state = 'started'
      AND job.deadline_at > clock_timestamp() + interval '1 second'
      AND control.enabled = true
      AND approval.allowed = true
      AND approval.approved_at <= clock_timestamp()
      AND approval.expires_at > clock_timestamp()
      AND approval.requested_by <> approval.approved_by
      AND jsonb_typeof(job.resource_key::jsonb) = 'array'
      AND jsonb_array_length(job.resource_key::jsonb) = 4
      AND job.resource_key::jsonb->>0 = 'organization'
      AND job.resource_key::jsonb->>1 = job.organization_id::text
      AND job.resource_key::jsonb->>2 = 'retry_idempotent'
  );
$fn$;

REVOKE ALL ON FUNCTION public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)
  TO service_role;

DO $verify$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
      WHERE oid = 'sonara_private.autonomic_execution_control'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
      WHERE oid = 'sonara_private.autonomic_execution_grants'::regclass)
     OR has_function_privilege('anon',
          'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated',
          'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
          'public.sonara_autonomic_execution_permitted(uuid,uuid,bigint)', 'EXECUTE')
     OR (SELECT enabled FROM sonara_private.autonomic_execution_control WHERE singleton) IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'Autonomic operator gate invariant failed'; END IF;
END;
$verify$;
COMMIT;

-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- New, opt-in server-only state for bounded runtime recovery. Not activation.
-- Fail closed: a crashed/incomplete claim cannot be automatically reclaimed.
-- No customer or business data is changed by this migration.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS sonara_private;
REVOKE ALL ON SCHEMA sonara_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS sonara_private.autonomic_repair_claims (
  resource_key text PRIMARY KEY,
  organization_id uuid,
  action text NOT NULL,
  incident_id text NOT NULL,
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  fencing_token bigint NOT NULL DEFAULT 1 CHECK (fencing_token > 0),
  state text NOT NULL DEFAULT 'claimed'
    CHECK (state IN ('claimed', 'started', 'verified', 'unverified', 'failed')),
  cooldown_until timestamptz NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (length(resource_key) BETWEEN 1 AND 1024),
  CHECK (length(incident_id) BETWEEN 1 AND 128),
  CHECK (action IN ('retry_idempotent', 'requeue_expired_lease',
                   'open_optional_circuit', 'pause_optional_lane'))
);

CREATE TABLE IF NOT EXISTS sonara_private.autonomic_repair_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_key text NOT NULL REFERENCES sonara_private.autonomic_repair_claims(resource_key),
  claim_token uuid NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  event_type text NOT NULL CHECK (event_type IN ('claim_created', 'started', 'verified', 'unverified', 'failed')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (resource_key, fencing_token, event_type)
);

CREATE INDEX IF NOT EXISTS autonomic_repair_events_by_resource
  ON sonara_private.autonomic_repair_events (resource_key, recorded_at DESC);

ALTER TABLE sonara_private.autonomic_repair_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE sonara_private.autonomic_repair_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sonara_private.autonomic_repair_claims, sonara_private.autonomic_repair_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE sonara_private.autonomic_repair_events_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

-- Only service-role RPC invocation is permitted. A resource key has canonical
-- JSON shape [scope, organization-or-global, action, resource]. The key is the
-- cooldown identity, not the incident ID (which an observer may regenerate).
CREATE OR REPLACE FUNCTION public.sonara_claim_autonomic_repair(
  p_resource_key text,
  p_organization_id uuid,
  p_action text,
  p_incident_id text,
  p_cooldown_ms integer
) RETURNS TABLE (claimed boolean, claim_token uuid, fencing_token bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_parts jsonb;
  v_token uuid;
  v_fence bigint;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_resource_key IS NULL OR length(p_resource_key) NOT BETWEEN 1 AND 1024
     OR p_incident_id IS NULL OR length(p_incident_id) NOT BETWEEN 1 AND 128
     OR p_action NOT IN ('retry_idempotent', 'requeue_expired_lease',
                         'open_optional_circuit', 'pause_optional_lane')
     OR p_cooldown_ms IS NULL OR p_cooldown_ms NOT BETWEEN 300000 AND 600000 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;
  BEGIN
    v_parts := p_resource_key::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::bigint;
    RETURN;
  END;
  IF jsonb_typeof(v_parts) <> 'array' OR jsonb_array_length(v_parts) <> 4
     OR v_parts->>2 IS DISTINCT FROM p_action
     OR length(coalesce(v_parts->>3, '')) NOT BETWEEN 1 AND 128
     OR (p_organization_id IS NULL
         AND (v_parts->>0 <> 'process' OR v_parts->>1 <> 'global'))
     OR (p_organization_id IS NOT NULL
         AND (v_parts->>0 <> 'organization'
              OR v_parts->>1 <> p_organization_id::text)) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  INSERT INTO sonara_private.autonomic_repair_claims AS current_claim (
    resource_key, organization_id, action, incident_id,
    claim_token, fencing_token, state, cooldown_until, claimed_at, updated_at
  ) VALUES (
    p_resource_key, p_organization_id, p_action, p_incident_id,
    gen_random_uuid(), 1, 'claimed',
    v_now + make_interval(secs => p_cooldown_ms / 1000.0), v_now, v_now
  )
  ON CONFLICT (resource_key) DO UPDATE SET
    claim_token = gen_random_uuid(),
    fencing_token = current_claim.fencing_token + 1,
    organization_id = EXCLUDED.organization_id,
    action = EXCLUDED.action,
    incident_id = EXCLUDED.incident_id,
    state = 'claimed',
    cooldown_until = EXCLUDED.cooldown_until,
    claimed_at = EXCLUDED.claimed_at,
    updated_at = EXCLUDED.updated_at
  WHERE current_claim.state = 'verified'
    AND current_claim.cooldown_until <= v_now
  RETURNING current_claim.claim_token, current_claim.fencing_token
  INTO v_token, v_fence;

  IF v_token IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::bigint;
    RETURN;
  END IF;

  -- The claim and its first audit record commit atomically.
  INSERT INTO sonara_private.autonomic_repair_events
    (resource_key, claim_token, fencing_token, event_type)
  VALUES (p_resource_key, v_token, v_fence, 'claim_created');

  RETURN QUERY SELECT true, v_token, v_fence;
END;
$function$;

-- This RPC is the ONLY state-change path after a claim. A caller must possess
-- the opaque token issued by the winning claim. Rows are locked and transitions
-- constrained. An unknown side-effect outcome stays non-reclaimable.
CREATE OR REPLACE FUNCTION public.sonara_record_autonomic_repair(
  p_resource_key text, p_claim_token uuid, p_state text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_claim sonara_private.autonomic_repair_claims%ROWTYPE;
  v_next text;
BEGIN
  IF p_resource_key IS NULL OR p_claim_token IS NULL
     OR p_state NOT IN ('claimed', 'verified', 'unverified', 'failed') THEN
    RETURN false;
  END IF;
  SELECT * INTO v_claim FROM sonara_private.autonomic_repair_claims
    WHERE resource_key = p_resource_key FOR UPDATE;
  IF NOT FOUND OR v_claim.claim_token <> p_claim_token THEN
    RETURN false;
  END IF;
  IF p_state = 'claimed' AND v_claim.state = 'claimed' THEN
    v_next := 'started';
  ELSIF p_state IN ('verified', 'unverified', 'failed') AND v_claim.state = 'started' THEN
    v_next := p_state;
  ELSE
    RETURN false;
  END IF;
  UPDATE sonara_private.autonomic_repair_claims
    SET state = v_next, updated_at = clock_timestamp()
    WHERE resource_key = p_resource_key;
  INSERT INTO sonara_private.autonomic_repair_events
    (resource_key, claim_token, fencing_token, event_type)
  VALUES (p_resource_key, p_claim_token, v_claim.fencing_token, v_next);
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.sonara_claim_autonomic_repair(text, uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sonara_record_autonomic_repair(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sonara_claim_autonomic_repair(text, uuid, text, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sonara_record_autonomic_repair(text, uuid, text)
  TO service_role;

DO $verify$
BEGIN
  IF to_regclass('sonara_private.autonomic_repair_claims') IS NULL
     OR to_regclass('sonara_private.autonomic_repair_events') IS NULL
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'sonara_private.autonomic_repair_claims'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'sonara_private.autonomic_repair_events'::regclass)
     OR has_function_privilege('anon',
         'public.sonara_claim_autonomic_repair(text, uuid, text, text, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated',
         'public.sonara_claim_autonomic_repair(text, uuid, text, text, integer)', 'EXECUTE')
     OR has_function_privilege('anon',
         'public.sonara_record_autonomic_repair(text, uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated',
         'public.sonara_record_autonomic_repair(text, uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
         'public.sonara_claim_autonomic_repair(text, uuid, text, text, integer)', 'EXECUTE')
  THEN RAISE EXCEPTION 'Autonomic repair ledger privilege or RLS invariant failed'; END IF;
END;
$verify$;
COMMIT;

-- Copyright (c) 2026 SONARA Industries. All rights reserved.
-- Phase 7: opt-in, server-only HMAC sensor replay prevention. No listener,
-- cron, automatic cleanup or provider side effect is created.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE sonara_private.autonomic_sensor_nonces (
  sensor_id text NOT NULL CHECK (sensor_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{32}$'),
  timestamp_ms bigint NOT NULL CHECK (timestamp_ms > 0),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (sensor_id, nonce),
  CHECK (expires_at > claimed_at)
);
CREATE INDEX autonomic_sensor_nonces_expiry_idx
  ON sonara_private.autonomic_sensor_nonces (expires_at);

ALTER TABLE sonara_private.autonomic_sensor_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sonara_private.autonomic_sensor_nonces
  FROM PUBLIC, anon, authenticated, service_role;

-- Caller must have already verified the HMAC with the per-sensor key.
-- The database independently enforces the signed timestamp window and an
-- atomic, permanent (until separately approved purge) anti-replay identity.
-- No secret or raw request body is stored here.
CREATE FUNCTION public.sonara_claim_autonomic_sensor_nonce(
  p_sensor_id text, p_nonce text, p_timestamp_ms bigint, p_ttl_ms integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_now_ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  v_claimed text;
BEGIN
  IF p_sensor_id IS NULL OR
     p_sensor_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' OR
     p_nonce IS NULL OR p_nonce !~ '^[0-9a-f]{32}$' OR
     p_timestamp_ms IS NULL OR p_timestamp_ms <= 0 OR
     p_ttl_ms IS DISTINCT FROM 250000 OR
     v_now_ms - p_timestamp_ms > 120000 OR
     p_timestamp_ms - v_now_ms > 5000
  THEN
    RETURN false;
  END IF;

  INSERT INTO sonara_private.autonomic_sensor_nonces AS n
    (sensor_id, nonce, timestamp_ms, claimed_at, expires_at)
  VALUES (p_sensor_id, p_nonce, p_timestamp_ms, v_now,
          v_now + make_interval(secs => p_ttl_ms / 1000.0))
  ON CONFLICT (sensor_id, nonce) DO NOTHING
  RETURNING n.nonce INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)
  TO service_role;

DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
          WHERE oid = 'sonara_private.autonomic_sensor_nonces'::regclass)
     OR has_schema_privilege('anon', 'sonara_private', 'USAGE')
     OR has_schema_privilege('authenticated', 'sonara_private', 'USAGE')
     OR has_function_privilege('anon',
        'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated',
        'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
        'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Autonomic signed sensor nonce RLS/privilege invariant failed';
  END IF;
END;
$check$;
COMMIT;

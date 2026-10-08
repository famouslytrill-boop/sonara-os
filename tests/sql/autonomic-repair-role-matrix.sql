-- Native replay only. This entire fixture rolls back, and must never be
-- executed against a customer or production database.
BEGIN;

DO $role_matrix$
BEGIN
  IF has_schema_privilege('anon', 'sonara_private', 'USAGE')
     OR has_schema_privilege('authenticated', 'sonara_private', 'USAGE')
     OR has_schema_privilege('service_role', 'sonara_private', 'USAGE')
     OR has_function_privilege('anon', 'public.sonara_claim_autonomic_repair(text,uuid,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.sonara_record_autonomic_repair(text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'repair ledger privileges are too broad';
  END IF;
END;
$role_matrix$;

SET LOCAL ROLE service_role;
DO $staging$
DECLARE
  v_key text := '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-provider"]';
  v_first record;
  v_again record;
BEGIN
  SELECT * INTO v_first FROM public.sonara_claim_autonomic_repair(
    v_key, '11111111-1111-4111-8111-111111111111',
    'retry_idempotent', 'fixture-incident-1', 300000
  );
  IF NOT v_first.claimed OR v_first.claim_token IS NULL OR v_first.fencing_token <> 1 THEN
    RAISE EXCEPTION 'first claim not granted';
  END IF;
  PERFORM set_config('sonara.fixture_old_claim_token', v_first.claim_token::text, true);
  SELECT * INTO v_again FROM public.sonara_claim_autonomic_repair(
    v_key, '11111111-1111-4111-8111-111111111111',
    'retry_idempotent', 'fixture-incident-2', 300000
  );
  IF v_again.claimed THEN RAISE EXCEPTION 'duplicate concurrent resource claim allowed'; END IF;
  IF public.sonara_record_autonomic_repair(v_key, v_first.claim_token, 'verified') THEN
    RAISE EXCEPTION 'unstarted repair was marked verified';
  END IF;
  IF NOT public.sonara_record_autonomic_repair(v_key, v_first.claim_token, 'claimed') THEN
    RAISE EXCEPTION 'pre-action audit refused';
  END IF;
  IF public.sonara_record_autonomic_repair(v_key, v_first.claim_token, 'claimed') THEN
    RAISE EXCEPTION 'duplicate audit accepted';
  END IF;
  IF NOT public.sonara_record_autonomic_repair(v_key, v_first.claim_token, 'verified') THEN
    RAISE EXCEPTION 'verified transition refused';
  END IF;
END;
$staging$;
RESET ROLE;

-- Only synthetic fixture rows are modified, in a transaction which rolls back.
UPDATE sonara_private.autonomic_repair_claims
  SET cooldown_until = clock_timestamp() - interval '1 minute'
  WHERE resource_key = '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-provider"]';

SET LOCAL ROLE service_role;
DO $fencing$
DECLARE
  v_key text := '["organization","11111111-1111-4111-8111-111111111111","retry_idempotent","fixture-provider"]';
  v_new record;
BEGIN
  SELECT * INTO v_new FROM public.sonara_claim_autonomic_repair(
    v_key, '11111111-1111-4111-8111-111111111111',
    'retry_idempotent', 'fixture-incident-3', 300000
  );
  IF NOT v_new.claimed OR v_new.fencing_token <> 2 THEN
    RAISE EXCEPTION 'verified/cooldown repair did not re-claim with advanced fence';
  END IF;
  IF public.sonara_record_autonomic_repair(
    v_key, current_setting('sonara.fixture_old_claim_token', true)::uuid, 'claimed') THEN
    RAISE EXCEPTION 'stale owner passed the fencing check';
  END IF;
  IF NOT public.sonara_record_autonomic_repair(v_key, v_new.claim_token, 'claimed')
     OR NOT public.sonara_record_autonomic_repair(v_key, v_new.claim_token, 'failed') THEN
    RAISE EXCEPTION 'new claim could not be marked failed';
  END IF;
  -- A crashed/failed side effect is ambiguous; cooldown expiry must not replay.
  IF (SELECT claimed FROM public.sonara_claim_autonomic_repair(
    v_key, '11111111-1111-4111-8111-111111111111',
    'retry_idempotent', 'fixture-incident-4', 300000
  )) THEN RAISE EXCEPTION 'unverified/failed claim was reclaimed automatically'; END IF;
END;
$fencing$;

SELECT 'sonara_recovery_staging_passed' AS native_claim_proof;
ROLLBACK;

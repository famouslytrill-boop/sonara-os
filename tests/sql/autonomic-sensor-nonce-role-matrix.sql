-- Disposable PostgreSQL replay only. Rolls back all synthetic sensor IDs.
BEGIN;
DO $priv$
BEGIN
  IF has_schema_privilege('anon', 'sonara_private', 'USAGE') OR
     has_schema_privilege('authenticated', 'sonara_private', 'USAGE') OR
     has_table_privilege('anon', 'sonara_private.autonomic_sensor_nonces', 'SELECT') OR
     has_table_privilege('authenticated', 'sonara_private.autonomic_sensor_nonces', 'INSERT') OR
     has_function_privilege('anon',
       'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)','EXECUTE') OR
     has_function_privilege('authenticated',
       'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)','EXECUTE') OR
     NOT has_function_privilege('service_role',
       'public.sonara_claim_autonomic_sensor_nonce(text,text,bigint,integer)','EXECUTE')
  THEN RAISE EXCEPTION 'sensor nonce privileges leaked to browser roles'; END IF;
END;
$priv$;
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_nonce text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  v_other text := 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
BEGIN
  IF NOT public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', v_nonce, v_now, 250000) THEN
    RAISE EXCEPTION 'first signed nonce did not claim';
  END IF;
  IF public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', v_nonce, v_now, 250000) THEN
    RAISE EXCEPTION 'valid captured delivery replay was accepted';
  END IF;
  IF NOT public.sonara_claim_autonomic_sensor_nonce('other-sensor', v_nonce, v_now, 250000) THEN
    RAISE EXCEPTION 'independent sensor nonce namespace incorrectly blocked';
  END IF;
  IF public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', v_other, v_now - 121000, 250000) OR
     public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', v_other, v_now + 6000, 250000) OR
     public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', v_other, v_now, 250001) OR
     public.sonara_claim_autonomic_sensor_nonce('fixture-sensor', 'invalid', v_now, 250000) THEN
    RAISE EXCEPTION 'invalid signed nonce envelope bypassed timestamp or policy';
  END IF;
END;
$test$;
RESET ROLE;
DO $persisted$
BEGIN
  IF (SELECT count(*) FROM sonara_private.autonomic_sensor_nonces
      WHERE nonce = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' AND
            sensor_id IN ('fixture-sensor', 'other-sensor')) <> 2 THEN
    RAISE EXCEPTION 'nonce uniqueness or recording violated';
  END IF;
END;
$persisted$;
SELECT 'sonara_signed_sensor_nonce_native_passed' AS proof;
ROLLBACK;

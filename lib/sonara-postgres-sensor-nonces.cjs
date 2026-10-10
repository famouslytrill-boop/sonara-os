// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Inject only a server-held, service_role-authorized Supabase RPC function.
// Deliberately does not instantiate a client or load a key on import.
function createPostgresSensorNonceClaim({ rpc } = {}) {
  if (typeof rpc !== "function") throw TypeError("service_role_rpc_required");
  return async function claimNonce({ sensorId, nonce, timestampMs, ttlMs } = {}) {
    if (typeof sensorId !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(sensorId) ||
        typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce) ||
        !Number.isSafeInteger(timestampMs) || timestampMs <= 0 ||
        ttlMs !== 250000) {
      return false;
    }
    try {
      const response = await rpc("sonara_claim_autonomic_sensor_nonce", {
        p_sensor_id: sensorId, p_nonce: nonce,
        p_timestamp_ms: timestampMs, p_ttl_ms: ttlMs
      });
      // Only an explicit true from the database can admit an observation.
      return response?.error == null && response?.data === true;
    } catch {
      return false;
    }
  };
}

module.exports = { createPostgresSensorNonceClaim };

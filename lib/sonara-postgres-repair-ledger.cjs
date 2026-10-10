// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Adapter for service-role-only Supabase PostgreSQL RPC. No network, credentials
// or migrations are executed on import. The injected RPC must be server-side,
// authenticated with a protected service role, and reject non-2xx responses.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set([
  "retry_idempotent", "requeue_expired_lease", "open_optional_circuit", "pause_optional_lane"
]);
const STATES = new Set(["claimed", "verified", "unverified", "failed"]);

function unwrap(response) {
  if (!response || typeof response !== "object" || response.error) {
    throw new Error("durable_recovery_rpc_failed");
  }
  return response.data;
}

function createPostgresRepairLedger({ rpc } = {}) {
  if (typeof rpc !== "function") throw new TypeError("A protected service-role RPC adapter is required");
  return Object.freeze({
    ledger: Object.freeze({
      async claim({ resourceKey, organizationId, action, incidentId, cooldownMs }) {
        if (typeof resourceKey !== "string" || !ACTIONS.has(action) ||
            typeof incidentId !== "string" || !Number.isInteger(cooldownMs) ||
            cooldownMs < 300000 || cooldownMs > 600000 ||
            !(organizationId === null || UUID.test(organizationId))) {
          throw new Error("durable_recovery_claim_invalid");
        }
        const data = unwrap(await rpc("sonara_claim_autonomic_repair", {
          p_resource_key: resourceKey, p_organization_id: organizationId,
          p_action: action, p_incident_id: incidentId, p_cooldown_ms: cooldownMs
        }));
        if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.claimed !== "boolean") {
          throw new Error("durable_recovery_claim_malformed");
        }
        if (!data[0].claimed) return { claimed: false };
        const row = data[0];
        const fence = Number(row.fencing_token);
        if (!UUID.test(row.claim_token || "") || !Number.isSafeInteger(fence) || fence < 1) {
          throw new Error("durable_recovery_token_invalid");
        }
        return { claimed: true, claimToken: row.claim_token, fencingToken: fence };
      }
    }),
    async audit({ resourceKey, claimToken, state }) {
      if (typeof resourceKey !== "string" || !UUID.test(claimToken || "") || !STATES.has(state)) return false;
      return unwrap(await rpc("sonara_record_autonomic_repair", {
        p_resource_key: resourceKey, p_claim_token: claimToken, p_state: state
      })) === true;
    }
  });
}

module.exports = { createPostgresRepairLedger };

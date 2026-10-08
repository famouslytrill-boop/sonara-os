// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { planRemediation } = require("./sonara-self-healing-supervisor.cjs");

// The sensor reports the symptom; a server-controlled registry supplies all
// authorization facts. A public request or model may not declare itself safe.
async function admitTrustedIncident(event, { registry, nowMs = Date.now() } = {}) {
  if (!event || typeof event !== "object" || Array.isArray(event) ||
      typeof event.resourceId !== "string" || typeof event.sensorId !== "string" ||
      typeof event.incidentId !== "string" || !registry ||
      typeof registry.lookup !== "function" ||
      typeof registry.verifyObservation !== "function") {
    return { admitted: false, reason: "untrusted_or_malformed_event" };
  }
  // Snapshot authenticated fields before awaiting any external callback.
  // Otherwise an event object can change after signature verification (TOCTOU).
  const observation = Object.freeze({ ...event });
  let registered;
  let provenance;
  try {
    // verifyObservation MUST authenticate the complete immutable sensor payload
    // (signed webhook, mTLS identity or internal authenticated collector).
    provenance = await registry.verifyObservation(observation);
  } catch {
    return { admitted: false, reason: "sensor_authentication_failed" };
  }
  if (provenance?.authenticated !== true || provenance.sensorId !== observation.sensorId ||
      provenance.resourceId !== observation.resourceId) {
    return { admitted: false, reason: "sensor_authentication_failed" };
  }
  try { registered = await registry.lookup(observation.resourceId); } catch {
    return { admitted: false, reason: "registry_unavailable" };
  }
  if (!registered || registered.sensorId !== observation.sensorId ||
      registered.authorizedScope !== true || registered.sensitive !== false ||
      (registered.scope === "organization" && registered.organizationId !== provenance.organizationId) ||
      !["process", "organization"].includes(registered.scope) ||
      (registered.scope === "organization" && !registered.organizationId)) {
    return { admitted: false, reason: "untrusted_monitor_or_scope" };
  }
  // Domain, scope, optionality, provider identity, idempotency and retry
  // envelope come from trusted server-side records, never event JSON.
  const canonical = {
    incidentId: observation.incidentId, resourceId: observation.resourceId,
    observedAtMs: observation.observedAtMs, signal: observation.signal,
    scope: registered.scope, organizationId: registered.scope === "organization" ? registered.organizationId : null,
    domain: registered.domain, sensitive: registered.sensitive,
    authorizedScope: registered.authorizedScope,
    verifiedIdempotency: registered.verifiedIdempotency,
    operationId: registered.operationId, attempt: registered.attempt,
    deadlineAtMs: registered.deadlineAtMs,
    retryAfterMs: registered.retryAfterMs,
    optionalDependency: registered.optionalDependency,
    optionalLane: registered.optionalLane,
    queueDepth: registered.queueDepth, queueLimit: registered.queueLimit,
    leaseVersion: registered.leaseVersion, leaseExpiresAtMs: registered.leaseExpiresAtMs
  };
  const decision = planRemediation(canonical, { nowMs });
  return decision.decision === "eligible"
    ? { admitted: true, incident: Object.freeze(canonical), plan: decision }
    : { admitted: false, reason: decision.reason };
}
module.exports = { admitTrustedIncident };

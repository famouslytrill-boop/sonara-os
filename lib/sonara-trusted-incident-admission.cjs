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
      typeof registry.lookup !== "function") {
    return { admitted: false, reason: "untrusted_or_malformed_event" };
  }
  let registered;
  try { registered = await registry.lookup(event.resourceId); } catch {
    return { admitted: false, reason: "registry_unavailable" };
  }
  if (!registered || registered.sensorId !== event.sensorId ||
      registered.authorizedScope !== true || registered.sensitive !== false ||
      !["process", "organization"].includes(registered.scope) ||
      (registered.scope === "organization" && !registered.organizationId)) {
    return { admitted: false, reason: "untrusted_monitor_or_scope" };
  }
  // Domain, scope, optionality, provider identity, idempotency and retry
  // envelope come from trusted server-side records, never event JSON.
  const canonical = {
    incidentId: event.incidentId, resourceId: event.resourceId,
    observedAtMs: event.observedAtMs, signal: event.signal,
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

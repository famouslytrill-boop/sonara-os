// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { readEventConsumerActivationConfig } = require("./sonara-event-consumer.cjs");
const {
  EVENT_CONSUMER_CANARY,
  createDefaultRuntimeCapabilityService
} = require("./sonara-runtime-capabilities.cjs");

// Canonical activation gate for the first durable event-consumer canary.
//
// Environment variables remain the owner-controlled bootstrap input, but they
// are not sufficient execution authority on their own. The same request must
// also pass the runtime capability service, which enforces the OpenFeature flag
// and the explicit tenant allowlist. Keeping this composition in one pure
// helper makes the production canary entrypoint testable without touching a
// queue or a provider.
async function evaluateEventConsumerCanaryGate({
  env = process.env,
  entitlementChecker
} = {}) {
  const source = env && typeof env === "object" ? env : {};
  const activation = readEventConsumerActivationConfig((name) => source[name]);

  if (!activation.ok) {
    return Object.freeze({
      ...activation,
      allowed: false,
      capability: EVENT_CONSUMER_CANARY,
      reason: activation.code || "invalid_configuration"
    });
  }

  if (!activation.enabled) {
    return Object.freeze({
      ok: true,
      enabled: false,
      allowed: false,
      organizationId: null,
      mode: "canary",
      capability: EVENT_CONSUMER_CANARY,
      reason: "flag_disabled"
    });
  }

  const runtimeCapabilities = createDefaultRuntimeCapabilityService({
    env: source,
    entitlementChecker
  });
  const decision = await runtimeCapabilities.evaluate(EVENT_CONSUMER_CANARY, {
    organizationId: activation.organizationId,
    role: "system"
  });

  return Object.freeze({
    ok: decision.allowed,
    enabled: true,
    allowed: decision.allowed,
    organizationId: activation.organizationId,
    mode: "canary",
    capability: EVENT_CONSUMER_CANARY,
    reason: decision.reason
  });
}

module.exports = {
  evaluateEventConsumerCanaryGate
};

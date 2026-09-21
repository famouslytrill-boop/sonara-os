// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { OpenFeature, TypedInMemoryProvider } = require("@openfeature/server-sdk");

const DOMAIN = "sonara-runtime";

function booleanFlag(value) {
  return Object.freeze({
    variants: Object.freeze({ on: true, off: false }),
    disabled: false,
    defaultVariant: value === true ? "on" : "off"
  });
}

// OpenFeature is the evaluation contract, not rollout authority.
//
// This first provider is deliberately in-memory and receives already-reviewed
// configuration from SONARA. It does not fetch remote rules, expose customer
// data, or make an optional provider able to turn itself on. A later flagd,
// GrowthBook, or commercial provider can replace this implementation without
// changing call sites, after its own security/licence/availability review.
function createFeatureFlagService({ definitions = {} } = {}) {
  const configuration = {};
  for (const [key, value] of Object.entries(definitions)) {
    if (!/^[a-z0-9][a-z0-9._-]{1,119}$/i.test(key)) {
      throw new TypeError(`invalid feature flag key: ${key}`);
    }
    if (typeof value !== "boolean") {
      throw new TypeError(`feature flag ${key} must be boolean`);
    }
    configuration[key] = booleanFlag(value);
  }

  OpenFeature.setProvider(DOMAIN, new TypedInMemoryProvider(configuration));
  const client = OpenFeature.getClient(DOMAIN);

  return Object.freeze({
    domain: DOMAIN,
    async enabled(key, context = {}) {
      const flagKey = String(key || "").trim();
      if (!flagKey) return false;
      // The false fallback is security-significant: an unknown flag, provider
      // error or incomplete migration may disable an optional capability, never
      // manufacture permission to execute it.
      return client.getBooleanValue(flagKey, false, context);
    }
  });
}

module.exports = {
  DOMAIN,
  createFeatureFlagService
};

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { TypedInMemoryProvider } = require("@openfeature/server-sdk");

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

  // The OpenFeature global domain registry is mutable: setProvider(DOMAIN)
  // rebinds clients held by *other* capability services. A later review or
  // test instance must never enable an earlier disabled security-sensitive
  // flag. Keep this reviewed in-memory provider private to the service.
  //
  // OpenFeature server-sdk v1.23 exposes the typed provider's stable
  // resolveBooleanEvaluation interface. Once isolated API instances are
  // shipped and reviewed, an isolated SDK client can replace this adapter
  // without reintroducing a process-global mutable registry. Do not create
  // unbounded unique global domains for per-request capability evaluations.
  const provider = new TypedInMemoryProvider(configuration);
  const known = new Set(Object.keys(configuration));

  return Object.freeze({
    domain: DOMAIN,
    async enabled(key, context = {}) {
      const flagKey = String(key || "").trim();
      if (!known.has(flagKey)) return false;
      // An unknown key, provider failure, wrong return type, or missing
      // configuration fails closed. Only an explicit boolean true enables
      // a reviewed capability.
      try {
        const result = await provider.resolveBooleanEvaluation(flagKey, false, context);
        return result?.value === true;
      } catch {
        return false;
      }
    }
  });
}

module.exports = {
  DOMAIN,
  createFeatureFlagService
};

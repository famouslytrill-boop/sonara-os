// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { evaluateSloBurn } = require("./sonara-slo-burn-control.cjs");

// The labels are a CLOSED enum, never request paths, tenant IDs or customer data.
// Observations must be produced from trusted server-side HTTP outcomes.
const SUITES = Object.freeze([
  "sonara_one", "business_builder", "creator_studio", "growth_studio"
]);

function evaluateSuiteSloBurn(observations, {
  nowMs = Date.now(), sloTarget = 0.999,
  minShortSamples = 30, minLongSamples = 100,
  minLongCoverageRatio = 0.75, minLongBuckets = 6
} = {}) {
  if (!Array.isArray(observations) || observations.length > 50000 ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    return Object.freeze({ status: "invalid_evidence", alert: false, products: [] });
  }
  const grouped = new Map(SUITES.map((suite) => [suite, []]));
  for (const observation of observations) {
    if (!observation || !Object.hasOwn(observation, "suite") ||
        !grouped.has(observation.suite) ||
        typeof observation.ok !== "boolean" ||
        !Number.isSafeInteger(observation.timestampMs)) {
      return Object.freeze({ status: "invalid_evidence", alert: false, products: [] });
    }
    // Discard additional untrusted fields, including customer/route references.
    grouped.get(observation.suite).push({
      ok: observation.ok, timestampMs: observation.timestampMs
    });
  }
  const products = [];
  for (const suite of SUITES) {
    const evidence = evaluateSloBurn(grouped.get(suite), {
      nowMs, sloTarget, minShortSamples, minLongSamples,
      minLongCoverageRatio, minLongBuckets
    });
    if (evidence.status === "invalid_evidence") {
      return Object.freeze({ status: "invalid_evidence", alert: false, products: [] });
    }
    products.push(Object.freeze({
      suite, status: evidence.status, alert: evidence.alert === true,
      reason: evidence.reason, sampleCount: evidence.sampleCount,
      permittedAction: "alert_only"
    }));
  }
  return Object.freeze({
    status: "measured", alert: products.some((product) => product.alert),
    products: Object.freeze(products), permittedAction: "alert_only"
  });
}
module.exports = { SUITES, evaluateSuiteSloBurn };

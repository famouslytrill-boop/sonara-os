// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only operational intelligence: never initiates deployment, rollback,
// provider calls or customer-side mutations. Applies multiwindow SRE burn
// thresholds to trusted server-side request outcomes.
const WINDOW_RULES = Object.freeze([
  Object.freeze({ name: "fast", longMs: 60 * 60_000, shortMs: 5 * 60_000, threshold: 14.4 }),
  Object.freeze({ name: "slow", longMs: 6 * 60 * 60_000, shortMs: 30 * 60_000, threshold: 6 })
]);

function evaluateSloBurn(observations, {
  nowMs = Date.now(), sloTarget = 0.999, minShortSamples = 30,
  minLongSamples = 100
} = {}) {
  if (!Array.isArray(observations) || observations.length > 50_000 ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !Number.isFinite(sloTarget) || sloTarget <= 0 || sloTarget >= 1 ||
      !Number.isSafeInteger(minShortSamples) || minShortSamples < 1 ||
      !Number.isSafeInteger(minLongSamples) || minLongSamples < minShortSamples) {
    return Object.freeze({ status: "invalid_evidence", alert: false });
  }
  if (observations.some((v) => !v || typeof v.ok !== "boolean" ||
      !Number.isSafeInteger(v.timestampMs) || v.timestampMs < 0 ||
      v.timestampMs > nowMs + 5_000)) {
    return Object.freeze({ status: "invalid_evidence", alert: false });
  }
  const maxWindow = Math.max(...WINDOW_RULES.map((x) => x.longMs));
  const recent = observations.filter((v) => v.timestampMs > nowMs - maxWindow && v.timestampMs <= nowMs);
  const measured = WINDOW_RULES.map(({ name, shortMs, longMs, threshold }) => {
    const sample = (durationMs) => {
      const window = recent.filter((v) => v.timestampMs > nowMs - durationMs);
      const failures = window.filter((v) => !v.ok).length;
      return { count: window.length, failures,
        burnRate: window.length ? failures / window.length / (1 - sloTarget) : null };
    };
    const short = sample(shortMs);
    const long = sample(longMs);
    const enough = short.count >= minShortSamples && long.count >= minLongSamples;
    return Object.freeze({ rule: name, threshold, short, long, enough,
      firing: enough && short.burnRate >= threshold && long.burnRate >= threshold });
  });
  const firing = measured.find((rule) => rule.firing);
  const sufficientlyObserved = measured.some((rule) => rule.enough);
  return Object.freeze({
    status: firing ? "page_candidate" : sufficientlyObserved ? "within_alert_threshold" : "insufficient_evidence",
    alert: Boolean(firing), reason: firing ? `slo_${firing.rule}_burn` : sufficientlyObserved ? "no_sustained_burn" : "insufficient_samples",
    sloTarget, windows: measured, sampleCount: recent.length,
    // Advisory only. Human-run release gate remains authoritative.
    permittedAction: "alert_only"
  });
}
module.exports = { WINDOW_RULES, evaluateSloBurn };

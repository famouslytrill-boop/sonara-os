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
  minLongSamples = 100, minLongCoverageRatio = 0.75,
  minLongBuckets = 6
} = {}) {
  if (!Array.isArray(observations) || observations.length > 50_000 ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0 ||
      !Number.isFinite(sloTarget) || sloTarget <= 0 || sloTarget >= 1 ||
      !Number.isSafeInteger(minShortSamples) || minShortSamples < 1 ||
      !Number.isSafeInteger(minLongSamples) || minLongSamples < minShortSamples ||
      !Number.isFinite(minLongCoverageRatio) || minLongCoverageRatio <= 0 ||
      minLongCoverageRatio > 1 || !Number.isSafeInteger(minLongBuckets) ||
      minLongBuckets < 1 || minLongBuckets > 12) {
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
    const sample = (durationMs, requireCoverage = false) => {
      const window = recent.filter((v) => v.timestampMs > nowMs - durationMs);
      const failures = window.filter((v) => !v.ok).length;
      const measured = { count: window.length, failures,
        burnRate: window.length ? failures / window.length / (1 - sloTarget) : null };
      if (requireCoverage) {
        // A burst in the final five minutes cannot represent a full hour.
        // Check both window span and bucket occupancy (guards against two
        // distant bursts being mistaken for continuous observation).
        const oldest = window.reduce((minimum, event) =>
          Math.min(minimum, event.timestampMs), nowMs);
        const bucketMs = durationMs / 12;
        const buckets = new Set(window.map((event) =>
          Math.min(11, Math.floor((nowMs - event.timestampMs) / bucketMs))));
        measured.coverageRatio = window.length ? (nowMs - oldest) / durationMs : 0;
        measured.coveredBuckets = buckets.size;
      }
      return Object.freeze(measured);
    };
    const short = sample(shortMs);
    const long = sample(longMs, true);
    const countSufficient = short.count >= minShortSamples && long.count >= minLongSamples;
    const coverageSufficient = long.coverageRatio >= minLongCoverageRatio &&
      long.coveredBuckets >= minLongBuckets;
    const enough = countSufficient && coverageSufficient;
    return Object.freeze({ rule: name, threshold, short, long,
      countSufficient, coverageSufficient, enough,
      firing: enough && short.burnRate >= threshold && long.burnRate >= threshold });
  });
  const firing = measured.find((rule) => rule.firing);
  const sufficientlyObserved = measured.some((rule) => rule.enough);
  const coverageMissing = measured.some((rule) =>
    rule.countSufficient && !rule.coverageSufficient);
  return Object.freeze({
    status: firing ? "page_candidate" : sufficientlyObserved ? "within_alert_threshold" : "insufficient_evidence",
    alert: Boolean(firing), reason: firing ? `slo_${firing.rule}_burn` :
      sufficientlyObserved ? "no_sustained_burn" :
      coverageMissing ? "insufficient_long_window_coverage" : "insufficient_samples",
    sloTarget, windows: measured, sampleCount: recent.length,
    // Advisory only. Human-run release gate remains authoritative.
    permittedAction: "alert_only"
  });
}
module.exports = { WINDOW_RULES, evaluateSloBurn };

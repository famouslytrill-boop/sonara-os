// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) {
    root.SONARA = root.SONARA || {};
    root.SONARA.deviceDiagnosticReceipt = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const APPLICATION_PERMISSION_STATES = Object.freeze(["granted", "denied", "not_recorded", "unreadable"]);
  const PERMISSION_STATES = Object.freeze(["not_requested", "granted", "denied", "failed", "unsupported"]);
  const CAPTURE_STATES = Object.freeze([
    "not_run",
    "saved",
    "cancelled",
    "hidden_interrupted",
    "no_readings",
    "permission_denied",
    "permission_failed",
    "unsupported",
    "save_failed"
  ]);

  function exactSha(value) {
    const clean = String(value || "").trim().toLowerCase();
    return /^[0-9a-f]{40}$/.test(clean) ? clean : null;
  }

  function boundedInteger(value, min, max) {
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : 0;
  }

  function enumValue(value, allowed, fallback) {
    const clean = String(value || "").trim();
    return allowed.includes(clean) ? clean : fallback;
  }

  function build(input = {}) {
    // This is intentionally an allowlist construction, not a clone/sanitize of
    // arbitrary browser state. Raw motion values, location, account ids,
    // cookies, user agent and device identifiers therefore have no path into
    // the receipt even if a caller accidentally passes them.
    return {
      schemaVersion: 1,
      kind: "sonara_motion_device_diagnostic",
      generatedAt: new Date().toISOString(),
      releaseSha: exactSha(input.releaseSha),
      sourcePage: "settings_device_feedback",
      secureContext: input.secureContext === true,
      pageVisibleAtExport: input.pageVisibleAtExport === true,
      applicationPermissionState: enumValue(input.applicationPermissionState, APPLICATION_PERMISSION_STATES, "unreadable"),
      deviceMotionSupported: input.deviceMotionSupported === true,
      browserPermissionState: enumValue(input.browserPermissionState, PERMISSION_STATES, "not_requested"),
      captureState: enumValue(input.captureState, CAPTURE_STATES, "not_run"),
      boundedSampleCount: boundedInteger(input.boundedSampleCount, 0, 50),
      hiddenInterruptionObserved: input.hiddenInterruptionObserved === true,
      reducedMotionPreferred: input.reducedMotionPreferred === true
    };
  }

  function fileName(receipt) {
    const sha = exactSha(receipt && receipt.releaseSha);
    return `sonara-motion-diagnostic-${sha ? sha.slice(0, 12) : "unqualified"}.json`;
  }

  return Object.freeze({
    APPLICATION_PERMISSION_STATES,
    PERMISSION_STATES,
    CAPTURE_STATES,
    exactSha,
    build,
    fileName
  });
});

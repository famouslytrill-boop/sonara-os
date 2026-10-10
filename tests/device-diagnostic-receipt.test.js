"use strict";

const assert = require("node:assert/strict");
const receipt = require("../public/sonara-device-diagnostic-receipt.js");

describe("motion device diagnostic receipt", () => {
  it("binds to an exact deployment SHA and records only bounded diagnostic state", () => {
    const built = receipt.build({
      releaseSha: "A".repeat(40),
      secureContext: true,
      pageVisibleAtExport: true,
      applicationPermissionState: "granted",
      deviceMotionSupported: true,
      browserPermissionState: "granted",
      captureState: "saved",
      boundedSampleCount: 17,
      hiddenInterruptionObserved: false,
      reducedMotionPreferred: true,

      // These are deliberately passed to prove the allowlist builder ignores
      // them. A diagnostic receipt is not a telemetry export.
      acceleration_x: 9.81,
      rotation_alpha: 88,
      latitude: 39.9,
      longitude: -83.0,
      organization_id: "org-secret",
      user_id: "user-secret",
      cookie: "session-secret",
      userAgent: "fingerprinting-string"
    });

    assert.equal(built.releaseSha, "a".repeat(40));
    assert.equal(built.captureState, "saved");
    assert.equal(built.boundedSampleCount, 17);
    assert.equal(built.reducedMotionPreferred, true);

    for (const forbidden of [
      "acceleration_x", "rotation_alpha", "latitude", "longitude",
      "organization_id", "user_id", "cookie", "userAgent"
    ]) {
      assert.equal(Object.prototype.hasOwnProperty.call(built, forbidden), false, forbidden);
    }
  });

  it("does not pretend an unversioned/local runtime qualifies a release", () => {
    const built = receipt.build({ releaseSha: "local" });
    assert.equal(built.releaseSha, null);
    assert.equal(receipt.fileName(built), "sonara-motion-diagnostic-unqualified.json");
  });

  it("bounds counts and refuses invented state vocabulary", () => {
    const built = receipt.build({
      applicationPermissionState: "admin_override",
      browserPermissionState: "magically_allowed",
      captureState: "always_on",
      boundedSampleCount: 5000
    });
    assert.equal(built.applicationPermissionState, "unreadable");
    assert.equal(built.browserPermissionState, "not_requested");
    assert.equal(built.captureState, "not_run");
    assert.equal(built.boundedSampleCount, 0);
  });

  it("uses a short exact-SHA prefix in qualified filenames", () => {
    const built = receipt.build({ releaseSha: "1".repeat(40) });
    assert.equal(receipt.fileName(built), "sonara-motion-diagnostic-111111111111.json");
  });
});

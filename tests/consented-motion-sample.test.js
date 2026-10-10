"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  EVENT_TYPES,
  PRECISION_STEP,
  normalizeMotionSample
} = require("../lib/sonara-motion-sample.cjs");
const { permissionsPolicyFor } = require("../lib/sonara-permissions-policy.cjs");

const ROOT = path.join(__dirname, "..");

describe("consented bounded motion capture", () => {
  it("matches the database event vocabulary and quantizes every numeric field to one decimal", () => {
    assert.deepEqual(EVENT_TYPES, [
      "device_motion", "device_orientation", "gesture", "tilt", "shake", "rotation", "other"
    ]);
    assert.equal(PRECISION_STEP, 0.1);

    const result = normalizeMotionSample({
      event_type: "device_motion",
      acceleration_x: 1.26,
      acceleration_y: "-2.24",
      acceleration_z: -0.04,
      rotationAlpha: 18.88
    });
    assert.equal(result.ok, true);
    assert.equal(result.values.acceleration_x, 1.3);
    assert.equal(result.values.acceleration_y, -2.2);
    assert.equal(result.values.acceleration_z, 0);
    assert.equal(result.values.rotation_alpha, 18.9);
  });

  it("fails closed on unknown event types, non-finite/out-of-range values and empty samples", () => {
    assert.equal(normalizeMotionSample({ event_type: "made_up", acceleration_x: 1 }).code, "unknown_event_type");
    assert.equal(normalizeMotionSample({ acceleration_x: "not-a-number" }).code, "invalid_sensor_value");
    assert.equal(normalizeMotionSample({ acceleration_x: true }).code, "invalid_sensor_value");
    assert.equal(normalizeMotionSample({ acceleration_x: {} }).code, "invalid_sensor_value");
    assert.equal(normalizeMotionSample({ acceleration_x: "   " }).code, "motion_sample_empty");
    assert.equal(normalizeMotionSample({ acceleration_x: 1000000 }).code, "invalid_sensor_value");
    assert.equal(normalizeMotionSample({}).code, "motion_sample_empty");
  });

  it("bounds gesture labels and does not treat a malformed label as harmless metadata", () => {
    assert.equal(normalizeMotionSample({ event_type: "gesture", gesture_label: "shake" }).gestureLabel, "shake");
    assert.equal(normalizeMotionSample({ event_type: "gesture", gesture_label: "x".repeat(81) }).code, "gesture_label_invalid");
  });

  it("uses an explicit signed-in page, external CSP-safe scripts and a page-scoped sensor policy", () => {
    const routes = fs.readFileSync(path.join(ROOT, "routes", "sonara-last9-routes.cjs"), "utf8");
    const start = routes.indexOf('app.get("/settings/device-feedback"');
    const end = routes.indexOf("Object.entries(RESOURCE_MAP)", start);
    assert.ok(start >= 0 && end > start, "device feedback page block moved");
    const page = routes.slice(start, end);

    assert.match(page, /permissionsPolicyFor\(motionPermission\.ok \? "device_feedback" : "default"\)/);
    const policy = permissionsPolicyFor("device_feedback");
    assert.match(policy, /accelerometer=\(self\)/);
    assert.match(policy, /gyroscope=\(self\)/);
    assert.match(policy, /camera=\(\)/);
    assert.match(page, /data-sonara-motion-start/);
    assert.match(page, /data-sonara-motion-cancel/);
    assert.match(page, /data-sonara-motion-receipt/);
    assert.match(page, /releaseSha/);
    assert.match(page, /sonara-device-diagnostic-receipt\.js/);
    assert.match(page, /sonara-motion-capture\.js/);
    assert.doesNotMatch(page, /onclick=/);
    assert.match(page, /Individual sensor events are not uploaded/);
  });

  it("starts only from a button and stops/aborts when the page is hidden", () => {
    const client = fs.readFileSync(path.join(ROOT, "public", "sonara-motion-capture.js"), "utf8");
    assert.match(client, /startButton\.addEventListener\("click", startCapture\)/);
    assert.match(client, /document\.addEventListener\("visibilitychange"/);
    assert.match(client, /window\.addEventListener\("pagehide"/);
    assert.match(client, /pendingPost\.abort\(\)/);
    assert.match(client, /sampleWindowMs = Math\.min\(5000/);
    assert.match(client, /sampleIntervalMs = Math\.min\(1000, Math\.max\(100/);
    assert.match(client, /maxSamples = Math\.min\(50/);
    assert.ok(client.includes('if (raw === null || raw === undefined || raw === "") continue;'));
    assert.match(client, /config\.applicationPermissionAllowed !== true/);
    assert.doesNotMatch(client, /setInterval\(/);
  });

  it("requests motion and orientation permissions independently", () => {
    const client = fs.readFileSync(path.join(ROOT, "public", "sensory-device-client.js"), "utf8");
    const motionStart = client.indexOf("async function requestMotionPermission()");
    const orientationStart = client.indexOf("async function requestOrientationPermission()");
    assert.ok(motionStart >= 0 && orientationStart > motionStart);
    const motion = client.slice(motionStart, orientationStart);
    assert.match(motion, /DeviceMotionEvent\.requestPermission/);
    assert.doesNotMatch(motion, /DeviceOrientationEvent\.requestPermission/);
  });

  it("normalizes again on the server and never trusts request tenant or user identifiers", () => {
    const routes = fs.readFileSync(path.join(ROOT, "routes", "sonara-last9-routes.cjs"), "utf8");
    const start = routes.indexOf('app.post("/api/motion/events"');
    const end = routes.indexOf('app.get("/api/last9/readiness"', start);
    assert.ok(start >= 0 && end > start, "motion API block moved");
    const api = routes.slice(start, end);
    const permissionCheck = api.indexOf("accountMotionPermission(config, org.userId)");
    const normalization = api.indexOf("normalizeMotionSample(req.body || {})");
    assert.ok(permissionCheck >= 0 && normalization > permissionCheck, "account motion permission must be checked before reading the sample");
    assert.match(api, /motion_permission_required/);
    assert.match(api, /motion_permission_denied/);
    assert.match(api, /motion_permission_unreadable/);
    assert.match(api, /organization_id: org\.organizationId/);
    assert.match(api, /user_id: org\.userId \|\| null/);
    assert.doesNotMatch(api, /req\.body\.organization_id/);
    assert.doesNotMatch(api, /req\.body\.user_id/);
    assert.match(api, /sample_count: boundedInteger\(incomingMetadata\.sample_count, 1, 50\)/);
    assert.match(routes, /device\.motion_sample/);
    assert.match(routes, /maxAttempts: 12/);
    assert.match(routes, /device_permission_grants/);
  });

  it("records the browser runtime as the intentional no-form consumer", () => {
    const reachability = fs.readFileSync(path.join(ROOT, "tests", "form-reachability.test.js"), "utf8");
    assert.match(reachability, /Posted by public\/sonara-motion-capture\.js from \/settings\/device-feedback/);
    assert.doesNotMatch(reachability, /No client posts to it: nothing in public\/ ever has/);
  });
});

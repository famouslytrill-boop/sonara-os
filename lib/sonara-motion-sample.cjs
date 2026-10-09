"use strict";

// Privacy-bounded normalization for one user-initiated browser motion sample.
//
// The browser client aggregates a short foreground-only window before sending.
// This module repeats the important boundary server-side so a custom client
// cannot turn the endpoint into full-precision motion telemetry.
const EVENT_TYPES = Object.freeze([
  "device_motion",
  "device_orientation",
  "gesture",
  "tilt",
  "shake",
  "rotation",
  "other"
]);

const PRECISION_STEP = 0.1;
const DATABASE_ABS_LIMIT = 999999.9;

const SENSOR_FIELDS = Object.freeze({
  alpha: ["alpha"],
  beta: ["beta"],
  gamma: ["gamma"],
  acceleration_x: ["acceleration_x", "accelerationX"],
  acceleration_y: ["acceleration_y", "accelerationY"],
  acceleration_z: ["acceleration_z", "accelerationZ"],
  rotation_alpha: ["rotation_alpha", "rotationAlpha"],
  rotation_beta: ["rotation_beta", "rotationBeta"],
  rotation_gamma: ["rotation_gamma", "rotationGamma"]
});

function firstPresent(input, aliases) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return input[key];
  }
  return undefined;
}

function coarseNumber(value) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > DATABASE_ABS_LIMIT) {
    return { ok: false, value: null };
  }
  // Keep one decimal place at the storage boundary. This intentionally avoids
  // retaining the six decimal places the database type could otherwise accept.
  const rounded = Math.round(number / PRECISION_STEP) * PRECISION_STEP;
  return { ok: true, value: Object.is(rounded, -0) ? 0 : Number(rounded.toFixed(1)) };
}

function cleanGesture(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean || clean.length > 80) return null;
  return clean;
}

function normalizeMotionSample(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "motion_sample_invalid" };
  }

  const eventType = String(input.event_type || input.eventType || "device_motion").trim().toLowerCase();
  if (!EVENT_TYPES.includes(eventType)) {
    return { ok: false, code: "unknown_event_type", allowed: [...EVENT_TYPES] };
  }

  const values = {};
  let numericCount = 0;
  for (const [field, aliases] of Object.entries(SENSOR_FIELDS)) {
    const parsed = coarseNumber(firstPresent(input, aliases));
    if (!parsed.ok) return { ok: false, code: "invalid_sensor_value", field };
    values[field] = parsed.value;
    if (parsed.value !== null) numericCount += 1;
  }

  const gestureLabel = cleanGesture(input.gesture_label ?? input.gestureLabel);
  if (gestureLabel === null) return { ok: false, code: "gesture_label_invalid" };

  if (numericCount === 0 && !gestureLabel) {
    return { ok: false, code: "motion_sample_empty" };
  }

  return {
    ok: true,
    eventType,
    values,
    gestureLabel: gestureLabel || null,
    precisionStep: PRECISION_STEP
  };
}

module.exports = {
  EVENT_TYPES,
  SENSOR_FIELDS,
  PRECISION_STEP,
  DATABASE_ABS_LIMIT,
  coarseNumber,
  normalizeMotionSample
};

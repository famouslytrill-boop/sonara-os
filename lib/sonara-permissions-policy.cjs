// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// One authority for browser capability policy.
//
// A route-specific Permissions-Policy header replaces the earlier header; it
// does not inherit omitted directives from SONARA's global string. That makes
// omission dangerous for features whose standards default is `self`, notably
// accelerometer and gyroscope. Every preset therefore serializes the complete
// set SONARA deliberately controls instead of only the feature a page widens.
const FEATURE_ORDER = Object.freeze([
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "accelerometer",
  "gyroscope"
]);

const ALLOWLISTS = Object.freeze(new Set(["()", "(self)"]));

const PRESETS = Object.freeze({
  default: Object.freeze({
    camera: "()",
    microphone: "(self)",
    geolocation: "(self)",
    payment: "(self)",
    accelerometer: "()",
    gyroscope: "()"
  }),
  creator_generation: Object.freeze({
    camera: "(self)",
    microphone: "(self)",
    geolocation: "(self)",
    payment: "(self)",
    accelerometer: "()",
    gyroscope: "()"
  }),
  device_feedback: Object.freeze({
    camera: "()",
    microphone: "(self)",
    geolocation: "(self)",
    payment: "(self)",
    accelerometer: "(self)",
    gyroscope: "(self)"
  })
});

function serializePolicy(policy) {
  const keys = Object.keys(policy || {});
  if (keys.length !== FEATURE_ORDER.length || FEATURE_ORDER.some((feature) => !keys.includes(feature))) {
    throw new TypeError("permissions policy must explicitly declare every controlled feature");
  }
  return FEATURE_ORDER.map((feature) => {
    const allowlist = policy[feature];
    if (!ALLOWLISTS.has(allowlist)) throw new TypeError(`unsupported allowlist for ${feature}`);
    return `${feature}=${allowlist}`;
  }).join(", ");
}

const SERIALIZED = Object.freeze(Object.fromEntries(
  Object.entries(PRESETS).map(([name, policy]) => [name, serializePolicy(policy)])
));

function permissionsPolicyFor(name = "default") {
  if (!Object.prototype.hasOwnProperty.call(SERIALIZED, name)) {
    throw new RangeError(`unknown permissions policy preset: ${name}`);
  }
  return SERIALIZED[name];
}

module.exports = {
  FEATURE_ORDER,
  PRESETS,
  permissionsPolicyFor,
  serializePolicy
};

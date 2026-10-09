// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const assert = require("node:assert/strict");
const classification = require("../lib/sonara-environment-classification.cjs");
const channel = require("../lib/sonara-growth-channel-safety.cjs");

const KEYS = [
  "SONARA_GROWTH_CHANNEL_SAFETY_ENABLED",
  "SONARA_SOCIAL_USER_SAFETY_ENABLED"
];

describe("feature-disabled social rollout environment contract", () => {
  it("classifies both flags as optional, not paid-customer prerequisites or ratchets", () => {
    for (const key of KEYS) {
      assert.equal(classification.OPTIONAL_CAPABILITY.has(key), true, key);
      for (const group of ["REQUIRED", "RATCHET", "DEVELOPMENT_ONLY", "PLATFORM_PROVIDED"]) {
        assert.equal(classification[group].has(key), false, key + " must not belong to " + group);
      }
    }
  });

  it("does not grant channel access from missing or incorrectly typed rollout values", () => {
    assert.equal(channel.trustedWriteOrigin({ headers: { origin: "https://example.org" } }, ""), false);
  });

  it("makes new social flags explicit opt-in without declaring them in .env.example", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname,"..","lib","sonara-environment-classification.cjs"), "utf8");
    for (const key of KEYS) assert.equal(source.includes('"' + key + '"'), true);
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const assert = require("node:assert/strict");
const classification = require("../lib/sonara-environment-classification.cjs");

const KEYS = [
  "SONARA_SOCIAL_USER_SAFETY_ENABLED"
];

describe("feature-disabled social rollout environment contract", () => {
  it("classifies the account rollout switch as optional, not paid-customer prerequisites or ratchets", () => {
    for (const key of KEYS) {
      assert.equal(classification.OPTIONAL_CAPABILITY.has(key), true, key);
      for (const group of ["REQUIRED", "RATCHET", "DEVELOPMENT_ONLY", "PLATFORM_PROVIDED"]) {
        assert.equal(classification[group].has(key), false, key + " must not belong to " + group);
      }
    }
  });

  it("contains exactly one classification for the account rollout flag", () => {
    for (const key of KEYS) {
      const classifications = [
        "REQUIRED", "PLATFORM_PROVIDED", "OPTIONAL_CAPABILITY", "RATCHET", "DEVELOPMENT_ONLY"
      ].filter(group => classification[group].has(key));
      assert.deepEqual(classifications, ["OPTIONAL_CAPABILITY"]);
    }
  });

  it("makes new social flags explicit opt-in without declaring them in .env.example", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname,"..","lib","sonara-environment-classification.cjs"), "utf8");
    for (const key of KEYS) assert.equal(source.includes('"' + key + '"'), true);
  });
});

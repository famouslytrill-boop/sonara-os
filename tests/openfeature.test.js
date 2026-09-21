"use strict";

const assert = require("node:assert/strict");
const { createFeatureFlagService, DOMAIN } = require("../lib/sonara-feature-flags.cjs");

describe("OpenFeature runtime boundary", () => {
  it("evaluates reviewed booleans through a named domain", async () => {
    const flags = createFeatureFlagService({ definitions: { "runtime.safe-canary": true, "runtime.off": false } });
    assert.equal(flags.domain, DOMAIN);
    assert.equal(await flags.enabled("runtime.safe-canary"), true);
    assert.equal(await flags.enabled("runtime.off"), false);
  });

  it("fails closed for unknown flags", async () => {
    const flags = createFeatureFlagService({ definitions: {} });
    assert.equal(await flags.enabled("runtime.does-not-exist"), false);
  });

  it("rejects malformed keys and non-boolean configuration", () => {
    assert.throws(() => createFeatureFlagService({ definitions: { "": true } }), /invalid feature flag key/);
    assert.throws(() => createFeatureFlagService({ definitions: { "runtime.bad": "true" } }), /must be boolean/);
  });
});

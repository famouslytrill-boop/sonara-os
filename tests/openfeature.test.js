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

  it("keeps previously reviewed flag decisions stable after another service registers conflicting flags", async () => {
    const denied = createFeatureFlagService({
      definitions: { "runtime.shared": false, "business.private": false }
    });
    const allowed = createFeatureFlagService({
      definitions: { "runtime.shared": true, "growth.public": true }
    });

    // Under a shared process-global OpenFeature domain, constructing `allowed`
    // silently changed decisions made by `denied` (including runtime.shared).
    assert.equal(await denied.enabled("runtime.shared"), false);
    assert.equal(await allowed.enabled("runtime.shared"), true);
    assert.equal(await denied.enabled("growth.public"), false);
    assert.equal(await allowed.enabled("business.private"), false);

    const later = createFeatureFlagService({ definitions: { "runtime.shared": false } });
    assert.equal(await later.enabled("runtime.shared"), false);
    assert.equal(await allowed.enabled("runtime.shared"), true);
  });

  it("does not grant a flag that another per-tenant instance enabled", async () => {
    const one = createFeatureFlagService({ definitions: { "creator.render": true } });
    const two = createFeatureFlagService({ definitions: { "creator.render": false } });
    const results = await Promise.all([
      one.enabled("creator.render", { organizationId: "tenant-a" }),
      two.enabled("creator.render", { organizationId: "tenant-b" }),
      one.enabled("creator.render", { organizationId: "tenant-c" })
    ]);
    assert.deepEqual(results, [true, false, true]);
  });

  it("rejects malformed keys and non-boolean configuration", () => {
    assert.throws(() => createFeatureFlagService({ definitions: { "": true } }), /invalid feature flag key/);
    assert.throws(() => createFeatureFlagService({ definitions: { "runtime.bad": "true" } }), /must be boolean/);
  });
});

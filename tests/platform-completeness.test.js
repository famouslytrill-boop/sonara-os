"use strict";

const assert = require("node:assert/strict");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const {
  CURRENT_TECH_BASELINES,
  DOMAIN_FAMILIES,
  OUTPUT_FALLBACKS,
  PLATFORM_COMPLETENESS_CONTRACT,
  validateCompletenessContract
} = require("../lib/sonara-platform-completeness.cjs");

describe("platform completeness contract", () => {
  it("has no duplicate capability owner or canonical path", () => {
    const keys = PLATFORM_COMPLETENESS_CONTRACT.map((item) => item.key);
    const routes = PLATFORM_COMPLETENESS_CONTRACT.map((item) => item.route);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(new Set(routes).size, routes.length);
    assert.deepEqual(validateCompletenessContract(), []);
  });

  it("maps every canonical capability path to an actual registered route", () => {
    const registered = new Set(ROUTE_REGISTRY.map((item) => item.route));
    const missing = PLATFORM_COMPLETENESS_CONTRACT
      .map((item) => item.route)
      .filter((route) => !registered.has(route));
    assert.deepEqual(missing, []);
  });

  it("requires purpose, authority, useful empty state, and deterministic execution", () => {
    for (const item of PLATFORM_COMPLETENESS_CONTRACT) {
      assert.ok(item.purpose.length >= 30, item.key);
      assert.ok(item.dataAuthority.length >= 10, item.key);
      assert.ok(item.emptyState.length >= 20, item.key);
      assert.ok(item.deterministicCore.length >= 3, item.key);
      assert.equal(item.externalAiRequired, false, item.key);
      assert.notEqual(item.state, "demo", item.key);
      assert.notEqual(item.state, "placeholder", item.key);
    }
  });

  it("keeps every output usable without an external AI service", () => {
    const requiredOutputs = new Set(["text", "image", "audio", "video", "map", "data", "file"]);
    const observed = new Set();
    for (const item of OUTPUT_FALLBACKS) {
      observed.add(item.output);
      assert.equal(item.externalAiRequired, false, item.output);
      assert.ok(item.deterministicBaseline.length >= 20, item.output);
      assert.ok(item.failureMode.length >= 20, item.output);
    }
    assert.deepEqual([...requiredOutputs].filter((key) => !observed.has(key)), []);
  });

  it("consolidates broad vertical expansion into reusable system primitives", () => {
    assert.ok(DOMAIN_FAMILIES.length >= 10);
    const keys = DOMAIN_FAMILIES.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const family of DOMAIN_FAMILIES) {
      assert.ok(family.systems.length >= 5, family.key);
      assert.equal(new Set(family.systems).size, family.systems.length, family.key);
    }
  });

  it("pins the 2026 production-versus-research technology boundary", () => {
    assert.equal(CURRENT_TECH_BASELINES.asOf, "2026-09-25");
    assert.match(CURRENT_TECH_BASELINES.node.production, /^24/);
    assert.match(CURRENT_TECH_BASELINES.node.compatibility, /^26/);
    assert.match(CURRENT_TECH_BASELINES.postgresql.production, /^18/);
    assert.match(CURRENT_TECH_BASELINES.postgresql.researchOnly, /^19 beta/);
    assert.equal(CURRENT_TECH_BASELINES.mcp.protocol, "2026-07-28");
    assert.match(CURRENT_TECH_BASELINES.webgpu.policy, /fallback/i);
    assert.match(CURRENT_TECH_BASELINES.maplibre.policy, /replaceable/i);
  });
});

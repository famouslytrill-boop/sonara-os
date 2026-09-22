"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const registry = require("../lib/sonara-open-source-registry.cjs");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "data", "open-source-tools.ts"), "utf8");

describe("open-source commercial-use status contract", () => {
  it("defines exactly the canonical five-value policy", () => {
    assert.deepEqual(registry.COMMERCIAL_USE_STATUS_VALUES, [
      "allowed",
      "allowed_after_review",
      "needs_review",
      "blocked_until_review",
      "blocked"
    ]);
    assert.deepEqual(registry.COMMERCIAL_USE_STATUS_ALIASES, {
      blocked_pending_review: "blocked_until_review",
      not_allowed: "blocked"
    });
  });

  it("normalizes legacy aliases but rejects unknown values", () => {
    assert.equal(registry.normalizeCommercialUseStatus("blocked_pending_review"), "blocked_until_review");
    assert.equal(registry.normalizeCommercialUseStatus("not_allowed"), "blocked");
    assert.equal(registry.normalizeCommercialUseStatus("blocked"), "blocked");
    assert.equal(registry.normalizeCommercialUseStatus("blocked_until_review"), "blocked_until_review");
    assert.equal(registry.normalizeCommercialUseStatus("whatever_new_string"), null);
  });

  it("keeps the checked source canonical and preserves every registry row", () => {
    assert.doesNotMatch(SOURCE, /commercialUseStatus:\s*"(?:blocked_pending_review|not_allowed)"/);
    const rows = registry.readOpenSourceTools();
    assert.ok(rows.length >= 100);
    for (const row of rows) {
      assert.ok(registry.COMMERCIAL_USE_STATUS_VALUES.includes(row.commercialUseStatus), row.slug + " has an unknown commercial status");
    }
    assert.equal(rows.length, registry.registryIntegrity().parsed);
  });

  it("keeps blocked decisions distinct from review-gated decisions", () => {
    assert.notEqual(registry.commercialLabel("blocked"), registry.commercialLabel("blocked_until_review"));
    assert.notEqual(registry.commercialLabel("allowed"), registry.commercialLabel("allowed_after_review"));
  });
});

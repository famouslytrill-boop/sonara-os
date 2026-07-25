"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), "utf8"); }

describe("Market intelligence integration contract", () => {
  it("prepares route anchors and runs market intelligence before final R&D decisions", function() {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.scripts["apply:market-intelligence"], "node scripts/prepare-market-intelligence-anchors.cjs && node scripts/apply-market-intelligence-system.cjs");
    assert.match(pkg.scripts["apply:runtime"], /apply:product-lifecycle && pnpm run apply:product-catalog && pnpm run apply:market-intelligence && pnpm run apply:market-rd$/);
  });

  it("registers parent and studio workspaces", function() {
    const registry = read("lib/sonara-route-registry.cjs");
    const server = read("server.js");
    for (const route of [
      "/market-intelligence",
      "/business-builder/market-intelligence",
      "/creator-studio/market-intelligence",
      "/growth-studio/market-intelligence"
    ]) assert.match(registry, new RegExp(route.replaceAll("/", "\\/")));
    assert.match(server, /registerMarketIntelligenceRoutes/);
    assert.match(server, /Market intelligence/);
  });

  it("documents every registered market API in OpenAPI", function() {
    const openapi = read("openapi/sonara.yaml");
    for (const marker of [
      "/api/market-intelligence/framework:",
      "/api/market-intelligence/portfolio:",
      "/api/market-intelligence/segments:",
      "/api/market-intelligence/competitors:",
      "/api/market-intelligence/signals:",
      "/api/market-intelligence/opportunities:",
      "/api/market-intelligence/opportunities/{opportunityId}:",
      "/api/market-intelligence/opportunities/{opportunityId}/reviews:"
    ]) assert.match(openapi, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("adds all six tables to the canonical database and ecosystem contracts", function() {
    const contract = read("lib/sonara-database-contract.cjs");
    const manifest = read("lib/sonara-ecosystem-manifest.cjs");
    const verifier = read("scripts/verify-supabase-contract.mjs");
    for (const table of [
      "market_intelligence_segments",
      "market_intelligence_competitors",
      "market_intelligence_signals",
      "market_intelligence_opportunities",
      "market_intelligence_reviews",
      "market_intelligence_events"
    ]) {
      assert.match(contract, new RegExp(table));
      assert.match(manifest, new RegExp(table));
      assert.match(verifier, new RegExp(table));
    }
    assert.match(verifier, /expected 135 canonical tables/);
  });

  it("shares the strategy with company agents and preserves the affordable pricing position", function() {
    const strategy = JSON.parse(read(".ai/shared/MARKET_STRATEGY_2026.json"));
    assert.equal(strategy.company, "SONARA Industries");
    assert.equal(strategy.companies.business_builder.primary_outcome, "complete the first transaction and operate repeatably");
    assert.equal(strategy.companies.creator_studio.primary_outcome, "turn original work into a portable rights-aware release or client package");
    assert.equal(strategy.companies.growth_studio.primary_outcome, "turn consented first-party signals into measured customer growth");
    assert.deepEqual(strategy.pricing.current.slice(0, 4).map((plan) => plan.price_usd_monthly), [0, 7, 19, 39]);
  });

  it("publishes an evidence-backed operating runbook with explicit non-goals", function() {
    const docs = read("docs/SONARA_MARKET_INTELLIGENCE_2026.md");
    for (const term of [
      "first completed transaction",
      "rights-aware release",
      "first-party data",
      "incrementality",
      "observed date",
      "willingness to pay",
      "Do not build yet",
      "current owner-approved plans"
    ]) assert.match(docs, new RegExp(term, "i"));
    assert.match(docs, /never populate an organization's private market workspace with fictional/i);
    assert.match(docs, /do not change public prices solely because a competitor charges more/i);
  });
});

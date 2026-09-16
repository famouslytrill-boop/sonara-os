const request = require("supertest");
const assert = require("assert");
const app = require("../server");
const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");
const { DATABASE_TABLES } = require("../lib/sonara-database-contract.cjs");
const { getMarketExpansionRegistry } = require("../lib/sonara-market-expansion-registry.cjs");

describe("SONARA ecosystem manifest", () => {
  it("contains the parent company and three current companies", function() {
    const manifest = getManifest();
    assert.equal(manifest.parentCompany.name, "SONARA Industries");
    assert.equal(manifest.currentCompanies.length, 3);
    assert.ok(manifest.currentCompanies.some((company) => company.key === "business_builder"));
    assert.ok(manifest.currentCompanies.some((company) => company.key === "creator_studio"));
    assert.ok(manifest.currentCompanies.some((company) => company.key === "growth_studio"));
  });

  it("contains required database table references", function() {
    const tables = getAllManifestTables();
    assert.ok(tables.includes("profiles"));
    assert.ok(tables.includes("organizations"));
    assert.ok(tables.includes("billing_webhook_events"));
    assert.ok(tables.includes("sonara_formula_definitions"));
    assert.ok(tables.includes("sonara_platform_pages"));
    assert.ok(tables.includes("audio_transcription_segments"));
    for (const table of tables.filter((name) => !name.includes("."))) {
      assert.ok(DATABASE_TABLES.includes(table), `${table} must be part of the canonical database contract`);
    }
  });

  it("classifies September market expansion without granting execution authority", function() {
    const expansion = getMarketExpansionRegistry();
    assert.ok(expansion.counts.capabilities >= 20);
    assert.ok(expansion.counts.industryPacks >= 5);
    assert.ok(expansion.counts.standaloneSkus >= 5);
    assert.equal(expansion.authority, "planning_and_control_plane_only_unless_existing_is_explicitly_listed");
    assert.ok(expansion.capabilities.some((item) => item.key === "interactive-media-studio"));
    assert.ok(expansion.capabilities.some((item) => item.key === "local-ai-visibility"));
    assert.ok(expansion.capabilities.some((item) => item.key === "field-mode"));
    assert.ok(expansion.capabilities.some((item) => item.key === "extension-marketplace"));
    assert.ok(expansion.capabilities.some((item) => item.key === "agentic-commerce-distribution" && item.status === "research_only"));
    assert.ok(expansion.capabilities.some((item) => item.key === "payroll-tax-banking-rails" && item.status === "do_not_rebuild"));
  });
});

describe("SONARA ecosystem routes", () => {
  it("GET /ecosystem returns the public ecosystem page", async function() {
    const res = await request(app).get("/ecosystem").set("Accept", "text/html");
    assert.equal(res.status, 200);
    assert.equal(res.type, "text/html");
    assert.match(res.text, /SONARA Ecosystem/);
    assert.match(res.text, /Business Builder/);
    assert.match(res.text, /Creator Studio/);
    assert.match(res.text, /Growth Studio/);
    assert.match(res.text, /Market and product expansion/);
  });

  it("GET /api/ecosystem/manifest returns the manifest and expansion registry", async function() {
    const res = await request(app).get("/api/ecosystem/manifest").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.manifest.parentCompany.name, "SONARA Industries");
    assert.equal(res.body.manifest.currentCompanies.length, 3);
    assert.ok(res.body.manifest.marketExpansion.counts.capabilities >= 20);
    assert.ok(res.body.manifest.marketExpansion.capabilities.some((item) => item.key === "restaurant-operations-pack"));
  });

  it("GET /api/ecosystem/readiness returns table and expansion readiness", async function() {
    const res = await request(app).get("/api/ecosystem/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.tables));
    assert.ok(res.body.tables.some((item) => item.table === "profiles"));
    assert.ok(res.body.expansionCapabilityCount >= 20);
  });
});

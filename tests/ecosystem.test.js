const request = require("supertest");
const assert = require("assert");
const app = require("../server");
const { getManifest, getAllManifestTables } = require("../lib/sonara-ecosystem-manifest.cjs");
const { DATABASE_TABLES } = require("../lib/sonara-database-contract.cjs");

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
  });

  it("GET /api/ecosystem/manifest returns the manifest", async function() {
    const res = await request(app).get("/api/ecosystem/manifest").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.manifest.parentCompany.name, "SONARA Industries");
    assert.equal(res.body.manifest.currentCompanies.length, 3);
  });

  it("GET /api/ecosystem/readiness returns table readiness", async function() {
    const res = await request(app).get("/api/ecosystem/readiness").set("Accept", "application/json");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.tables));
    assert.ok(res.body.tables.some((item) => item.table === "profiles"));
  });
});

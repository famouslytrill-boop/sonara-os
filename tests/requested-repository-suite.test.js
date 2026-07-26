"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  REQUESTED_REPOSITORIES,
  getPublicRequestedRepositoryCatalog,
  getRequestedRepositoryReadiness
} = require("../lib/sonara-requested-repository-registry.cjs");

const EXPECTED_KEYS = [
  "openhands",
  "caveman",
  "agency_agents",
  "meetily",
  "officecli",
  "openwiki",
  "omniroute",
  "strix",
  "asi",
  "awesome_design_md"
];

const CORRECTED_REPOSITORIES = {
  agency_agents: "msitarzewski/agency-agents",
  officecli: "iOfficeAI/OfficeCLI",
  openwiki: "langchain-ai/openwiki",
  strix: "usestrix/strix"
};

describe("requested repository integration registry", () => {
  it("catalogs every requested source and blocks unverifiable links", () => {
    assert.deepEqual(REQUESTED_REPOSITORIES.map((item) => item.key), EXPECTED_KEYS);
    assert.equal(REQUESTED_REPOSITORIES.filter((item) => item.repositoryVerified).length, 8);
    assert.deepEqual(
      REQUESTED_REPOSITORIES.filter((item) => item.integrationStatus === "blocked").map((item) => item.key),
      ["omniroute", "awesome_design_md"]
    );
  });

  it("records authoritative corrections for misattributed social-post links", () => {
    for (const [key, repository] of Object.entries(CORRECTED_REPOSITORIES)) {
      const item = REQUESTED_REPOSITORIES.find((candidate) => candidate.key === key);
      assert.equal(item.repository, repository);
      assert.equal(item.repositoryVerified, true);
      assert.ok(item.sourceCorrection);
    }
  });

  it("keeps all third-party execution disabled in production", () => {
    const readiness = getRequestedRepositoryReadiness();
    assert.equal(readiness.repositoryCount, 10);
    assert.equal(readiness.verifiedCount, 8);
    assert.equal(readiness.blockedCount, 2);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired));
  });

  it("publishes a non-secret catalog with explicit safety boundaries", () => {
    const catalog = getPublicRequestedRepositoryCatalog();
    const serialized = JSON.stringify(catalog);
    assert.equal(catalog.length, 10);
    assert.doesNotMatch(serialized, /API_KEY|TOKEN=|SECRET=|password/i);
    assert.ok(catalog.every((item) => item.safety.length > 0));
    assert.ok(catalog.every((item) => item.nextStep));
    assert.ok(catalog.every((item) => item.enabledInProduction === false));
  });

  it("installs route registration idempotently through the runtime applicator", () => {
    const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    assert.equal((server.match(/registerSonaraRequestedRepositoryRoutes = require/g) || []).length, 1);
    assert.equal((server.match(/registerSonaraRequestedRepositoryRoutes\(app/g) || []).length, 1);
  });
});

describe("requested repository runtime surfaces", () => {
  it("publishes the governed public repository catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/requested-repositories")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.repositoryCount, 10);
    assert.equal(response.body.verifiedCount, 8);
    assert.equal(response.body.blockedCount, 2);
    assert.deepEqual(response.body.repositories.map((item) => item.key), EXPECTED_KEYS);
  });

  it("renders a public research page without executing external tools", async () => {
    const response = await request(app).get("/research-lab/requested-repositories");
    assert.equal(response.status, 200);
    assert.match(response.text, /Governed external repository intake/);
    assert.match(response.text, /No third-party repository is cloned, installed, executed, or enabled/);
  });

  it("protects repository readiness behind founder/admin authentication", async () => {
    const response = await request(app)
      .get("/api/admin/requested-repositories/readiness")
      .set("Accept", "application/json");

    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(response.body.code));
  });
});

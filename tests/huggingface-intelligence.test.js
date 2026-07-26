"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  HUGGINGFACE_RESOURCES,
  getPublicHuggingFaceCatalog,
  getStaticHuggingFaceReadiness,
  getHuggingFaceReadiness,
  parseHubUrl
} = require("../lib/sonara-huggingface-catalog.cjs");

const EXPECTED_COUNTS = {
  model: 16,
  dataset: 7,
  spec: 10
};

const BLOCKED_COMMERCIAL = ["musicgen_small", "mert_v1_95m"];

function item(key) {
  return HUGGINGFACE_RESOURCES.find((candidate) => candidate.key === key);
}

describe("governed Hugging Face resource catalog", () => {
  it("catalogs the curated model, dataset, and specification set", () => {
    assert.equal(HUGGINGFACE_RESOURCES.length, 33);
    const counts = HUGGINGFACE_RESOURCES.reduce((summary, resource) => {
      summary[resource.resourceType] = (summary[resource.resourceType] || 0) + 1;
      return summary;
    }, {});
    assert.deepEqual(counts, EXPECTED_COUNTS);
    assert.equal(new Set(HUGGINGFACE_RESOURCES.map((resource) => resource.key)).size, 33);
  });

  it("keeps all execution disabled and requires human review", () => {
    assert.ok(HUGGINGFACE_RESOURCES.every((resource) => resource.executionEnabled === false));
    assert.ok(HUGGINGFACE_RESOURCES.every((resource) => resource.humanReviewRequired === true));
    assert.ok(HUGGINGFACE_RESOURCES.every((resource) => resource.safety.length > 0));
    assert.ok(HUGGINGFACE_RESOURCES.every((resource) => resource.nextStep));
  });

  it("blocks noncommercial models and flags conditional or unverified licenses", () => {
    assert.deepEqual(
      HUGGINGFACE_RESOURCES
        .filter((resource) => resource.adoptionStatus === "blocked_commercial")
        .map((resource) => resource.key),
      BLOCKED_COMMERCIAL
    );
    assert.equal(item("stable_audio_open_10").adoptionStatus, "license_review");
    assert.equal(item("stable_audio_open_10").commercialUse, "conditional");
    assert.equal(item("funsd_layoutlmv2").adoptionStatus, "blocked_license_review");
    assert.equal(item("fineweb_edu").adoptionStatus, "research_only");
  });

  it("publishes a non-secret catalog without runtime configuration keys", () => {
    const catalog = getPublicHuggingFaceCatalog();
    const serialized = JSON.stringify(catalog);
    assert.equal(catalog.length, 33);
    assert.doesNotMatch(serialized, /HF_TOKEN|Authorization|HUGGINGFACE_HUB_ENABLED|SONARA_HF_PROBE_TIMEOUT_MS/);
    assert.ok(catalog.every((resource) => resource.sourceUrl.startsWith("https://huggingface.co/")));
  });

  it("is disabled by default and exposes only non-secret configuration state", () => {
    const readiness = getStaticHuggingFaceReadiness({ NODE_ENV: "test" });
    assert.equal(readiness.resourceCount, 33);
    assert.equal(readiness.hub.enabled, false);
    assert.equal(readiness.hub.configurationStatus, "disabled");
    assert.equal(readiness.hub.runtimeStatus, "not_probed");
    assert.equal(readiness.hub.tokenConfigured, false);
  });

  it("rejects unapproved, insecure, or credential-bearing Hub URLs", () => {
    assert.equal(parseHubUrl("https://huggingface.co", { NODE_ENV: "production" }).ok, true);
    assert.equal(parseHubUrl("http://huggingface.co", { NODE_ENV: "production" }).code, "insecure_transport");
    assert.equal(parseHubUrl("https://example.com", { NODE_ENV: "production" }).code, "unapproved_host");
    assert.equal(parseHubUrl("https://user:secret@huggingface.co", { NODE_ENV: "production" }).code, "credentials_in_url");
    assert.equal(parseHubUrl("http://127.0.0.1:8080", { NODE_ENV: "test" }).ok, true);
    assert.equal(parseHubUrl("http://127.0.0.1:8080", { NODE_ENV: "production" }).code, "unapproved_host");
  });

  it("performs one bounded metadata GET and never returns the token", async () => {
    const calls = [];
    const secret = "hf_test_secret_value";
    const readiness = await getHuggingFaceReadiness({
      env: {
        NODE_ENV: "test",
        HUGGINGFACE_HUB_ENABLED: "true",
        HUGGINGFACE_HUB_BASE_URL: "https://huggingface.co",
        HF_TOKEN: secret,
        SONARA_HF_PROBE_TIMEOUT_MS: "700"
      },
      probe: true,
      fetchImpl: async (target, options) => {
        calls.push({ target: String(target), options });
        return { ok: true, status: 200 };
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].target, "https://huggingface.co/api/models/BAAI/bge-small-en-v1.5");
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.redirect, "error");
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(readiness.mode, "live_bounded");
    assert.equal(readiness.hub.runtimeStatus, "ready");
    assert.equal(readiness.hub.probeResource, "BAAI/bge-small-en-v1.5");
    assert.doesNotMatch(JSON.stringify(readiness), new RegExp(secret));
  });

  it("does not probe when the integration is disabled", async () => {
    let calls = 0;
    const readiness = await getHuggingFaceReadiness({
      env: { NODE_ENV: "test" },
      probe: true,
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, status: 200 };
      }
    });
    assert.equal(calls, 0);
    assert.equal(readiness.mode, "static");
    assert.equal(readiness.hub.configurationStatus, "disabled");
  });

  it("seeds database metadata for every catalog resource without enabling execution", () => {
    const migration = fs.readFileSync(path.join(
      __dirname,
      "../supabase/migrations/20260726224500_huggingface_resource_catalog.sql"
    ), "utf8");
    for (const resource of HUGGINGFACE_RESOURCES) {
      assert.match(migration, new RegExp(`\\('${resource.key}'`), `${resource.key} must be seeded`);
    }
    assert.match(migration, /check \(execution_enabled = false\)/);
    assert.match(migration, /"model_execution_enabled":false/);
    assert.match(migration, /"dataset_ingestion_enabled":false/);
    assert.doesNotMatch(migration, /hf_[A-Za-z0-9]{12,}/i);
  });

  it("installs route registration idempotently through the runtime applicator", () => {
    const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const openapi = fs.readFileSync(path.join(__dirname, "../openapi/sonara.yaml"), "utf8");
    assert.equal((server.match(/registerSonaraHuggingFaceRoutes = require/g) || []).length, 1);
    assert.equal((server.match(/registerSonaraHuggingFaceRoutes\(app/g) || []).length, 1);
    assert.equal((openapi.match(/\/api\/ecosystem\/huggingface:/g) || []).length, 1);
    assert.equal((openapi.match(/\/api\/admin\/huggingface\/readiness:/g) || []).length, 1);
  });
});

describe("Hugging Face runtime surfaces", () => {
  it("publishes the public governed catalog", async () => {
    const response = await request(app)
      .get("/api/ecosystem/huggingface")
      .set("Accept", "application/json");

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.resourceCount, 33);
    assert.equal(response.body.counts.model, 16);
    assert.equal(response.body.counts.dataset, 7);
    assert.equal(response.body.counts.spec, 10);
    assert.equal(response.body.resources.length, 33);
    assert.doesNotMatch(response.text, /HF_TOKEN|Authorization/);
  });

  it("renders a public research page without enabling external execution", async () => {
    const response = await request(app).get("/research-lab/huggingface");
    assert.equal(response.status, 200);
    assert.match(response.text, /Governed Hugging Face model and dataset catalog/);
    assert.match(response.text, /never executed by this public catalog/i);
  });

  it("protects live readiness behind founder or admin authentication", async () => {
    const response = await request(app)
      .get("/api/admin/huggingface/readiness")
      .set("Accept", "application/json");

    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(response.body.code));
  });
});

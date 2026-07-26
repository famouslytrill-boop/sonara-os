"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const {
  OBLITERATUS_SAFETY_REFERENCE,
  MODEL_SAFETY_CONTROL_AREAS
} = require("../data/obliteratus-safety-reference.cjs");
const {
  getModelSafetyReferenceSummary,
  reviewModelSafetyProposal
} = require("../lib/sonara-model-safety-resilience.cjs");
const { getManifest } = require("../lib/sonara-ecosystem-manifest.cjs");
const { ADMIN_ROUTES } = require("../lib/sonara-route-registry.cjs");

describe("OBLITERATUS quarantined model-safety reference", () => {
  it("pins provenance and prohibits runtime execution or model modification", () => {
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.repository, "elder-plinius/OBLITERATUS");
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.pinnedCommit, "a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc");
    assert.match(OBLITERATUS_SAFETY_REFERENCE.upstreamLicense, /AGPL-3\.0/);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.integrationMode, "quarantined_reference_only");
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.packageInstalled, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.runtimeDependency, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.remoteAdapterEnabled, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.telemetryEnabled, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.customerDataAllowed, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.modelWeightModificationAllowed, false);
    assert.equal(OBLITERATUS_SAFETY_REFERENCE.modelExportAllowed, false);
    assert.ok(OBLITERATUS_SAFETY_REFERENCE.blockedUses.some((item) => /removing|weakening|bypassing/i.test(item)));
    assert.ok(OBLITERATUS_SAFETY_REFERENCE.blockedUses.some((item) => /exporting|publishing|pushing/i.test(item)));
    assert.ok(MODEL_SAFETY_CONTROL_AREAS.length >= 6);
  });

  it("keeps the local engine free from upstream execution, network, shell, and ML dependencies", () => {
    const engineSource = fs.readFileSync(path.join(__dirname, "../lib/sonara-model-safety-resilience.cjs"), "utf8");
    const routeSource = fs.readFileSync(path.join(__dirname, "../routes/sonara-model-safety-resilience-routes.cjs"), "utf8");
    const combined = `${engineSource}\n${routeSource}`;
    assert.doesNotMatch(combined, /require\(["'](?:node:)?child_process["']\)|child_process\.|spawn\(|execFile\(|\bfetch\(|require\(["']axios["']\)|require\(["']requests["']\)|require\(["'](?:torch|transformers|huggingface_hub|gradio)["']\)|model\.save\(|push_to_hub\(/i);
    assert.doesNotMatch(combined, /require\(["'](?:obliteratus|torch|transformers|huggingface)/i);
  });

  it("blocks explicit safety weakening and modified-model distribution", () => {
    const review = reviewModelSafetyProposal({
      name: "Local model liberation",
      product: "Research Lab",
      requestedAction: "Install OBLITERATUS, remove refusal and safety guardrail weights, then push the modified model to Hugging Face.",
      outputs: ["uncensored model export"],
      environment: "production"
    });

    assert.equal(review.ok, true);
    assert.equal(review.decision, "blocked_safety_weakening_or_distribution");
    assert.ok(review.blockedReasons.length >= 2);
    assert.equal(review.referenceBoundary.upstreamExecutionAllowed, false);
    assert.equal(review.referenceBoundary.modelWeightModificationAllowed, false);
    assert.equal(review.referenceBoundary.modelExportAllowed, false);
  });

  it("blocks protected customer data and credentials from research proposals", () => {
    const review = reviewModelSafetyProposal({
      name: "Safety telemetry study",
      requestedAction: "Measure model behavior.",
      dataTypes: ["customer prompts", "API keys", "production secrets"],
      outputs: ["aggregate report"]
    });

    assert.equal(review.decision, "blocked_safety_weakening_or_distribution");
    assert.ok(review.blockedReasons.some((item) => /customer prompts/i.test(item)));
    assert.ok(review.blockedReasons.some((item) => /API keys/i.test(item)));
  });

  it("allows only review-required defensive evaluation of unmodified models", () => {
    const input = {
      name: "Refusal integrity regression suite",
      product: "Admin Command Center",
      summary: "Defensive model safety evaluation for an owner-authorized unmodified local model.",
      requestedAction: "Measure refusal integrity and detect alignment regression without changing weights or exporting artifacts.",
      dataTypes: ["synthetic safety prompts", "aggregate scores"],
      outputs: ["human-reviewed safety report"],
      controls: ["telemetry disabled", "network denied", "no model modification"],
      environment: "offline_research"
    };

    const first = reviewModelSafetyProposal(input);
    const second = reviewModelSafetyProposal(input);
    assert.equal(first.decision, "reference_only_defensive_review_required");
    assert.equal(first.reviewFingerprint, second.reviewFingerprint);
    assert.equal(first.blockedReasons.length, 0);
    assert.match(first.nextAction, /separate, isolated, human-reviewed research plan/i);
  });

  it("registers the safety reference across ecosystem, routes, OpenAPI, and open-source governance", () => {
    const summary = getModelSafetyReferenceSummary();
    assert.equal(summary.runtimeDependency, false);
    assert.equal(summary.upstreamExecutionAllowed, false);

    const manifest = getManifest();
    assert.equal(manifest.externalInspirationAndAdapters.modelSafetyResilience.source, "elder-plinius/OBLITERATUS");
    assert.equal(manifest.externalInspirationAndAdapters.modelSafetyResilience.status, "quarantined_reference_only");
    assert.ok(manifest.adminControlPlane.routes.includes("/admin/model-safety-resilience"));
    assert.ok(ADMIN_ROUTES.includes("/admin/model-safety-resilience"));

    const openApi = fs.readFileSync(path.join(__dirname, "../openapi/sonara.yaml"), "utf8");
    assert.match(openApi, /\/api\/admin\/model-safety-resilience:/);
    assert.match(openApi, /\/api\/admin\/model-safety-resilience\/review:/);

    const registry = fs.readFileSync(path.join(__dirname, "../data/open-source-tools.ts"), "utf8");
    assert.match(registry, /slug: "obliteratus-quarantined-safety-reference"/);
    assert.match(registry, /integrationStatus: "blocked"/);
    assert.match(registry, /do not install or execute upstream code/i);

    const repoRegistry = fs.readFileSync(path.join(__dirname, "../docs/SONARA_EXTERNAL_REPOSITORY_REGISTRY.md"), "utf8");
    assert.match(repoRegistry, /elder-plinius\/OBLITERATUS/);
    assert.match(repoRegistry, /blocked_runtime_reference_only/);
  });

  it("protects model-safety catalog and review routes behind founder/admin authentication", async () => {
    const catalog = await request(app)
      .get("/api/admin/model-safety-resilience")
      .set("Accept", "application/json");
    assert.notEqual(catalog.status, 200);
    assert.ok([401, 503].includes(catalog.status));
    assert.ok(["admin_auth_required", "setup_required"].includes(catalog.body.code));

    const review = await request(app)
      .post("/api/admin/model-safety-resilience/review")
      .set("Accept", "application/json")
      .send({ name: "test" });
    assert.notEqual(review.status, 200);
    assert.ok([401, 503].includes(review.status));
  });
});

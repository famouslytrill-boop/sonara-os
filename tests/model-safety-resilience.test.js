"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  OBLITERATUS_SAFETY_REFERENCE,
  MODEL_SAFETY_CONTROL_AREAS
} = require("../data/obliteratus-safety-reference.cjs");
const {
  reviewModelSafetyProposal
} = require("../lib/sonara-model-safety-resilience.cjs");

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
    // The route module that used to be read alongside the engine was removed
    // with the operator console on 1 October 2026; it served /admin pages only
    // and had no non-admin route left. The engine is where the dependency rule
    // has to hold, because it is what survives.
    const combined = fs.readFileSync(path.join(__dirname, "../lib/sonara-model-safety-resilience.cjs"), "utf8");
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

});

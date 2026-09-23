"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const registryPath = path.join(__dirname, "..", "data", "sonara-studio-platform-2026-09-22.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

describe("SONARA Studio governed research registry", function () {
  it("cannot activate runtime behavior merely by being merged", function () {
    assert.equal(registry.baseline.runtimeActivationAllowedByThisChange, false);
    assert.equal(registry.policy.dependenciesAddedByThisChange, false);
    assert.equal(registry.policy.databaseMigrationAddedByThisChange, false);
    assert.equal(registry.policy.providerCredentialsAddedByThisChange, false);
    assert.equal(registry.policy.customerFacingClaimsEnabledByThisChange, false);
    assert.equal(registry.policy.socialPublishingEnabledByThisChange, false);
    assert.equal(registry.policy.paymentsAuthorityExpandedByThisChange, false);
    assert.equal(registry.policy.regulatedIndustryAutomationEnabledByThisChange, false);

    for (const capability of registry.capabilities) {
      assert.equal(
        capability.enabledByThisChange,
        false,
        `${capability.id} must remain non-executing in this research change`
      );
    }
  });

  it("has unique, reviewable capability records", function () {
    const ids = registry.capabilities.map((capability) => capability.id);
    assert.equal(new Set(ids).size, ids.length, "capability ids must be unique");

    for (const capability of registry.capabilities) {
      assert.ok(capability.id);
      assert.ok(capability.domain);
      assert.ok(capability.surface);
      assert.ok(capability.purpose);
      assert.ok(capability.runtimePlacement);
      assert.ok(capability.adoptionState);
      assert.equal(typeof capability.humanApprovalRequired, "boolean");
      assert.ok(capability.safetyBoundary);
    }
  });

  it("keeps high-impact capabilities behind explicit human approval", function () {
    const byId = new Map(registry.capabilities.map((capability) => [capability.id, capability]));
    const approvalRequired = [
      "studio.voice-generation",
      "studio.music-sound",
      "studio.image-design",
      "studio.video-generation",
      "studio.live-collaboration",
      "studio.social-publishing",
      "studio.rights-provenance",
      "studio.agent-skill-canvas",
      "studio.durable-jobs",
      "studio.3d-authoring-companion",
      "studio.game-production",
      "platform.vertical-packs",
      "platform.regulated-packs"
    ];

    for (const id of approvalRequired) {
      assert.ok(byId.has(id), `missing governed capability ${id}`);
      assert.equal(byId.get(id).humanApprovalRequired, true, `${id} must require human approval`);
    }
  });

  it("keeps heavy compute and local authoring out of the public web process", function () {
    const byId = new Map(registry.capabilities.map((capability) => [capability.id, capability]));
    const prohibitedWebProcess = [
      "studio.audio-podcast",
      "studio.voice-generation",
      "studio.music-sound",
      "studio.image-design",
      "studio.video-generation",
      "studio.live-collaboration",
      "studio.publish-export",
      "studio.social-publishing",
      "studio.durable-jobs",
      "studio.3d-preview",
      "studio.3d-authoring-companion",
      "studio.game-production"
    ];

    for (const id of prohibitedWebProcess) {
      assert.notEqual(
        byId.get(id).runtimePlacement,
        "web_process",
        `${id} must remain outside the public web process`
      );
    }
  });

  it("fails closed for regulated expansion", function () {
    const regulated = registry.capabilities.find((capability) => capability.id === "platform.regulated-packs");
    assert.ok(regulated);
    assert.equal(regulated.adoptionState, "blocked_until_qualified_review");
    assert.equal(regulated.humanApprovalRequired, true);
    assert.equal(regulated.enabledByThisChange, false);
  });

  it("keeps SONARA Studio inside Creator Studio instead of creating brand sprawl", function () {
    assert.equal(registry.productDecision.placement, "Creator Studio workspace");
    assert.equal(registry.productDecision.newTopLevelProduct, false);
  });
});

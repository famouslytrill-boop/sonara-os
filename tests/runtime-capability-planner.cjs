"use strict";

const assert = require("node:assert/strict");
const {
  getRuntimeCapabilityPlan,
  planResearchRecord,
  inferProductTargets
} = require("../lib/sonara-runtime-capability-planner.cjs");

function convergence(repositories) {
  return {
    mode: "test_convergence",
    counts: { uniqueRepositoryResearch: repositories.length },
    repositories
  };
}

function record(overrides = {}) {
  return {
    repository: "example/tool",
    label: "Example Tool",
    repositoryVerified: true,
    license: "MIT",
    licenseRisk: "low",
    commercialUseStatus: "allowed_after_review",
    runtimeClass: "worker_service",
    integrationStatus: "research_only",
    integrationMode: "reference_only",
    productFit: ["Creator Studio"],
    capabilities: ["media pipeline"],
    safety: [],
    blockedUses: [],
    sourceRecords: [{ sourceId: 10 }],
    seenInBatches: [10],
    enabledInProduction: false,
    ...overrides
  };
}

describe("research-to-runtime capability planner", () => {
  it("classifies every converged repository without granting execution authority", () => {
    const source = [
      record(),
      record({ repository: "example/dev-tool", runtimeClass: "developer_cli", productFit: ["Internal development"] }),
      record({ repository: "example/unlicensed", license: "NOASSERTION", licenseRisk: "unknown" })
    ];
    const plan = getRuntimeCapabilityPlan({
      convergence: convergence(source),
      providerState: {
        local_rules: { enabled: true, status: "ready" },
        openai: { enabled: false, status: "disabled", model: "gpt-test", host: "api.openai.com" },
        anthropic: { enabled: false, status: "disabled", model: "claude-test", host: "api.anthropic.com" }
      }
    });

    assert.equal(plan.sourceRepositoryCount, 3);
    assert.equal(plan.research.length, 3);
    assert.equal(plan.research.every((item) => item.canExecuteFromPlan === false), true);
    assert.equal(plan.research.every((item) => item.executionAuthority === "none_from_research"), true);
    assert.equal(plan.promotionPolicy.rule, "Research presence never grants execution authority.");
  });

  it("blocks missing-license and unverified research records", () => {
    const noLicense = planResearchRecord(record({ license: "NOASSERTION", licenseRisk: "unknown" }));
    assert.equal(noLicense.adoptionTier, "blocked");
    assert.equal(noLicense.licenseDisposition, "blocked_license_review");

    const unverified = planResearchRecord(record({ repositoryVerified: false, license: "MIT" }));
    assert.equal(unverified.adoptionTier, "blocked");
    assert.equal(unverified.licenseDisposition, "blocked_unverified_repository");
  });

  it("keeps security-sensitive and provider-limit-bypass research out of production authority", () => {
    const sensitive = planResearchRecord(record({
      repository: "example/device-tracker",
      capabilities: ["device activity tracker"],
      safety: ["privacy-sensitive"]
    }));
    assert.equal(sensitive.securityDisposition, "security_privacy_or_dual_use_review");
    assert.equal(sensitive.canExecuteFromPlan, false);

    const bypass = planResearchRecord(record({
      repository: "example/subscription-rotator",
      capabilities: ["subscription pool", "credential rotation"],
      blockedUses: ["limit bypass"]
    }));
    assert.equal(bypass.securityDisposition, "restricted_or_blocked");
    assert.equal(bypass.adoptionTier, "blocked");
  });

  it("represents hosted providers as optional external APIs and never executes them from planning", () => {
    const plan = getRuntimeCapabilityPlan({
      convergence: convergence([]),
      providerState: {
        local_rules: { enabled: true, status: "ready" },
        openai: { enabled: true, status: "configured", model: "gpt-test", host: "api.openai.com" },
        anthropic: { enabled: false, status: "disabled", model: "claude-test", host: "api.anthropic.com" }
      }
    });
    const openai = plan.runtimeCore.find((item) => item.key === "hosted_openai");
    const anthropic = plan.runtimeCore.find((item) => item.key === "hosted_anthropic");

    assert.equal(openai.runtimeLane, "external_api");
    assert.equal(openai.executionAuthority, "draft_content_only_via_agent_runner");
    assert.equal(openai.canExecuteFromPlan, false);
    assert.equal(anthropic.executionAuthority, "setup_required");
    assert.equal(anthropic.canExecuteFromPlan, false);
  });

  it("maps research to the product surfaces it can inform without widening access", () => {
    assert.deepEqual(
      inferProductTargets(record({
        label: "Marketing media analytics",
        productFit: ["Growth Studio", "Creator Studio"],
        capabilities: ["campaign analytics", "video content"]
      })),
      ["Creator Studio™", "Growth Studio™"]
    );
  });
});

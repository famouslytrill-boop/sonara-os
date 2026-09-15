"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCREENSHOT_TOOL_RADAR_BATCH7,
  NON_REPOSITORY_REFERENCES_BATCH7,
  getScreenshotToolReadinessBatch7
} = require("../lib/sonara-screenshot-tool-radar-batch7.cjs");
const {
  CAPABILITY_BATCH8,
  DESIGN_BATCH9,
  getCapabilityDesignReadiness
} = require("../lib/sonara-capability-design-batches.cjs");
const {
  BATCH10_OPERATIONAL_REVIEW,
  BATCH10_REPOSITORY_REVIEW,
  BATCH10_UNRESOLVED_LEADS,
  getBatch10OperationalReview
} = require("../lib/sonara-batch10-operational-review.cjs");
const {
  CONTROL_STAGES,
  getComplianceEvidenceReadiness
} = require("../lib/sonara-compliance-evidence-readiness.cjs");

describe("seventh screenshot tool research batch", () => {
  it("keeps every supplied repository non-executing and human-reviewed", () => {
    const readiness = getScreenshotToolReadinessBatch7();
    assert.equal(readiness.repositoryCount, SCREENSHOT_TOOL_RADAR_BATCH7.length);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositories.every((item) => item.enabledInProduction === false));
    assert.ok(readiness.repositories.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(readiness.repositories.every((item) => item.canExecute === false));
    assert.ok(readiness.repositories.every((item) => item.humanReviewRequired));
  });

  it("retains explicit boundaries for sensitive and reciprocal-license projects", () => {
    for (const key of ["hackagent", "rengine", "torbot", "hiring_agent", "fleetbase", "gpty"]) {
      const item = SCREENSHOT_TOOL_RADAR_BATCH7.find((candidate) => candidate.key === key);
      assert.ok(item, `missing ${key}`);
      assert.match(item.blockedUses.join(" "), /unauthorized|consequential|production execution/i);
      assert.equal(item.enabledInProduction, false);
    }
    for (const key of ["fluxer", "convertx", "gpty", "rengine", "torbot"]) {
      const item = SCREENSHOT_TOOL_RADAR_BATCH7.find((candidate) => candidate.key === key);
      assert.match(item.license, /AGPL|GPL/);
      assert.equal(item.integrationStatus, "research_only");
    }
  });

  it("keeps screenshot claims without authoritative upstreams out of the executable repository list", () => {
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.length >= 15);
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.every((item) => !Object.hasOwn(item, "repository")));
    assert.ok(NON_REPOSITORY_REFERENCES_BATCH7.every((item) => item.safety.length > 0));
  });

  it("wires Batches 5 through 7 into the aggregate catalog and counts", () => {
    const route = fs.readFileSync(path.join(__dirname, "../routes/sonara-requested-repositories-routes.cjs"), "utf8");
    for (const batch of [5, 6, 7]) {
      assert.match(route, new RegExp(`getScreenshotToolReadinessBatch${batch}`));
      assert.match(route, new RegExp(`screenshotBatch${batch}\\.repositories`));
      assert.match(route, new RegExp(`screenshotBatch${batch}\\.repositoryCount`));
    }
    assert.match(route, /getNonRepositoryReferencesBatch7/);
  });
});

describe("Batch 8 capability truth and Batch 9 design convergence", () => {
  it("keeps the follow-on batches descriptive rather than executable", () => {
    const readiness = getCapabilityDesignReadiness();
    assert.equal(readiness.batch8Count, CAPABILITY_BATCH8.length);
    assert.equal(readiness.batch9Count, DESIGN_BATCH9.length);
    assert.equal(readiness.productionExecutionAdded, 0);
    assert.equal(CAPABILITY_BATCH8.length, 8);
    assert.equal(DESIGN_BATCH9.length, 8);
    assert.ok(CAPABILITY_BATCH8.every((item) => item.enabledByThisBatch === false));
    assert.ok(CAPABILITY_BATCH8.every((item) => item.canExecuteFromThisRecord === false));
    assert.ok(DESIGN_BATCH9.every((item) => item.enabledByThisBatch === false));
    assert.ok(DESIGN_BATCH9.every((item) => item.canExecuteFromThisRecord === false));
  });

  it("gives every capability claim source evidence and a runtime boundary", () => {
    const keys = CAPABILITY_BATCH8.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const item of CAPABILITY_BATCH8) {
      assert.ok(item.capabilities.length > 0, `${item.key} has no capability claim`);
      assert.ok(item.evidence.length > 0, `${item.key} has no evidence`);
      assert.ok(item.boundaries.length > 0, `${item.key} has no boundary`);
      assert.ok(item.humanReviewRequired, `${item.key} is missing human review`);
    }

    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "sonara_one_platform")?.capabilityStatus, "available_core");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "business_builder_operations")?.capabilityStatus, "available_with_setup");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "creator_studio_production")?.capabilityStatus, "available_with_setup");
    assert.equal(CAPABILITY_BATCH8.find((item) => item.key === "growth_studio_campaigns")?.capabilityStatus, "available_with_setup");
  });

  it("does not turn Claude or ChatGPT compatibility into provider authority", () => {
    const claude = CAPABILITY_BATCH8.find((item) => item.key === "claude_skill_workflow");
    const chatgpt = CAPABILITY_BATCH8.find((item) => item.key === "chatgpt_plugin_workflow");
    assert.equal(claude.externalStatus, "compatible_workflow_not_customer_runtime");
    assert.equal(chatgpt.externalStatus, "not_connected_by_this_batch");
    assert.match(claude.boundaries.join(" "), /cannot bypass release gates|broader authority/i);
    assert.match(chatgpt.boundaries.join(" "), /not packaged.*production ChatGPT plugin|authorization/i);
    assert.match(chatgpt.boundaries.join(" "), /providerCalled=false/i);
  });

  it("makes the current v3 identity authoritative and leaves known correctness work visible", () => {
    const keys = DESIGN_BATCH9.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    const identity = DESIGN_BATCH9.find((item) => item.key === "v3_identity_authority");
    const booking = DESIGN_BATCH9.find((item) => item.key === "booking_calendar_revision_sequence");
    assert.equal(identity.status, "active");
    assert.match(identity.rule, /SONARA One.*v3/i);
    assert.match(identity.rule, /legacy Prism Wave.*compatibility/i);
    assert.equal(booking.status, "fix_required");
    assert.match(booking.rule, /monotonically advance.*SEQUENCE/i);
    assert.match(booking.rule, /does not identify a writer/i);
  });

  it("wires capability/design convergence into founder readiness without inflating repository counts", () => {
    const route = fs.readFileSync(path.join(__dirname, "../routes/sonara-requested-repositories-routes.cjs"), "utf8");
    assert.match(route, /getCapabilityDesignReadiness/);
    assert.match(route, /capabilityBatch8: convergence\.capabilities/);
    assert.match(route, /designBatch9: convergence\.designs/);
    assert.match(route, /convergenceProductionExecutionAdded: convergence\.productionExecutionAdded/);
    assert.doesNotMatch(route, /screenshotResearchCount[^\n]+were verified/i);
  });
});

describe("Batch 10 operational source review", () => {
  it("turns uploaded material into non-executing requirements instead of new runtime authority", () => {
    const review = getBatch10OperationalReview();
    assert.equal(review.batch, 10);
    assert.equal(review.recordCount, BATCH10_OPERATIONAL_REVIEW.length);
    assert.equal(review.repositoryCount, BATCH10_REPOSITORY_REVIEW.length);
    assert.equal(review.unresolvedLeadCount, BATCH10_UNRESOLVED_LEADS.length);
    assert.equal(review.productionExecutionAdded, 0);
    assert.ok(BATCH10_OPERATIONAL_REVIEW.length >= 7);
    assert.ok(BATCH10_OPERATIONAL_REVIEW.every((item) => item.enabledByThisBatch === false));
    assert.ok(BATCH10_OPERATIONAL_REVIEW.every((item) => item.canExecuteFromThisRecord === false));
    assert.ok(BATCH10_OPERATIONAL_REVIEW.every((item) => item.humanReviewRequired === true));
    assert.ok(BATCH10_REPOSITORY_REVIEW.every((item) => item.enabledInProduction === false));
    assert.ok(BATCH10_REPOSITORY_REVIEW.every((item) => item.runtimeStatus === "not_executed"));
    assert.ok(BATCH10_REPOSITORY_REVIEW.every((item) => item.canExecute === false));
    assert.ok(BATCH10_REPOSITORY_REVIEW.every((item) => item.humanReviewRequired === true));
  });

  it("keeps the uploaded source classes and implementation boundaries explicit", () => {
    const byKey = Object.fromEntries(BATCH10_OPERATIONAL_REVIEW.map((item) => [item.key, item]));
    assert.equal(byKey.compliance_control_model.source, "How-to-build-compliance-strategy_copy.pdf");
    assert.equal(byKey.payment_cost_and_dispute_transparency.source, "Ebook-Secrets-of-Payment-Processing_copy.pdf");
    assert.equal(byKey.generative_ai_governance.source, "ebook_mit-cio-generative-ai-report_copy.pdf");
    assert.equal(byKey.saas_launch_operating_method.source, "SaasSArchitects(1).pdf");
    assert.match(byKey.payment_cost_and_dispute_transparency.requirements.join(" "), /Do not hard-code.*fee averages/i);
    assert.match(byKey.generative_ai_governance.requirements.join(" "), /Provider Gateway|model\/provider choice centralized/i);
    assert.match(byKey.authorized_security_research.requirements.join(" "), /owned or explicitly authorized target/i);
  });

  it("records verified repositories without turning them into production dependencies", () => {
    const keys = BATCH10_REPOSITORY_REVIEW.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    const repositories = BATCH10_REPOSITORY_REVIEW.map((item) => item.repository);
    assert.equal(new Set(repositories).size, repositories.length);

    const byKey = Object.fromEntries(BATCH10_REPOSITORY_REVIEW.map((item) => [item.key, item]));
    assert.equal(byKey.page_agent.repository, "alibaba/page-agent");
    assert.equal(byKey.page_agent.license, "MIT");
    assert.equal(byKey.open_code_review.repository, "alibaba/open-code-review");
    assert.equal(byKey.open_code_review.license, "Apache-2.0");
    assert.equal(byKey.recordly.license, "AGPL-3.0");
    assert.match(byKey.recordly.boundary, /Copyleft review required/i);
    assert.equal(byKey.visionnote_ai.license, "NOASSERTION");
    assert.equal(byKey.visionnote_ai.licenseStatus, "source_adoption_blocked_no_declared_license");
    assert.equal(byKey.blue_team_catalog.licenseStatus, "source_adoption_blocked_no_declared_license");
    assert.equal(byKey.system_design_architecture.licenseStatus, "source_adoption_blocked_no_declared_license");
  });

  it("keeps ambiguous screenshot leads unresolved instead of guessing canonical upstreams", () => {
    const byKey = Object.fromEntries(BATCH10_UNRESOLVED_LEADS.map((item) => [item.key, item]));
    assert.ok(byKey.agent_quest);
    assert.ok(byKey.threejs_object_sculptor);
    assert.ok(byKey.tel_agent);
    assert.ok(byKey.userhunter);
    assert.ok(byKey.mcp_project_planner);
    assert.match(byKey.threejs_object_sculptor.reason, /Multiple similarly named/i);
    assert.match(byKey.mcp_project_planner.reason, /hosted MCP endpoint/i);
  });
});

describe("compliance evidence readiness", () => {
  it("never turns setup evidence into a compliance or certification claim", () => {
    const readiness = getComplianceEvidenceReadiness({
      services: {
        accountDatabase: "configured",
        adminProtection: "configured",
        paymentConnection: "configured"
      }
    });
    assert.equal(readiness.complianceClaim, false);
    assert.equal(readiness.certificationStatus, "not_assessed");
    assert.equal(readiness.stages.length, CONTROL_STAGES.length);
    assert.ok(readiness.stages.every((stage) => stage.certificationClaim === false));
    assert.ok(readiness.stages.every((stage) => stage.status === "partial_evidence"));
    assert.match(readiness.boundaries.join(" "), /not legal advice.*audit opinion.*certification/i);
  });

  it("keeps data-localization and AI-provider audit gaps visible even when core services are configured", () => {
    const readiness = getComplianceEvidenceReadiness({
      services: {
        accountDatabase: "configured",
        adminProtection: "configured",
        paymentConnection: "configured"
      }
    });
    const protection = readiness.stages.find((stage) => stage.key === "protect_localize");
    const audit = readiness.stages.find((stage) => stage.key === "audit_reporting");
    assert.match(protection.gaps.join(" "), /Data residency.*not verified/i);
    assert.match(audit.gaps.join(" "), /provider\/model.*outcome\/error.*timing.*request provenance/i);
  });

  it("reports setup and review gaps instead of green status when platform evidence is absent", () => {
    const readiness = getComplianceEvidenceReadiness({ services: {} });
    assert.equal(readiness.counts.partialEvidence, 0);
    assert.ok(readiness.counts.setupRequired > 0);
    assert.ok(readiness.counts.reviewRequired > 0);
    assert.ok(readiness.stages.every((stage) => stage.status !== "compliant" && stage.status !== "certified"));
  });
});

"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const { getUnifiedBatchConvergence } = require("../lib/sonara-batch-convergence-engine.cjs");
const { getModelEngineControlPlane, ENGINE_CATALOG } = require("../lib/sonara-model-engine-control-plane.cjs");
const { getAgentSkillStrategyCatalog, SKILL_STRATEGIES } = require("../lib/sonara-agent-skill-strategies.cjs");
const { getSourceEvidenceRegister, SOURCE_EVIDENCE } = require("../lib/sonara-source-evidence-register.cjs");
const {
  getLearningMemoryControlPlane,
  evaluateMemoryCandidate,
  MEMORY_CLASSES
} = require("../lib/sonara-learning-memory-control-plane.cjs");

describe("Batch 1-10 governed convergence", () => {
  it("converges all ten batches plus requested and formal repository registries without creating execution authority", () => {
    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.ok, true);
    assert.equal(convergence.batchCount, 10);
    assert.match(convergence.mode, /batch_1_10_plus_formal_registry/);
    assert.equal(convergence.counts.batches, 10);
    assert.ok(convergence.counts.requestedRegistryRecords > 0);
    assert.ok(convergence.counts.formalOpenSourceRegistryRecords > 50);
    assert.equal(convergence.counts.formalOpenSourceRegistryIntegrity.ok, true);
    assert.ok(convergence.counts.uniqueRepositoryResearch > 50);
    assert.equal(convergence.counts.productionExecutionAdded, 0);
    assert.ok(convergence.repositories.every((item) => item.convergenceExecutionAllowed === false));
  });

  it("deduplicates repositories while preserving provenance from every source", () => {
    const convergence = getUnifiedBatchConvergence();
    const ids = convergence.repositories.map((item) => item.repository.toLowerCase());
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(convergence.repositories.every((item) => Array.isArray(item.sourceRecords) && item.sourceRecords.length > 0));
    assert.ok(convergence.counts.duplicateRepositoryRecordsCollapsed > 0);
  });

  it("keeps the formal registry decision authoritative over older intake metadata", () => {
    const convergence = getUnifiedBatchConvergence();
    const contextMode = convergence.repositories.find((item) => item.repository.toLowerCase() === "mksglu/context-mode");
    assert.ok(contextMode, "formal registry Context Mode record must be represented");
    assert.equal(contextMode.integrationStatus, "blocked");
    assert.match(contextMode.license, /Elastic License 2\.0|ELv2/i);
    assert.ok(contextMode.sourceRecords.some((record) => record.source === "data/open-source-tools.ts"));
  });

  it("preserves current SONARA One and Batch 9 design authority", () => {
    const convergence = getUnifiedBatchConvergence();
    assert.equal(convergence.currentAuthority.publicPlatformName, "SONARA One");
    assert.equal(convergence.currentAuthority.designSystem, "v3 / Balanced Precision");
    assert.match(convergence.currentAuthority.legacyDesignHandling, /historical|compatibility/i);
    assert.ok(convergence.designAuthority.length > 0);
  });
});

describe("model and engine control plane", () => {
  it("keeps engines/models descriptive and non-executing", () => {
    const controlPlane = getModelEngineControlPlane();
    assert.equal(controlPlane.ok, true);
    assert.equal(controlPlane.engineCount, ENGINE_CATALOG.length);
    assert.ok(ENGINE_CATALOG.length >= 16);
    assert.equal(controlPlane.repositoryInventoryCount, getUnifiedBatchConvergence().counts.uniqueRepositoryResearch);
    assert.ok(ENGINE_CATALOG.every((item) => item.enabledByControlPlane === false));
    assert.ok(ENGINE_CATALOG.every((item) => item.canExecuteFromRegistry === false));
    assert.ok(ENGINE_CATALOG.every((item) => item.humanReviewRequired === true));
  });

  it("separates permissive, copyleft, unknown/blocked, and research-only repository classes", () => {
    const controlPlane = getModelEngineControlPlane();
    const openSource = controlPlane.openSource;
    assert.ok(openSource.permissiveCandidateCount > 0);
    assert.ok(openSource.copyleftReviewCount > 0);
    assert.ok(openSource.blockedOrUnknownCount > 0);
    assert.equal(
      openSource.permissiveCandidateCount + openSource.copyleftReviewCount + openSource.blockedOrUnknownCount + openSource.researchOnlyCount,
      controlPlane.openSource.permissiveCandidates.length + controlPlane.openSource.copyleftReview.length + controlPlane.openSource.blockedOrUnknown.length + controlPlane.openSource.researchOnly.length
    );
  });

  it("does not promote low-risk license text when the formal commercial-use decision is blocked", () => {
    const controlPlane = getModelEngineControlPlane();
    const blocked = controlPlane.openSource.blockedOrUnknown.find((item) => /camofox-browser/i.test(item.repository));
    assert.ok(blocked, "conduct-blocked MIT repository must remain blocked");
    assert.match(blocked.license, /MIT/i);
    assert.match(blocked.integrationStatus, /blocked/i);
    assert.ok(!controlPlane.openSource.permissiveCandidates.some((item) => /camofox-browser/i.test(item.repository)));
  });

  it("keeps known copyleft, archived, and model-rights boundaries explicit", () => {
    const byKey = Object.fromEntries(ENGINE_CATALOG.map((item) => [item.key, item]));
    assert.equal(byKey.comfyui.license, "GPL-3.0");
    assert.match(byKey.comfyui.runtimeBoundary, /isolated/i);
    assert.equal(byKey.obs_studio.license, "GPL-2.0");
    assert.match(byKey.blender.license, /GPL/i);
    assert.match(byKey.demucs.adoptionStatus, /archived/i);
    assert.equal(byKey.qwen_image.license, "Apache-2.0");
    assert.match(byKey.qwen_image.restrictions.join(" "), /model-card.*weights.*datasets/i);
    assert.equal(byKey.whisper_cpp.license, "MIT");
    assert.equal(byKey.react_three_fiber.license, "MIT");
  });
});

describe("portable Claude and ChatGPT/Codex strategy contract", () => {
  it("keeps every strategy as instruction context rather than authorization", () => {
    const catalog = getAgentSkillStrategyCatalog();
    assert.equal(catalog.strategyCount, SKILL_STRATEGIES.length);
    assert.ok(SKILL_STRATEGIES.length >= 9);
    assert.ok(SKILL_STRATEGIES.every((item) => item.canExecuteFromRecord === false));
    assert.ok(SKILL_STRATEGIES.every((item) => item.humanReviewRequired === true));
    assert.equal(catalog.packaging.claudeCode.status, "repository_native");
    assert.equal(catalog.packaging.codex.status, "repository_native");
    assert.equal(catalog.packaging.chatgpt.status, "repository_native_strategy_not_installed_as_app");
    assert.equal(catalog.packaging.chatgpt.path, ".ai/shared/CHATGPT_CODEX_BATCH_1_10_STRATEGY.md");
    assert.match(catalog.boundaries.join(" "), /cannot bypass|No skill can bypass/i);
  });

  it("includes strategies for open source, providers/models, memory, each product workflow, security, and release evidence", () => {
    const keys = new Set(SKILL_STRATEGIES.map((item) => item.key));
    for (const key of [
      "governed_batch_convergence",
      "commercial_open_source_adoption",
      "provider_model_selection",
      "learning_memory_governance",
      "creator_media_pipeline",
      "growth_campaign_execution",
      "business_operations_delivery",
      "authorized_security_review",
      "release_evidence_delivery"
    ]) assert.ok(keys.has(key), `missing strategy ${key}`);
  });
});

describe("governed learning and memory", () => {
  it("reports old schemas truthfully without claiming a live semantic-memory product", () => {
    const memory = getLearningMemoryControlPlane({});
    assert.equal(memory.ok, true);
    assert.equal(memory.memoryClassCount, MEMORY_CLASSES.length);
    assert.equal(memory.productionExecutionAdded, 0);
    assert.equal(memory.currentState.projectAgentMemory.status, "repository_native");
    assert.equal(memory.currentState.legacyVectorMemorySchema.status, "schema_present_runtime_not_current");
    assert.equal(memory.currentState.entityAgentMemory.status, "schema_present_runtime_inactive");
    assert.equal(memory.currentState.organizationLearningRuntime.status, "design_and_policy_ready_runtime_not_enabled");
    assert.equal(memory.currentState.semanticRetrieval.status, "not_configured");
  });

  it("blocks secrets and payment credentials from learned memory", () => {
    for (const sensitivity of ["password", "access_token", "api_key", "service_role_key", "raw_card_data", "cvv", "private_key"]) {
      const result = evaluateMemoryCandidate({
        organizationId: "org-1",
        memoryClass: "operational_fact",
        source: "authorized-record",
        purpose: "workspace assistance",
        sensitivity,
        userApproved: true
      });
      assert.equal(result.status, "blocked", `${sensitivity} should never become memory`);
      assert.equal(result.persistable, false);
    }
  });

  it("requires scope, provenance, purpose, and approval before retaining preferences or sensitive context", () => {
    assert.equal(evaluateMemoryCandidate({ memoryClass: "operational_fact" }).status, "blocked");
    assert.equal(evaluateMemoryCandidate({ organizationId: "org-1", memoryClass: "operational_fact" }).status, "review_required");
    assert.equal(evaluateMemoryCandidate({ organizationId: "org-1", memoryClass: "operational_fact", source: "record" }).status, "review_required");
    assert.equal(evaluateMemoryCandidate({ organizationId: "org-1", memoryClass: "owner_preference", source: "owner", purpose: "personalize" }).status, "review_required");
    assert.equal(evaluateMemoryCandidate({ organizationId: "org-1", memoryClass: "owner_preference", source: "owner", purpose: "personalize", userApproved: true }).status, "retain_candidate");
    assert.equal(evaluateMemoryCandidate({ organizationId: "org-1", memoryClass: "product_feedback", source: "feedback", purpose: "improve product", sensitivity: "personal_data" }).status, "review_required");
  });

  it("keeps semantic embeddings optional and provider/model gated", () => {
    const memory = getLearningMemoryControlPlane({ SONARA_EMBEDDING_PROVIDER: "local", SONARA_EMBEDDING_MODEL: "reviewed-model" });
    assert.equal(memory.currentState.semanticRetrieval.status, "configured_requires_runtime_verification");
    assert.equal(memory.currentState.semanticRetrieval.executionEnabledByThisModule, false);
  });
});

describe("uploaded source evidence register", () => {
  it("maps uploaded PDFs, model data, design/research documents, and visual evidence without making them executable", () => {
    const register = getSourceEvidenceRegister();
    assert.equal(register.sourceCount, SOURCE_EVIDENCE.length);
    assert.ok(SOURCE_EVIDENCE.length >= 13);
    assert.ok(SOURCE_EVIDENCE.every((item) => item.executable === false));
    assert.ok(SOURCE_EVIDENCE.every((item) => item.productionAuthority === false));
    assert.ok(SOURCE_EVIDENCE.every((item) => item.humanReviewRequired === true));
    const classes = new Set(SOURCE_EVIDENCE.map((item) => item.sourceClass));
    assert.ok(classes.has("uploaded_pdf"));
    assert.ok(classes.has("uploaded_visual_evidence_set"));
    assert.ok(classes.has("uploaded_machine_readable_model_registry"));
  });

  it("marks the older Claude/Nexus design prompt as historical where it conflicts with current authority", () => {
    const legacy = SOURCE_EVIDENCE.find((item) => item.key === "legacy_claude_design_prompt");
    assert.ok(legacy);
    assert.match(legacy.authority, /historical_superseded/i);
    assert.match(legacy.boundaries.join(" "), /SONARA Nexus.*historical|Prism Wave.*historical|current SONARA One v3/i);
  });
});

describe("convergence application surfaces", () => {
  it("publishes non-secret Batch 1-10 convergence, model/engine, skill, memory, and source evidence JSON", async () => {
    for (const path of [
      "/api/ecosystem/batch-convergence",
      "/api/ecosystem/model-engines",
      "/api/ecosystem/agent-skill-strategies",
      "/api/ecosystem/learning-memory",
      "/api/ecosystem/source-evidence"
    ]) {
      const response = await request(app).get(path).set("Accept", "application/json");
      assert.equal(response.status, 200, `${path} should be public metadata`);
      assert.equal(response.body.ok, true);
      assert.doesNotMatch(response.text, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|GATEWAY_TOKEN|WORKER_TOKEN/);
    }
  });

  it("keeps live readiness and combined control-plane details behind founder/admin auth", async () => {
    const response = await request(app)
      .get("/api/admin/ai-integrations/readiness")
      .set("Accept", "application/json");
    assert.notEqual(response.status, 200);
    assert.ok([401, 503].includes(response.status));
  });
});

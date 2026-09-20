// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  SOURCE_LEADS,
  PLATFORM_PATTERNS,
  AGENT_ROLES,
  BUSINESS_APPLICATIONS,
  SKILLS,
  citationCoverage,
  routeScore,
  memoryWriteDecision,
  backpressureState,
  shardRequirement,
  replicaRequirement,
  boundedLoopStatus,
  getSeptember19PatternConvergence
} = require("../lib/sonara-september19-pattern-convergence.cjs");
const {
  getScreenshotToolReadinessBatch15
} = require("../lib/sonara-screenshot-tool-radar-batch15.cjs");
const {
  MARKET_SNAPSHOT_DATE,
  MARKET_SIGNALS_2026,
  VERTICAL_OPPORTUNITIES,
  STRATEGIC_MARKET_LAYERS_2026,
  TECHNOLOGY_REFERENCE_REPOSITORIES_2026,
  IMPLEMENTATION_SEQUENCE,
  opportunityScore,
  technologyFitScore,
  get2026MarketIntelligence
} = require("../lib/sonara-2026-market-intelligence.cjs");
const {
  BACKEND_RESEARCH_DATE,
  BACKEND_SIGNALS_2026,
  RELIABILITY_PRIMITIVES,
  SELF_REPAIR_LEVELS,
  REFERENCE_REPOSITORIES,
  SHARED_BACKEND_SURFACES,
  backendReliabilityScore,
  retryDelayMs,
  sloBudgetState,
  repairAuthorityDecision,
  ragQualityScore,
  getBackendOperationsIntelligence
} = require("../lib/sonara-backend-operations-intelligence-2026.cjs");
const {
  BACKEND_MARKET_ANALYSIS_DATE,
  BACKEND_MARKET_ANALYSIS_VERSION,
  MARKET_SIGNALS_2026: BACKEND_MARKET_SIGNALS_2026,
  WORKLOAD_ARCHETYPES,
  INDUSTRY_BACKEND_MAP,
  CAPABILITY_PRIORITIES,
  AUTONOMIC_CONTROL_LOOPS,
  MARKET_WEDGES_2026,
  BACKEND_REFERENCE_SYSTEMS_2026,
  capacityHeadroom,
  recoveryConfidenceScore,
  workflowFitnessScore,
  repairAutomationDecision,
  retrySafetyDecision,
  progressiveDeliveryDecision,
  executionFabricDecision,
  autonomicRepairDecision,
  getBackendOperationsMarketAnalysis
} = require("../lib/sonara-backend-operations-market-analysis-2026.cjs");

const {
  FRONTEND_VISUAL_SNAPSHOT_DATE,
  FRONTEND_VISUAL_VERSION,
  FRONTEND_MARKET_SIGNALS_2026,
  FRONTEND_MARKET_SIGNALS_PASS2_2026,
  FRONTEND_REPOSITORY_REFERENCES,
  FRONTEND_REPOSITORY_REFERENCES_PASS2,
  FRONTEND_VISUAL_PRIMITIVES_PASS2,
  FRONTEND_SURFACE_ARCHETYPES,
  FRONTEND_IMPLEMENTATION_SEQUENCE,
  frontendPriorityScore,
  frontendInteractionPresentation,
  operationalCollectionPolicy,
  spatialPresentationPolicy,
  getFrontendVisualIntelligence
} = require("../lib/sonara-frontend-visual-intelligence-2026.cjs");

describe("September 19 platform pattern convergence", () => {
  it("keeps screenshot and third-party references non-executable", () => {
    assert.ok(SOURCE_LEADS.length >= 10);
    assert.equal(SOURCE_LEADS.filter((item) => item.enabledInProduction).length, 0);
    assert.equal(getSeptember19PatternConvergence().productionThirdPartyExecutionCount, 0);
  });

  it("wires Batch 15 into the governed screenshot intake", () => {
    const readiness = getScreenshotToolReadinessBatch15();
    assert.equal(readiness.batch, 15);
    assert.equal(readiness.productionExecutionCount, 0);
    assert.ok(readiness.repositoryCount >= 3);
    assert.ok(readiness.nonRepositoryReferenceCount >= 7);
    assert.equal(readiness.architectureConvergence.version, "1.2.0");
  });

  it("captures architecture, agent, and skill catalogs", () => {
    assert.ok(PLATFORM_PATTERNS.some((item) => item.key === "bounded_agent_harness"));
    assert.ok(PLATFORM_PATTERNS.some((item) => item.key === "control_data_plane_split"));
    assert.ok(AGENT_ROLES.some((item) => item.key === "policy_gate"));
    assert.ok(AGENT_ROLES.some((item) => item.key === "verifier"));
    assert.ok(BUSINESS_APPLICATIONS.some((item) => item.product === "Creator Studio"));
    assert.ok(BUSINESS_APPLICATIONS.some((item) => item.product === "Business Builder"));
    assert.ok(SKILLS.some((item) => item.key === "authorized_security_audit"));
    assert.ok(SKILLS.some((item) => item.key === "media_delivery"));
  });

  it("computes citation coverage deterministically", () => {
    assert.equal(citationCoverage(3, 4), 0.75);
    assert.equal(citationCoverage(0, 0), 0);
    assert.throws(() => citationCoverage(5, 4), /cannot exceed/);
  });

  it("scores routes from quality, reliability, latency, and cost budgets", () => {
    const score = routeScore({
      quality: 0.9,
      reliability: 0.95,
      latencyMs: 500,
      latencyBudgetMs: 1000,
      cost: 0.25,
      costBudget: 1
    });
    assert.equal(score, 0.83);
    assert.throws(() => routeScore({
      quality: 1,
      reliability: 1,
      latencyMs: 0,
      latencyBudgetMs: 1,
      cost: 0,
      costBudget: 1,
      weights: { quality: 0.5, reliability: 0.5, latency: 0.5, cost: 0 }
    }), /sum to 1/);
  });

  it("blocks unsafe memory writes and accepts durable consented state", () => {
    assert.deepEqual(
      memoryWriteDecision({ relevance: 1, confidence: 1, durability: 1, sensitive: true, consent: false, ttlDays: 30 }),
      { save: false, score: 1, reason: "sensitive_without_consent" }
    );
    assert.deepEqual(
      memoryWriteDecision({ relevance: 0.9, confidence: 0.9, durability: 0.8, sensitive: false, consent: false, ttlDays: 0 }),
      { save: true, score: 0.88, reason: "policy_pass" }
    );
  });

  it("maps queue pressure to normal, throttle, and shed states", () => {
    assert.equal(backpressureState({ queueDepth: 5, workerCapacity: 10 }).state, "normal");
    assert.equal(backpressureState({ queueDepth: 10, workerCapacity: 10 }).state, "throttle");
    assert.equal(backpressureState({ queueDepth: 20, workerCapacity: 10 }).state, "shed_or_defer");
  });

  it("computes shard and replica requirements with explicit assumptions", () => {
    assert.equal(shardRequirement({ estimatedQps: 700, qpsPerShard: 250, targetUtilization: 0.7 }), 4);
    assert.equal(replicaRequirement({ targetAvailability: 0.999, instanceAvailability: 0.99, maxReplicas: 8 }), 2);
  });

  it("stops bounded loops on verification, policy block, or budget exhaustion", () => {
    assert.deepEqual(boundedLoopStatus({ attempt: 1, maxIterations: 3 }), { continue: true, reason: "within_budget" });
    assert.deepEqual(boundedLoopStatus({ attempt: 1, maxIterations: 3, verified: true }), { continue: false, reason: "verified" });
    assert.deepEqual(boundedLoopStatus({ attempt: 1, maxIterations: 3, blocked: true }), { continue: false, reason: "policy_blocked" });
    assert.deepEqual(boundedLoopStatus({ attempt: 3, maxIterations: 3 }), { continue: false, reason: "iteration_budget_exhausted" });
  });

  it("keeps 2026 market evidence non-executing and date-bounded", () => {
    const snapshot = get2026MarketIntelligence();
    assert.equal(MARKET_SNAPSHOT_DATE, "2026-09-20");
    assert.equal(snapshot.productionExecutionCount, 0);
    assert.equal(snapshot.researchOnly, true);
    assert.ok(MARKET_SIGNALS_2026.length >= 20);
    for (const signal of MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= MARKET_SNAPSHOT_DATE);
    }
  });

  it("maps the requested cross-industry operating surfaces into reusable verticals", () => {
    const keys = new Set(VERTICAL_OPPORTUNITIES.map((item) => item.key));
    for (const key of [
      "agentic_platform_core",
      "small_business_management",
      "restaurant_pos_kiosk",
      "field_services_trades",
      "fleet_logistics_delivery",
      "retail_store_ecommerce",
      "payments_fintech",
      "creator_social_streaming",
      "media_production",
      "manufacturing_robotics",
      "real_estate_rental",
      "gaming_interactive_spatial",
      "education_translation",
      "security_identity_monitoring",
      "public_sector_integrations"
    ]) {
      assert.equal(keys.has(key), true, `missing vertical ${key}`);
    }
  });

  it("prioritizes shared platform primitives before specialized regulated integrations", () => {
    assert.ok(IMPLEMENTATION_SEQUENCE.length >= 10);
    assert.equal(
      IMPLEMENTATION_SEQUENCE[0],
      "shared_identity_tenant_entitlement_and_approval_contract"
    );
    assert.equal(
      IMPLEMENTATION_SEQUENCE.at(-1),
      "regulated_partner_integrations_only_after_domain_specific_review"
    );
  });

  it("scores market opportunities deterministically and penalizes implementation risk", () => {
    const lowRisk = opportunityScore({
      pain: 0.9,
      platformReuse: 0.9,
      dataAdvantage: 0.8,
      monetization: 0.8,
      adoptionReadiness: 0.8,
      integrationRisk: 0.2,
      regulatoryRisk: 0.1
    });
    const highRisk = opportunityScore({
      pain: 0.9,
      platformReuse: 0.9,
      dataAdvantage: 0.8,
      monetization: 0.8,
      adoptionReadiness: 0.8,
      integrationRisk: 1,
      regulatoryRisk: 1
    });
    assert.equal(lowRisk, 0.813);
    assert.equal(highRisk, 0.6);
    assert.ok(lowRisk > highRisk);
  });

  it("classifies platform strategy before specialist expansion and keeps repository research non-executing", () => {
    const priorities = new Set(STRATEGIC_MARKET_LAYERS_2026.map((item) => item.priority));
    assert.equal(priorities.has("P0"), true);
    assert.equal(priorities.has("P1"), true);
    assert.equal(priorities.has("P2"), true);
    assert.equal(priorities.has("PARTNER_ONLY"), true);
    assert.equal(priorities.has("WATCH"), true);
    assert.ok(STRATEGIC_MARKET_LAYERS_2026.some((item) => item.key === "governed_control_plane"));
    assert.ok(STRATEGIC_MARKET_LAYERS_2026.some((item) => item.key === "vertical_operating_packs"));
    assert.ok(TECHNOLOGY_REFERENCE_REPOSITORIES_2026.length >= 10);
    assert.equal(TECHNOLOGY_REFERENCE_REPOSITORIES_2026.filter((item) => item.installedByResearch).length, 0);
    assert.equal(TECHNOLOGY_REFERENCE_REPOSITORIES_2026.filter((item) => item.enabledInProduction).length, 0);
  });

  it("scores technology fit deterministically while penalizing integration, lock-in, and license risk", () => {
    const reusable = technologyFitScore({
      interoperability: 0.95,
      platformReuse: 0.95,
      maturity: 0.9,
      maintainability: 0.85,
      ecosystem: 0.9,
      securityFit: 0.9,
      integrationRisk: 0.15,
      lockInRisk: 0.1,
      licenseRisk: 0.05
    });
    const risky = technologyFitScore({
      interoperability: 0.5,
      platformReuse: 0.5,
      maturity: 0.6,
      maintainability: 0.5,
      ecosystem: 0.5,
      securityFit: 0.4,
      integrationRisk: 0.9,
      lockInRisk: 0.9,
      licenseRisk: 0.9
    });
    assert.equal(reusable, 0.875);
    assert.equal(risky, 0.185);
    assert.ok(reusable > risky);
  });

  it("exposes market intelligence through the existing platform-pattern contract", () => {
    const convergence = getSeptember19PatternConvergence();
    assert.equal(convergence.marketSignalCount, MARKET_SIGNALS_2026.length);
    assert.equal(convergence.verticalOpportunityCount, VERTICAL_OPPORTUNITIES.length);
    assert.equal(convergence.marketIntelligence.snapshotDate, MARKET_SNAPSHOT_DATE);
    assert.equal(convergence.marketIntelligence.productionExecutionCount, 0);
    assert.equal(convergence.marketIntelligence.strategicMarketLayerCount, STRATEGIC_MARKET_LAYERS_2026.length);
    assert.equal(convergence.marketIntelligence.technologyReferenceRepositoryCount, TECHNOLOGY_REFERENCE_REPOSITORIES_2026.length);
  });

  it("keeps backend operations research non-executing, current, and repository-safe", () => {
    const backend = getBackendOperationsIntelligence();
    assert.equal(BACKEND_RESEARCH_DATE, "2026-09-20");
    assert.equal(backend.researchOnly, true);
    assert.equal(backend.productionExecutionCount, 0);
    assert.equal(backend.installedRepositoryCount, 0);
    assert.ok(BACKEND_SIGNALS_2026.length >= 15);
    assert.ok(RELIABILITY_PRIMITIVES.length >= 15);
    assert.equal(SELF_REPAIR_LEVELS.length, 6);
    assert.ok(REFERENCE_REPOSITORIES.length >= 8);
    assert.ok(SHARED_BACKEND_SURFACES.length >= 10);
    assert.equal(REFERENCE_REPOSITORIES.filter((item) => item.installedByResearch).length, 0);
    assert.equal(REFERENCE_REPOSITORIES.filter((item) => item.enabledInProduction).length, 0);
    for (const signal of BACKEND_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.ok(signal.sourceUrl.startsWith("https://"));
    }
  });

  it("scores backend reliability, retry delay, SLO budget and RAG quality deterministically", () => {
    assert.equal(backendReliabilityScore({
      availability: 0.999,
      correctness: 0.99,
      recoveryCoverage: 0.9,
      observabilityCoverage: 0.95,
      latencyP95Ms: 300,
      latencyBudgetMs: 600
    }), 0.8948);
    assert.equal(retryDelayMs({ baseMs: 250, attempt: 3, maxMs: 5000 }), 2000);
    assert.deepEqual(
      sloBudgetState({ totalRequests: 10000, failedRequests: 5, targetSuccessRate: 0.999 }),
      { actualSuccessRate: 0.9995, allowedFailures: 10, remainingFailures: 5, budgetState: "within_budget" }
    );
    assert.equal(ragQualityScore({
      recall: 0.9,
      groundedness: 0.95,
      citationCoverage: 1,
      latencyP95Ms: 400,
      latencyBudgetMs: 800
    }), 0.9);
  });

  it("permits only bounded runtime recovery and sends source/schema repair through branch gates", () => {
    assert.deepEqual(
      repairAuthorityDecision({
        evidenceFreshness: 0.95,
        blastRadius: 0.05,
        tenantScoped: true,
        deterministic: true,
        reversible: true
      }),
      { allowed: true, mode: "bounded_runtime_recovery", reason: "preapproved_reversible_reconciliation" }
    );
    assert.deepEqual(
      repairAuthorityDecision({
        evidenceFreshness: 1,
        blastRadius: 0.01,
        tenantScoped: true,
        deterministic: true,
        reversible: true,
        changesCode: true
      }),
      { allowed: false, mode: "branch_repair_required", reason: "source_or_schema_change" }
    );
    assert.equal(
      repairAuthorityDecision({
        evidenceFreshness: 1,
        blastRadius: 0,
        tenantScoped: false,
        deterministic: true,
        reversible: true
      }).mode,
      "blocked"
    );
  });

  it("exposes backend intelligence through the platform-pattern convergence contract", () => {
    const convergence = getSeptember19PatternConvergence();
    assert.equal(convergence.version, "1.2.0");
    assert.equal(convergence.backendSignalCount, BACKEND_SIGNALS_2026.length);
    assert.equal(convergence.backendReliabilityPrimitiveCount, RELIABILITY_PRIMITIVES.length);
    assert.equal(convergence.selfRepairLevelCount, SELF_REPAIR_LEVELS.length);
    assert.equal(convergence.backendOperationsIntelligence.productionExecutionCount, 0);
  });

  it("keeps backend market analysis current, cross-industry, and non-executing", () => {
    const market = getBackendOperationsMarketAnalysis();
    assert.equal(BACKEND_MARKET_ANALYSIS_DATE, "2026-09-20");
    assert.equal(market.researchOnly, true);
    assert.equal(market.productionExecutionCount, 0);
    assert.equal(market.installedRepositoryCount, 0);
    assert.ok(BACKEND_MARKET_SIGNALS_2026.length >= 33);
    assert.ok(WORKLOAD_ARCHETYPES.length >= 10);
    assert.ok(INDUSTRY_BACKEND_MAP.length >= 10);
    assert.ok(CAPABILITY_PRIORITIES.length >= 5);
    assert.ok(AUTONOMIC_CONTROL_LOOPS.length >= 6);
    assert.ok(MARKET_WEDGES_2026.length >= 7);
    assert.ok(BACKEND_REFERENCE_SYSTEMS_2026.length >= 12);
    assert.equal(BACKEND_MARKET_ANALYSIS_VERSION, "1.2.0");
    assert.equal(BACKEND_REFERENCE_SYSTEMS_2026.filter((item) => item.installedByResearch).length, 0);
    assert.equal(BACKEND_REFERENCE_SYSTEMS_2026.filter((item) => item.enabledInProduction).length, 0);
    for (const signal of BACKEND_MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.equal(signal.asOf, BACKEND_MARKET_ANALYSIS_DATE);
      assert.ok(signal.sourceUrl.startsWith("https://"));
    }
    const verticals = new Set(INDUSTRY_BACKEND_MAP.map((item) => item.key));
    for (const key of [
      "restaurant_pos_kiosk_reservations_rsvp",
      "trades_hvac_electrical_plumbing_carpentry_cleaning",
      "trucking_delivery_waste_logistics",
      "retail_ecommerce_marketplace",
      "creator_social_streaming_media_books_podcasts",
      "manufacturing_robotics_cad_printing",
      "finance_banking_investment_insurance",
      "education_translation_classroom_public_access_government",
      "gaming_ar_spatial_device",
      "ai_agents_llms_skills_rag"
    ]) {
      assert.equal(verticals.has(key), true, `missing backend vertical ${key}`);
    }
  });

  it("scores capacity, recovery and durable-workflow fitness deterministically", () => {
    assert.equal(capacityHeadroom({ peakObserved: 60, safeCapacity: 100 }), 0.4);
    assert.equal(recoveryConfidenceScore({
      detectionCoverage: 0.9,
      runbookCoverage: 0.8,
      rollbackCoverage: 0.95,
      testFreshness: 0.85
    }), 0.875);
    assert.equal(workflowFitnessScore({
      correctness: 0.95,
      durability: 0.9,
      auditability: 0.95,
      latencyFit: 0.8,
      costFit: 0.7
    }), 0.89);
    assert.deepEqual(repairAutomationDecision({
      evidenceFreshness: 0.95,
      blastRadius: 0.05,
      deterministic: true,
      reversible: true,
      tenantScoped: true
    }), { automate: true, mode: "bounded_reconciliation", reason: "preapproved_low_risk_repair" });
    assert.equal(repairAutomationDecision({
      evidenceFreshness: 1,
      blastRadius: 0,
      deterministic: true,
      reversible: true,
      tenantScoped: true,
      authoritySensitive: true
    }).mode, "human_approval_required");
  });


  it("classifies retry safety before consuming reliability budget", () => {
    assert.deepEqual(retrySafetyDecision({
      attempt: 1,
      maxAttempts: 4,
      remainingDeadlineMs: 5000,
      nextDelayMs: 500,
      retryable: true,
      idempotent: true
    }), { retry: true, mode: "bounded_retry", reason: "transient_idempotent_operation" });

    assert.equal(retrySafetyDecision({
      attempt: 1,
      maxAttempts: 4,
      remainingDeadlineMs: 5000,
      nextDelayMs: 500,
      retryable: true,
      idempotent: false
    }).reason, "idempotency_not_proven");

    assert.equal(retrySafetyDecision({
      attempt: 4,
      maxAttempts: 4,
      remainingDeadlineMs: 5000,
      nextDelayMs: 500,
      retryable: true,
      idempotent: true
    }).mode, "dead_letter");
  });

  it("promotes, holds, pauses or rolls back canaries from exact-SHA evidence", () => {
    const base = {
      sampleCount: 200,
      minSamples: 100,
      errorRate: 0.001,
      errorRateBudget: 0.01,
      latencyP95Ms: 300,
      latencyBudgetMs: 500,
      businessKpi: 0.9,
      businessKpiFloor: 0.8,
      rollbackReady: true,
      exactShaVerified: true
    };
    assert.deepEqual(progressiveDeliveryDecision(base), { decision: "promote", reason: "canary_thresholds_pass" });
    assert.deepEqual(progressiveDeliveryDecision({ ...base, errorRate: 0.05 }), { decision: "rollback", reason: "canary_threshold_breach" });
    assert.deepEqual(progressiveDeliveryDecision({ ...base, sampleCount: 10 }), { decision: "hold", reason: "insufficient_samples" });
    assert.deepEqual(progressiveDeliveryDecision({ ...base, exactShaVerified: false }), { decision: "blocked", reason: "exact_sha_not_verified" });
  });

  it("selects backend execution fabric from workload evidence without auto-adopting infrastructure", () => {
    assert.deepEqual(
      executionFabricDecision({ databaseAdjacent: true, eventsPerSecond: 25 }),
      { mode: "postgres_outbox_inbox", adoption: "existing_pattern", reason: "transactional_adjacency" }
    );
    assert.deepEqual(
      executionFabricDecision({ workflowDurationMinutes: 30, humanWaits: true }),
      { mode: "durable_workflow", adoption: "evaluate_isolated", reason: "long_lived_or_interactive_workflow" }
    );
    assert.deepEqual(
      executionFabricDecision({ requiresReplay: true, eventsPerSecond: 2500 }),
      { mode: "stream_fabric", adoption: "evaluate_only", reason: "measured_high_throughput_replay_requirement" }
    );
    assert.equal(executionFabricDecision({ offlineEdge: true }).mode, "offline_command_log");
  });

  it("requires fresh abortable low-risk evidence before autonomic repair", () => {
    assert.deepEqual(
      autonomicRepairDecision({
        evidenceFreshness: 0.98,
        blastRadius: 0.02,
        rollbackConfidence: 0.98,
        dataLossRisk: 0,
        deterministic: true,
        reversible: true,
        abortable: true,
        tenantScoped: true
      }),
      { automate: true, mode: "bounded_reconciliation", reason: "fresh_reversible_abortable_low_risk_repair" }
    );
    assert.equal(
      autonomicRepairDecision({
        evidenceFreshness: 0.98,
        blastRadius: 0.02,
        rollbackConfidence: 0.98,
        dataLossRisk: 0.1,
        deterministic: true,
        reversible: true,
        abortable: true,
        tenantScoped: true
      }).reason,
      "data_loss_risk"
    );
    assert.equal(
      autonomicRepairDecision({
        evidenceFreshness: 0.98,
        blastRadius: 0.02,
        rollbackConfidence: 0.98,
        deterministic: true,
        reversible: true,
        abortable: false,
        tenantScoped: true
      }).mode,
      "observe_only"
    );
    assert.equal(
      autonomicRepairDecision({
        evidenceFreshness: 1,
        blastRadius: 0,
        rollbackConfidence: 1,
        deterministic: true,
        reversible: true,
        abortable: true,
        tenantScoped: true,
        changesSchema: true
      }).mode,
      "branch_only"
    );
  });

  it("keeps Pass 6 backend reference systems governed and non-executing", () => {
    const byRepo = new Map(BACKEND_REFERENCE_SYSTEMS_2026.map((item) => [item.repository, item]));
    assert.equal(byRepo.get("dbos-inc/dbos-transact-ts").licensePosture, "MIT");
    assert.equal(byRepo.get("restatedev/restate").licensePosture, "BSL-1.1");
    assert.equal(byRepo.get("grafana/k6").adoptionState, "external_developer_tool");
    assert.equal(byRepo.get("argoproj/argo-rollouts").adoptionState, "future_kubernetes_only");
    for (const item of BACKEND_REFERENCE_SYSTEMS_2026) {
      assert.equal(item.installedByResearch, false);
      assert.equal(item.enabledInProduction, false);
    }
  });

  it("models self-repair as bounded control loops rather than production source mutation", () => {
    const keys = new Set(AUTONOMIC_CONTROL_LOOPS.map((item) => item.key));
    for (const key of [
      "queue_stall_recovery",
      "provider_degradation",
      "workflow_checkpoint_recovery",
      "release_regression",
      "projection_reconciliation",
      "agent_tool_recovery"
    ]) {
      assert.equal(keys.has(key), true, `missing autonomic control loop ${key}`);
    }
    const market = getBackendOperationsMarketAnalysis();
    assert.equal(market.autonomicControlLoopCount, AUTONOMIC_CONTROL_LOOPS.length);
    assert.equal(market.marketWedgeCount, MARKET_WEDGES_2026.length);
    assert.equal(market.productionExecutionCount, 0);
  });

  it("exposes backend market analysis through platform convergence without runtime authority", () => {
    const convergence = getSeptember19PatternConvergence();
    const market = getBackendOperationsMarketAnalysis();
    assert.equal(convergence.version, "1.2.0");
    assert.equal(convergence.backendMarketSignalCount, market.marketSignalCount);
    assert.equal(convergence.backendWorkloadArchetypeCount, market.workloadArchetypeCount);
    assert.equal(convergence.backendIndustryMapCount, market.industryMapCount);
    assert.equal(convergence.backendOperationsMarketAnalysis.productionExecutionCount, 0);
  });

  it("keeps frontend pass-2 primitives and version explicit", () => {
    const frontend = getFrontendVisualIntelligence();
    assert.equal(FRONTEND_VISUAL_VERSION, "1.1.0");
    assert.equal(frontend.version, FRONTEND_VISUAL_VERSION);
    assert.equal(frontend.visualPrimitiveCount, FRONTEND_VISUAL_PRIMITIVES_PASS2.length);
    assert.ok(FRONTEND_VISUAL_PRIMITIVES_PASS2.length >= 15);
  });

  it("maps interaction risk to deterministic presentation and approval states", () => {
    assert.deepEqual(
      frontendInteractionPresentation({ risk: 0.1 }),
      { mode: "direct_reversible_action", previewRequired: false, auditRequired: false, undoExpected: true }
    );
    assert.equal(frontendInteractionPresentation({ risk: 0.4 }).mode, "preview_then_apply");
    assert.equal(frontendInteractionPresentation({ externalWrite: true }).mode, "confirm_before_execute");
    assert.equal(frontendInteractionPresentation({ moneyMovement: true }).mode, "explicit_human_approval");
  });

  it("chooses collection and spatial presentation from measurable constraints", () => {
    assert.deepEqual(
      operationalCollectionPolicy({ rowCount: 6000, columnCount: 14, containerWidthPx: 1200 }),
      { layout: "table", dataStrategy: "server_paginated", detailStrategy: "progressive_disclosure" }
    );
    assert.deepEqual(
      operationalCollectionPolicy({ rowCount: 200, columnCount: 6, containerWidthPx: 600 }),
      { layout: "priority_list", dataStrategy: "eager", detailStrategy: "progressive_disclosure" }
    );
    assert.equal(spatialPresentationPolicy({ informationBearing: false }).mode, "avoid_decorative_3d");
    assert.equal(
      spatialPresentationPolicy({ informationBearing: true, compactDevice: true }).mode,
      "two_dimensional_primary_spatial_on_demand"
    );
    assert.equal(
      spatialPresentationPolicy({ informationBearing: true, webGpuAvailable: true }).mode,
      "progressive_information_bearing_3d"
    );
  });

  it("keeps frontend and visual research current, non-executing, and source-grounded", () => {
    const intelligence = getFrontendVisualIntelligence();
    assert.equal(FRONTEND_VISUAL_SNAPSHOT_DATE, "2026-09-20");
    assert.equal(intelligence.productionExecutionCount, 0);
    assert.equal(intelligence.researchOnly, true);
    assert.ok(FRONTEND_MARKET_SIGNALS_2026.length >= 15);
    assert.ok(FRONTEND_REPOSITORY_REFERENCES.length >= 6);
    for (const signal of FRONTEND_MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= FRONTEND_VISUAL_SNAPSHOT_DATE);
    }
  });

  it("maps the frontend research into task-specific surface archetypes", () => {
    const keys = new Set(FRONTEND_SURFACE_ARCHETYPES.map((item) => item.key));
    for (const key of [
      "business_command_center",
      "agent_workspace",
      "rag_evidence_workspace",
      "records_and_data_table",
      "calendar_scheduler",
      "pos_counter",
      "kiosk_self_service",
      "restaurant_kitchen_fulfillment",
      "field_service_mobile",
      "fleet_map_dispatch",
      "commerce_storefront_checkout",
      "creator_media_workbench",
      "analytics_observability",
      "spatial_3d_viewer"
    ]) {
      assert.equal(keys.has(key), true, `missing frontend surface ${key}`);
    }
    assert.ok(FRONTEND_IMPLEMENTATION_SEQUENCE.length >= 10);
  });

  it("prioritizes frontend work deterministically while penalizing interaction risk", () => {
    const lowerRisk = frontendPriorityScore({
      taskFrequency: 0.9,
      operationalCriticality: 0.9,
      platformReuse: 0.9,
      mobileImportance: 0.8,
      revenueOrServiceImpact: 0.8,
      implementationRisk: 0.2,
      interactionRisk: 0.2
    });
    const higherRisk = frontendPriorityScore({
      taskFrequency: 0.9,
      operationalCriticality: 0.9,
      platformReuse: 0.9,
      mobileImportance: 0.8,
      revenueOrServiceImpact: 0.8,
      implementationRisk: 1,
      interactionRisk: 1
    });
    assert.ok(lowerRisk > higherRisk);
    assert.throws(() => frontendPriorityScore({
      taskFrequency: 2,
      operationalCriticality: 1,
      platformReuse: 1,
      mobileImportance: 1,
      revenueOrServiceImpact: 1,
      implementationRisk: 0,
      interactionRisk: 0
    }), /between 0 and 1/);
  });

  it("exposes frontend visual intelligence through the platform-pattern contract", () => {
    const convergence = getSeptember19PatternConvergence();
    const frontend = getFrontendVisualIntelligence();
    assert.equal(convergence.frontendMarketSignalCount, FRONTEND_MARKET_SIGNALS_2026.length + FRONTEND_MARKET_SIGNALS_PASS2_2026.length);
    assert.equal(convergence.frontendSurfaceArchetypeCount, FRONTEND_SURFACE_ARCHETYPES.length);
    assert.equal(convergence.frontendRepositoryReferenceCount, FRONTEND_REPOSITORY_REFERENCES.length + FRONTEND_REPOSITORY_REFERENCES_PASS2.length);
    assert.equal(convergence.frontendVisualIntelligence.snapshotDate, FRONTEND_VISUAL_SNAPSHOT_DATE);
    assert.equal(convergence.frontendVisualIntelligence.productionExecutionCount, 0);
    assert.equal(frontend.formulas.sonaraDefaultTapTargetCssPx, 44);
  });

});
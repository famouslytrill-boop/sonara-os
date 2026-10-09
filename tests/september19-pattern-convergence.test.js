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
  planWorkflowSequence,
  replayWorkflowTrace,
  replayScopedWorkflowTrace,
  evaluateWorkflowRetry,
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
  PRODUCT_WORKFLOW_CONTRACTS,
  backendReliabilityScore,
  retryDelayMs,
  sloBudgetState,
  repairAuthorityDecision,
  OPERATIONAL_MODES,
  operationalTransitionDecision,
  reviewOperationalTransitionLedger,
  maintenanceActionDecision,
  operationalAlertDecision,
  ragQualityScore,
  evaluateProductWorkflowTransition,
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
  FRONTEND_COMPANY_PATTERN_GROUPS_2026,
  FRONTEND_BRAND_KITS_2026,
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
const { SONARA_BRAND_REGISTRY, getBrandProduct } = require("../lib/sonara-brand-registry.cjs");
const { operationalTransitionCoordinator } = require("../lib/sonara-operational-transition-coordinator.cjs");

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

  it("governs pause, resume, maintenance, lockdown, shutdown and startup without bypass", () => {
    const base = {
      from: "active", to: "paused", expectedRevision: 4, observedRevision: 4,
      scope: "platform", scopeVerified: true, actorAuthorized: true, ownerApproved: true
    };
    assert.deepEqual(OPERATIONAL_MODES, ["active", "paused", "maintenance", "lockdown", "offline"]);
    let out = operationalTransitionDecision(base);
    assert.equal(out.candidate, true);
    assert.equal(out.nextRevision, 5);
    assert.equal(out.transitionExecuted, false);
    assert.equal(out.releaseAuthorized, false);
    assert.equal(out.requiresDurableCompareAndSwap, true);
    assert.equal(operationalTransitionDecision({ ...base, expectedRevision: 3 }).reason, "stale_or_missing_revision");
    assert.equal(operationalTransitionDecision({ ...base, observedRevision: 3 }).candidate, false);
    assert.equal(operationalTransitionDecision({ ...base, ownerApproved: false }).reason, "owner_approval_required");
    assert.equal(operationalTransitionDecision({ ...base, actorAuthorized: false }).reason, "operator_authority_unverified");
    assert.equal(operationalTransitionDecision({ ...base, scopeVerified: false }).reason, "scope_unverified");
    assert.equal(operationalTransitionDecision({ ...base, bypassRequested: true }).reason, "policy_bypass_refused");
    assert.equal(operationalTransitionDecision({ ...base, overrideReleaseGate: true }).candidate, false);
    assert.equal(operationalTransitionDecision({ ...base, from: "paused", to: "paused" }).reason, "no_op_transition");
    assert.equal(operationalTransitionDecision({ ...base, from: "offline", to: "active" }).reason, "transition_not_allowed");
    assert.equal(operationalTransitionDecision({ ...base, from: "lockdown", to: "active" }).candidate, false);
    assert.equal(operationalTransitionDecision({ ...base, to: "nonsense" }).reason, "unknown_operational_mode");
    assert.equal(operationalTransitionDecision({ ...base, to: "lockdown" }).reason, "incident_evidence_missing");
    out = operationalTransitionDecision({ ...base, to: "lockdown", verifiedSecurityIncident: true });
    assert.equal(out.candidate, true);
    out = operationalTransitionDecision({ ...base, to: "maintenance" });
    assert.equal(out.reason, "in_flight_jobs_not_drained");
    assert.equal(operationalTransitionDecision({ ...base, to: "maintenance", inFlightJobsDrained: true }).candidate, true);
    assert.equal(operationalTransitionDecision({ ...base, from: "lockdown", to: "paused" }).reason, "recovery_evidence_missing");
    assert.equal(operationalTransitionDecision({ ...base, from: "lockdown", to: "paused",
      incidentClearedVerified: true, recoveryVerified: true }).candidate, true);
    assert.equal(operationalTransitionDecision({ ...base, from: "offline", to: "paused",
      incidentClearedVerified: true, recoveryVerified: true }).candidate, true);
    assert.equal(operationalTransitionDecision({ ...base, from: "paused", to: "active",
      healthVerified: true, releaseGatesVerified: true }).reason, "startup_release_or_health_unverified");
    assert.equal(operationalTransitionDecision({ ...base, from: "paused", to: "active",
      healthVerified: true, releaseGatesVerified: true, incidentClearedVerified: true }).candidate, true);
    assert.equal(operationalTransitionDecision({ ...base, to: "offline" }).reason, "shutdown_plan_unreviewed");
    assert.equal(operationalTransitionDecision({ ...base, to: "offline", safeShutdownPlanReviewed: true })
      .reason, "shutdown_jobs_not_drained");
    assert.equal(operationalTransitionDecision({ ...base, to: "offline", safeShutdownPlanReviewed: true,
      inFlightJobsDrained: true }).candidate, true);
    assert.equal(operationalTransitionDecision(null).candidate, false);
    assert.equal(operationalTransitionDecision({ ...base, observedRevision: Number.MAX_SAFE_INTEGER })
      .reason, "stale_or_missing_revision");
  });

  it("replays version-bound operational receipts and refuses stale authorization or replay", () => {
    const actor = "11111111-1111-4111-8111-111111111111";
    const approver = "22222222-2222-4222-8222-222222222222";
    const evidence = { scopeVerified: true, actorAuthorized: true };
    const make = (id, revision, from, to, occurredAtMs, extra = {}) => ({
      eventId: "evt_" + id, actorId: actor, scope: "platform", organizationId: null,
      from, to, revision, occurredAtMs,
      evidence: { ...evidence, ...extra },
      approval: {
        approvalId: "app_" + id, approvedBy: approver,
        scope: "platform", organizationId: null, from, to,
        expectedRevision: revision - 1,
        issuedAtMs: occurredAtMs - 100, expiresAtMs: occurredAtMs + 500
      }
    });
    const a = make("pause", 8, "active", "paused", 2000);
    const b = make("maintenance", 9, "paused", "maintenance", 3000,
      { inFlightJobsDrained: true });
    const c = make("end", 10, "maintenance", "paused", 4000);
    const d = make("resume", 11, "paused", "active", 5000,
      { healthVerified: true, releaseGatesVerified: true, incidentClearedVerified: true });
    const input = {
      scope: "platform", initialMode: "active", initialRevision: 7,
      events: [a, b, c, d, a]
    };
    let state = reviewOperationalTransitionLedger(input);
    assert.equal(state.mode, "active");
    assert.equal(state.revision, 11);
    assert.equal(state.acceptedEvents, 4);
    assert.equal(state.replayedEvents, 1);
    assert.equal(state.transitionExecuted, false);
    assert.equal(state.authorizationVerified, false);
    assert.equal(state.durableConsistencyProven, false);
    assert.equal(reviewOperationalTransitionLedger({ ...input, events: [] }).revision, 7);

    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [b]
    }), /Out-of-order/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [a, { ...b, revision: 11 }]
    }), /approval|Out-of-order/i);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [a, { ...b, occurredAtMs: 1999 }]
    }), /Stale, cross-scope or unbound|Out-of-order/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [a, { ...b, approval: { ...b.approval, approvalId: a.approval.approvalId } }]
    }), /approval reused/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [a, { ...a, evidence: { ...a.evidence, bypassRequested: true } }]
    }), /Conflicting operational event replay/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [a, { ...b, evidence: { ...b.evidence, bypassRequested: true } }]
    }), /policy_bypass_refused/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [{ ...a, approval: { ...a.approval, expectedRevision: 6 } }]
    }), /Stale, cross-scope or unbound/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [{ ...a, approval: { ...a.approval, expiresAtMs: 1999 } }]
    }), /Stale, cross-scope or unbound/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [{ ...a, approval: { ...a.approval, expiresAtMs: 9000000 } }]
    }), /Stale, cross-scope or unbound/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [{ ...a, evidence: { ...a.evidence, actorAuthorized: false } }]
    }), /operator_authority_unverified/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: [{ ...a, scope: "tenant" }]
    }), /Invalid operational ledger event/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, scope: "tenant", organizationId: "33333333-3333-4333-8333-333333333333"
    }), /Invalid operational ledger event/);
    assert.throws(() => reviewOperationalTransitionLedger({
      ...input, events: new Array(513).fill(a)
    }), /512/);
    assert.throws(() => reviewOperationalTransitionLedger(null), /object/);

    const org = "33333333-3333-4333-8333-333333333333";
    const tenantA = {
      ...a, scope: "tenant", organizationId: org,
      approval: { ...a.approval, scope: "tenant", organizationId: org }
    };
    state = reviewOperationalTransitionLedger({
      scope: "tenant", organizationId: org,
      initialMode: "active", initialRevision: 7, events: [tenantA]
    });
    assert.equal(state.mode, "paused");
    assert.equal(state.organizationId, org);
    assert.throws(() => reviewOperationalTransitionLedger({
      scope: "tenant", organizationId: org, initialMode: "active", initialRevision: 7,
      events: [{ ...tenantA, approval: { ...tenantA.approval, organizationId: "44444444-4444-4444-8444-444444444444" } }]
    }), /Stale, cross-scope or unbound/);
  });

  it("requires incident clearance before lockdown recovery and full release proof before startup", () => {
    const who = "55555555-5555-4555-8555-555555555555";
    const proof = { scopeVerified: true, actorAuthorized: true };
    const event = (name, from, to, revision, evidence) => ({
      eventId: "event_" + name, actorId: who, scope: "platform",
      organizationId: null, from, to, revision, occurredAtMs: revision * 1000,
      evidence: { ...proof, ...evidence },
      approval: {
        approvalId: "approve_" + name, approvedBy: who, scope: "platform", organizationId: null,
        from, to, expectedRevision: revision - 1,
        issuedAtMs: revision * 1000 - 100, expiresAtMs: revision * 1000 + 100
      }
    });
    const lock = event("lock", "active", "lockdown", 2, { verifiedSecurityIncident: true });
    const cleared = event("clear", "lockdown", "paused", 3,
      { incidentClearedVerified: true, recoveryVerified: true });
    const start = event("start", "paused", "active", 4,
      { healthVerified: true, releaseGatesVerified: true, incidentClearedVerified: true });
    let result = reviewOperationalTransitionLedger({
      scope: "platform", initialMode: "active", initialRevision: 1,
      events: [lock, cleared, start]
    });
    assert.equal(result.mode, "active");
    assert.equal(result.revision, 4);
    assert.throws(() => reviewOperationalTransitionLedger({
      scope: "platform", initialMode: "active", initialRevision: 1,
      events: [{ ...lock, evidence: proof }]
    }), /incident_evidence_missing/);
    assert.throws(() => reviewOperationalTransitionLedger({
      scope: "platform", initialMode: "active", initialRevision: 1,
      events: [lock, { ...cleared, evidence: proof }]
    }), /recovery_evidence_missing/);
    assert.throws(() => reviewOperationalTransitionLedger({
      scope: "platform", initialMode: "active", initialRevision: 1,
      events: [lock, cleared, { ...start, evidence: { ...proof, healthVerified: true } }]
    }), /startup_release_or_health_unverified/);
    assert.throws(() => reviewOperationalTransitionLedger({
      scope: "platform", initialMode: "active", initialRevision: 1,
      events: [lock, { ...start, revision: 3, from: "lockdown" }]
    }), /Stale, cross-scope or unbound|transition_not_allowed/);
  });

  it("proposes bounded scans and maintenance but never executes cleanup or defragmentation", () => {
    const base = { action: "security_scan", mode: "active", scopeVerified: true,
      actorAuthorized: true, maxItems: 20, maxDurationMs: 3000 };
    let out = maintenanceActionDecision(base);
    assert.equal(out.candidate, true);
    assert.equal(out.executed, false);
    assert.equal(out.dataDeleted, false);
    assert.equal(out.commandIssued, false);
    assert.equal(maintenanceActionDecision({ ...base, command: "rm -rf /" }).reason, "arbitrary_command_or_bypass_refused");
    assert.equal(maintenanceActionDecision({ ...base, path: "/customer/private" }).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, force: true }).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, bypassRequested: true }).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, maxItems: 1001 }).reason, "unbounded_maintenance_budget");
    assert.equal(maintenanceActionDecision({ ...base, maxDurationMs: 0 }).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, actorAuthorized: false }).candidate, false);
    assert.equal(maintenanceActionDecision(null).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, action: "service_restart" }).ownerReviewRequired, true);
    assert.equal(maintenanceActionDecision({ ...base, action: "disk_defragmentation" }).candidate, false);
    assert.equal(maintenanceActionDecision({ ...base, action: "retention_purge_review",
      mode: "maintenance", ownerApproved: true, inFlightJobsDrained: true,
      backupVerified: true }).reason, "retention_policy_and_storage_authority_review_required");
    const maintain = { ...base, mode: "maintenance", ownerApproved: true,
      inFlightJobsDrained: true, backupVerified: true };
    assert.equal(maintenanceActionDecision({ ...base, action: "cache_cleanup_review" }).reason, "maintenance_mode_required");
    assert.equal(maintenanceActionDecision({ ...maintain, action: "cache_cleanup_review", legalHold: true })
      .reason, "legal_or_incident_hold");
    assert.equal(maintenanceActionDecision({ ...maintain, action: "cache_cleanup_review" })
      .reason, "cache_scope_or_retention_protection_unverified");
    out = maintenanceActionDecision({ ...maintain, action: "cache_cleanup_review",
      cacheOnlyTargetsVerified: true, retentionProtectedTargetsExcluded: true });
    assert.equal(out.candidate, true);
    assert.equal(out.dataDeleted, false);
    assert.equal(out.ownerReviewRequired, true);
    assert.equal(maintenanceActionDecision({ ...maintain, action: "vacuum_analyze_review" })
      .reason, "database_metrics_or_window_missing");
    assert.equal(maintenanceActionDecision({ ...maintain, action: "vacuum_analyze_review",
      databaseMetricsVerified: true, maintenanceWindowApproved: true }).candidate, true);
    assert.equal(maintenanceActionDecision({ ...maintain, action: "reindex_review",
      databaseMetricsVerified: true, maintenanceWindowApproved: true }).reason, "database_lock_impact_unreviewed");
    assert.equal(maintenanceActionDecision({ ...maintain, action: "reindex_review",
      databaseMetricsVerified: true, maintenanceWindowApproved: true,
      lockImpactReviewed: true }).candidate, true);
    assert.equal(maintenanceActionDecision({ ...maintain, action: "isolated_restore_drill" })
      .reason, "isolated_restore_environment_missing");
    assert.equal(maintenanceActionDecision({ ...maintain, action: "isolated_restore_drill",
      isolatedEnvironmentVerified: true }).candidate, true);
  });

  it("classifies trusted operational alerts without auto-lockdown or duplicate notifications", () => {
    const base = {
      signal: "security_bypass_attempt", scopeVerified: true, evidenceVerified: true,
      consecutiveFailures: 3, threshold: 2, nowMs: 300000, cooldownMs: 60000,
      lastAlertAtMs: null
    };
    let decision = operationalAlertDecision(base);
    assert.equal(decision.notifyCandidate, true);
    assert.equal(decision.severity, "critical");
    assert.equal(decision.alertSent, false);
    assert.equal(decision.lockdownExecuted, false);
    assert.equal(decision.shutdownExecuted, false);
    assert.equal(decision.nextEligibleAlertAtMs, 360000);
    assert.equal(operationalAlertDecision({ ...base, signal: "nonsense" }).reason, "unknown_alert_signal");
    assert.equal(operationalAlertDecision({ ...base, evidenceVerified: false }).reason, "unverified_alert_evidence");
    assert.equal(operationalAlertDecision({ ...base, scopeVerified: false }).notifyCandidate, false);
    assert.equal(operationalAlertDecision({ ...base, consecutiveFailures: 1 }).reason, "below_alert_threshold");
    assert.equal(operationalAlertDecision({ ...base, lastAlertAtMs: 250000 }).reason, "alert_cooldown_active");
    assert.equal(operationalAlertDecision({ ...base, lastAlertAtMs: 240000 }).notifyCandidate, true);
    assert.equal(operationalAlertDecision({ ...base, lastAlertAtMs: 300001 }).reason, "invalid_last_alert_clock");
    assert.equal(operationalAlertDecision({ ...base, cooldownMs: 0 }).reason, "invalid_alert_budget");
    assert.equal(operationalAlertDecision({ ...base, threshold: 21 }).notifyCandidate, false);
    assert.equal(operationalAlertDecision({ ...base, nowMs: Number.MAX_SAFE_INTEGER })
      .reason, "invalid_alert_budget");
    assert.equal(operationalAlertDecision(null).notifyCandidate, false);
    decision = operationalAlertDecision({ ...base, signal: "backup_evidence_missing" });
    assert.equal(decision.severity, "high");
    assert.equal(decision.notifyCandidate, true);
    decision = operationalAlertDecision({ ...base, signal: "job_queue_stalled" });
    assert.equal(decision.severity, "warning");
    assert.equal(decision.notifyCandidate, true);
  });

  it("plans stable dependency stages, reports the critical path, and rejects graph hazards", () => {
    const steps = [
      { id: "publish", dependsOn: ["review"], estimatedMs: 3 },
      { id: "review", dependsOn: ["render"], estimatedMs: 8, maxAttempts: 2 },
      { id: "render", estimatedMs: 20 },
      { id: "bill", estimatedMs: 5 }
    ];
    const plan = planWorkflowSequence(steps);
    assert.deepEqual(plan.order, ["bill", "render", "review", "publish"]);
    assert.deepEqual(plan.stages, [["bill", "render"], ["review"], ["publish"]]);
    assert.equal(plan.criticalPathMs, 31);
    assert.deepEqual(plan.criticalPath, ["render", "review", "publish"]);
    assert.deepEqual(planWorkflowSequence([...steps].reverse()), plan);
    assert.throws(() => planWorkflowSequence([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }]), /cycle/);
    assert.throws(() => planWorkflowSequence([{ id: "a", dependsOn: ["b"] }]), /Unknown dependency/);
    assert.throws(() => planWorkflowSequence([{ id: "a" }, { id: "a" }]), /Duplicate step/);
    assert.throws(() => planWorkflowSequence([{ id: "a", maxAttempts: 100 }]), /maxAttempts/);
    assert.throws(() => planWorkflowSequence([{ id: "a", dependsOn: ["a"] }]), /Self-dependency/);
  });

  it("replays step traces without duplicate effects or out-of-order transitions", () => {
    const plan = planWorkflowSequence([
      { id: "publish", dependsOn: ["review"] },
      { id: "review", dependsOn: ["render"], maxAttempts: 2 },
      { id: "render" },
      { id: "bill" }
    ]);
    assert.deepEqual(replayWorkflowTrace(plan, []).eligible, ["bill", "render"]);
    assert.throws(() => replayWorkflowTrace(plan, [
      { eventId: "z", stepId: "publish", action: "started", attempt: 1 }
    ]), /Out-of-sequence/);

    const events = [
      { eventId: "a", stepId: "render", action: "started", attempt: 1 },
      { eventId: "b", stepId: "render", action: "succeeded", attempt: 1 },
      { eventId: "b", stepId: "render", action: "succeeded", attempt: 1 },
      { eventId: "c", stepId: "review", action: "started", attempt: 1 },
      { eventId: "d", stepId: "review", action: "failed", attempt: 1 },
      { eventId: "e", stepId: "review", action: "started", attempt: 2 },
      { eventId: "f", stepId: "review", action: "succeeded", attempt: 2 },
      { eventId: "g", stepId: "publish", action: "started", attempt: 1 },
      { eventId: "h", stepId: "publish", action: "succeeded", attempt: 1 },
      { eventId: "i", stepId: "bill", action: "started", attempt: 1 },
      { eventId: "j", stepId: "bill", action: "succeeded", attempt: 1 }
    ];
    const replay = replayWorkflowTrace(plan, events);
    assert.equal(replay.complete, true);
    assert.equal(replay.replayedEvents, 1);
    assert.equal(replay.acceptedEvents, 10);
    assert.deepEqual(replay.eligible, []);
    assert.throws(() => replayWorkflowTrace(plan, [
      events[0], { ...events[0], action: "failed" }
    ]), /Conflicting replay event id/);

    const singleAttempt = planWorkflowSequence([{ id: "once", maxAttempts: 1 }]);
    const failed = [
      { eventId: "start", stepId: "once", action: "started", attempt: 1 },
      { eventId: "fail", stepId: "once", action: "failed", attempt: 1 }
    ];
    assert.deepEqual(replayWorkflowTrace(singleAttempt, failed).exhausted, ["once"]);
    assert.throws(() => replayWorkflowTrace(singleAttempt, [
      ...failed, { eventId: "retry", stepId: "once", action: "started", attempt: 2 }
    ]), /Out-of-sequence/);
  });

  it("rejects cross-tenant, mixed-run, reordered and conflicting durable event histories", () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const runId = "run:42";
    const plan = planWorkflowSequence([
      { id: "render", maxAttempts: 2 },
      { id: "publish", dependsOn: ["render"] }
    ]);
    const definitionHash = plan.definitionHash;
    const start = {
      organizationId, runId, definitionHash, sequence: 1, eventId: "one",
      stepId: "render", action: "started", attempt: 1,
      traceId: "0123456789abcdef0123456789abcdef"
    };
    const finish = {
      organizationId, runId, definitionHash, sequence: 2, eventId: "two",
      stepId: "render", action: "succeeded", attempt: 1
    };
    const input = { plan, organizationId, runId, definitionHash, events: [start, finish, start] };
    const state = replayScopedWorkflowTrace(input);
    assert.equal(state.complete, false);
    assert.equal(state.organizationId, organizationId);
    assert.equal(state.runId, runId);
    assert.equal(state.definitionHash, definitionHash);
    assert.equal(state.lastSequence, 2);
    assert.equal(state.acceptedEvents, 2);
    assert.equal(state.replayedEvents, 1);
    assert.deepEqual(state.eligible, ["publish"]);
    assert.deepEqual(replayScopedWorkflowTrace({ ...input, events: [start, finish] }).eligible, ["publish"]);
    assert.deepEqual(replayScopedWorkflowTrace({ ...input, events: [] }).eligible, ["render"]);

    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, organizationId: "22222222-2222-4222-8222-222222222222" }]
    }), /Cross-scope/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, runId: "another" }]
    }), /Cross-scope/);
    assert.throws(() => replayScopedWorkflowTrace({ ...input, events: [finish] }), /sequence gap/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, sequence: 3 }]
    }), /sequence gap/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, sequence: 1 }]
    }), /Conflicting durable/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, eventId: "one" }]
    }), /Conflicting durable/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...start, traceId: "fedcba9876543210fedcba9876543210" }]
    }), /Conflicting durable/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [start, { ...finish, action: "succeeded", attempt: 2 }]
    }), /Out-of-sequence/);
    assert.throws(() => replayScopedWorkflowTrace({ ...input, organizationId: "wrong" }), /canonical lowercase UUID/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, definitionHash: "0".repeat(64)
    }), /Workflow definition mismatch/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [{ ...start, definitionHash: "0".repeat(64) }]
    }), /Workflow event definition mismatch/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [{ ...start, definitionHash: undefined }]
    }), /Workflow event definition mismatch/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input,
      plan: planWorkflowSequence([
        { id: "render", maxAttempts: 3 },
        { id: "publish", dependsOn: ["render"] }
      ])
    }), /Workflow definition mismatch/);
    assert.equal(
      planWorkflowSequence([...plan.steps].reverse()).definitionHash,
      definitionHash
    );
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [{ ...start, traceId: "00000000000000000000000000000000" }]
    }), /Invalid trace id/);
    assert.throws(() => replayScopedWorkflowTrace({
      ...input, events: [{ ...start, sequence: 0 }]
    }), /Invalid workflow event sequence/);
    assert.throws(() => replayScopedWorkflowTrace({ ...input, events: new Array(4097).fill(start) }), /4096/);
  });

  it("schedules bounded deterministic retries only after explicit safety checks", () => {
    const plan = planWorkflowSequence([
      { id: "ingest", maxAttempts: 3 },
      { id: "publish", dependsOn: ["ingest"], maxAttempts: 2 }
    ]);
    const events = [
      { eventId: "a", stepId: "ingest", action: "started", attempt: 1 },
      { eventId: "b", stepId: "ingest", action: "failed", attempt: 1 }
    ];
    const input = {
      plan, events, stepId: "ingest", runId: "run:001",
      startedAtMs: 1000, nowMs: 1100, maxElapsedMs: 20000,
      baseDelayMs: 100, capDelayMs: 1000, failureKind: "transient",
      authorizationConfirmed: true, effectReplaySafe: true, budgetApproved: true
    };
    const scheduled = evaluateWorkflowRetry(input);
    assert.equal(scheduled.action, "schedule");
    assert.equal(scheduled.nextAttempt, 2);
    assert.equal(scheduled.remainingAttempts, 1);
    assert.equal(scheduled.notBeforeMs, 1100 + scheduled.delayMs);
    assert.ok(scheduled.delayMs >= 1 && scheduled.delayMs <= 100);
    assert.deepEqual(evaluateWorkflowRetry(input), scheduled);
    assert.deepEqual(evaluateWorkflowRetry({ ...input, events: [...events, events[1]] }), scheduled);

    const refusals = [
      ["cancellationRequested", true, "cancel_requested"],
      ["failureKind", "permanent", "non_retryable_failure"],
      ["failureKind", undefined, "non_retryable_failure"],
      ["authorizationConfirmed", false, "authorization_unconfirmed"],
      ["effectReplaySafe", false, "idempotency_unconfirmed"],
      ["budgetApproved", false, "resource_budget_unconfirmed"]
    ];
    for (const [field, value, reason] of refusals) {
      assert.equal(evaluateWorkflowRetry({ ...input, [field]: value }).reason, reason);
    }
    assert.equal(evaluateWorkflowRetry({ ...input, nowMs: 21001 }).reason, "time_budget_exhausted");
    assert.equal(evaluateWorkflowRetry({ ...input, maxElapsedMs: 101 }).reason, "time_budget_exhausted");
    assert.equal(evaluateWorkflowRetry({ ...input, events: [] }).reason, "step_not_failed");
    assert.equal(evaluateWorkflowRetry({ ...input, plan: planWorkflowSequence([{ id: "ingest", maxAttempts: 1 }]) }).reason, "attempt_budget_exhausted");

    assert.equal(evaluateWorkflowRetry({ ...input, failureKind: "rate_limited" }).reason, "provider_backoff_unverified");
    assert.equal(evaluateWorkflowRetry({ ...input, failureKind: "rate_limited", providerRetryAfterMs: 3000 }).reason, "provider_backoff_exceeds_cap");
    const throttled = evaluateWorkflowRetry({ ...input, failureKind: "rate_limited", providerRetryAfterMs: 800 });
    assert.equal(throttled.action, "schedule");
    assert.equal(throttled.delayMs, 800);
    assert.throws(() => evaluateWorkflowRetry({ ...input, runId: "PII leaked /token" }), /runId/);
    assert.throws(() => evaluateWorkflowRetry({ ...input, baseDelayMs: 0 }), /baseDelayMs/);
    assert.throws(() => evaluateWorkflowRetry({ ...input, capDelayMs: 3, baseDelayMs: 4 }), /capDelayMs/);
    assert.throws(() => evaluateWorkflowRetry({ ...input, nowMs: 999 }), /precedes/);
    assert.throws(() => evaluateWorkflowRetry({ ...input, stepId: "unknown" }), /Unknown/);

    const secondAttempt = [
      ...events,
      { eventId: "c", stepId: "ingest", action: "started", attempt: 2 },
      { eventId: "d", stepId: "ingest", action: "failed", attempt: 2 }
    ];
    const next = evaluateWorkflowRetry({ ...input, events: secondAttempt });
    assert.equal(next.nextAttempt, 3);
    assert.ok(next.delayMs <= 200);
    const exhausted = [
      ...secondAttempt,
      { eventId: "e", stepId: "ingest", action: "started", attempt: 3 },
      { eventId: "f", stepId: "ingest", action: "failed", attempt: 3 }
    ];
    assert.equal(evaluateWorkflowRetry({ ...input, events: exhausted }).reason, "attempt_budget_exhausted");
  });

  function operationalCoordinatorFixture(options = {}) {
    const org = "33333333-3333-4333-8333-333333333333";
    const actorId = "11111111-1111-4111-8111-111111111111";
    const approverId = "22222222-2222-4222-8222-222222222222";
    const command = {
      scope: "tenant", organizationId: org, expectedRevision: 7,
      to: "paused", eventId: "evt_test_1", approvalId: "approval_test_1"
    };
    let committed = {
      state: { scope: "tenant", organizationId: org, mode: "active", revision: 7 },
      approval: {
        id: command.approvalId, status: "approved", consumedAtMs: null,
        scope: "tenant", organizationId: org, from: "active", to: "paused",
        expectedRevision: 7, approvedBy: approverId,
        issuedAtMs: 1900, expiresAtMs: 2600
      },
      events: []
    };
    Object.assign(committed.approval, options.approval || {});
    const store = {
      async withTransaction(work) {
        // The fixture, unlike production, is an in-memory transactional stand-in.
        // Discard every staged change if ANY callback throws or denies.
        const draft = structuredClone(committed);
        const tx = {
          async nowMs() { return options.nowMs ?? 2000; },
          async readStateForUpdate() { return { ...draft.state }; },
          async readApprovalForUpdate() { return { ...draft.approval }; },
          async consumeApproval(input) {
            if (options.consumeConflict || draft.approval.consumedAtMs != null ||
                draft.approval.id !== input.approvalId) return 0;
            draft.approval.consumedAtMs = options.nowMs ?? 2000;
            return 1;
          },
          async compareAndSwapState(input) {
            if (options.casConflict || draft.state.revision !== input.expectedRevision ||
                draft.state.mode !== input.expectedMode) return 0;
            draft.state.mode = input.nextMode;
            draft.state.revision = input.nextRevision;
            return 1;
          },
          async appendAuditEvent(input) {
            if (options.auditConflict || draft.events.some(e => e.eventId === input.eventId)) return 0;
            draft.events.push({ ...input });
            return 1;
          }
        };
        if (options.omitAuditWriter) delete tx.appendAuditEvent;
        const result = await work(tx);
        committed = draft;
        return result;
      }
    };
    const authorizer = {
      async authorize({ session }) {
        if (session !== "server_validated") return null;
        return {
          actorId, authorized: options.actorAuthorized !== false,
          scope: "tenant", organizationId: options.principalOrg || org
        };
      },
      async verifyApproval() { return options.approvalVerified !== false; }
    };
    const evidenceVerifier = {
      async verify() { return options.proof ?? {}; }
    };
    return {
      coordinator: operationalTransitionCoordinator({ store, authorizer, evidenceVerifier }),
      command, view() { return structuredClone(committed); }
    };
  }

  it("commits reviewed operational state, consumed approval and audit as one transaction", async () => {
    const f = operationalCoordinatorFixture();
    let result = await f.coordinator.transition({ session: "server_validated", command: f.command });
    assert.equal(result.applied, true);
    assert.equal(result.reason, "transaction_commit_requested");
    assert.equal(result.revision, 8);
    assert.equal(result.transitionExecuted, false);
    assert.equal(result.commitResultRequiresDatabaseProof, true);
    assert.equal(f.view().state.mode, "paused");
    assert.equal(f.view().state.revision, 8);
    assert.equal(f.view().events.length, 1);
    assert.equal(f.view().events[0].eventId, f.command.eventId);
    assert.ok(f.view().approval.consumedAtMs !== null);
    result = await f.coordinator.transition({ session: "server_validated", command: f.command });
    assert.equal(result.applied, false);
    assert.equal(result.reason, "stale_or_unavailable_operational_state");
    assert.equal(f.view().events.length, 1);
  });

  it("refuses caller-supplied proofs, foreign identities and stale or forged approvals", async () => {
    for (const key of [
      "actorId", "ownerApproved", "actorAuthorized", "evidence",
      "scopeVerified", "releaseGatesVerified", "overrideReleaseGate"
    ]) {
      const f = operationalCoordinatorFixture();
      const result = await f.coordinator.transition({
        session: "server_validated", command: { ...f.command, [key]: true }
      });
      assert.equal(result.reason, "untrusted_evidence_or_command_shape");
      assert.equal(f.view().state.revision, 7);
    }
    for (const [settings,session,expected] of [
      [{}, "forged", "actor_authorization_unverified"],
      [{ principalOrg: "44444444-4444-4444-8444-444444444444" }, "server_validated", "actor_authorization_unverified"],
      [{ actorAuthorized: false }, "server_validated", "actor_authorization_unverified"],
      [{ approvalVerified: false }, "server_validated", "independent_approval_unverified"],
      [{ nowMs: 2700 }, "server_validated", "approval_missing_expired_or_reused"],
      [{ approval: { approvedBy: "11111111-1111-4111-8111-111111111111" } },
        "server_validated", "approval_missing_expired_or_reused"],
      [{ approval: { organizationId: "44444444-4444-4444-8444-444444444444" } },
        "server_validated", "approval_missing_expired_or_reused"],
      [{ approval: { expectedRevision: 6 } }, "server_validated", "approval_missing_expired_or_reused"],
      [{ approval: { consumedAtMs: 1999 } }, "server_validated", "approval_missing_expired_or_reused"]
    ]) {
      const f = operationalCoordinatorFixture(settings);
      const result = await f.coordinator.transition({ session, command: f.command });
      assert.equal(result.reason, expected);
      assert.equal(result.applied, false);
      assert.equal(f.view().state.revision, 7);
      assert.equal(f.view().events.length, 0);
    }
  });

  it("rolls back consumed approval and changed mode when CAS or audit fails", async () => {
    for (const [settings, expected] of [
      [{ consumeConflict: true }, "approval_claim_conflict"],
      [{ casConflict: true }, "operational_revision_conflict"],
      [{ auditConflict: true }, "operational_audit_conflict"],
      [{ omitAuditWriter: true }, "transaction_contract_missing"]
    ]) {
      const f = operationalCoordinatorFixture(settings);
      const result = await f.coordinator.transition({ session: "server_validated", command: f.command });
      assert.equal(result.applied, false);
      assert.equal(result.reason, expected);
      assert.equal(f.view().state.mode, "active");
      assert.equal(f.view().state.revision, 7);
      assert.equal(f.view().approval.consumedAtMs, null);
      assert.equal(f.view().events.length, 0);
    }
  });

  it("requires separately verified lockdown, recovery and release facts", async () => {
    const f = operationalCoordinatorFixture({
      approval: { to: "lockdown" }, proof: {}
    });
    const lock = { ...f.command, to: "lockdown" };
    const denial = await f.coordinator.transition({ session: "server_validated", command: lock });
    assert.equal(denial.reason, "policy_denied_incident_evidence_missing");
    assert.equal(f.view().state.revision, 7);
    const ok = operationalCoordinatorFixture({
      approval: { to: "lockdown" }, proof: { verifiedSecurityIncident: true }
    });
    const success = await ok.coordinator.transition({ session: "server_validated", command: lock });
    assert.equal(success.applied, true);
    assert.equal(ok.view().state.mode, "lockdown");
    const start = operationalCoordinatorFixture({
      approval: { to: "active" }, proof: { healthVerified: true,
        releaseGatesVerified: true, incidentClearedVerified: true }
    });
    const startResult = await start.coordinator.transition({
      session: "server_validated", command: { ...start.command, to: "active" }
    });
    assert.equal(startResult.reason, "policy_denied_no_op_transition");
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
    assert.equal(BACKEND_RESEARCH_DATE, "2026-09-30");
    assert.equal(backend.researchOnly, true);
    assert.equal(backend.productionExecutionCount, 0);
    assert.equal(backend.installedRepositoryCount, 0);
    assert.ok(BACKEND_SIGNALS_2026.length >= 15);
    assert.ok(RELIABILITY_PRIMITIVES.length >= 15);
    assert.equal(SELF_REPAIR_LEVELS.length, 6);
    assert.ok(REFERENCE_REPOSITORIES.length >= 8);
    assert.ok(SHARED_BACKEND_SURFACES.length >= 10);
    assert.equal(Object.keys(PRODUCT_WORKFLOW_CONTRACTS).length, 3);
    assert.equal(backend.productWorkflowContractCount, 3);
    assert.equal(REFERENCE_REPOSITORIES.filter((item) => item.installedByResearch).length, 0);
    assert.equal(REFERENCE_REPOSITORIES.filter((item) => item.enabledInProduction).length, 0);
    for (const signal of BACKEND_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.ok(signal.sourceUrl.startsWith("https://"));
    }
  });

  it("requires product-specific evidence and approval before sensitive workflow transitions", () => {
    assert.deepEqual(evaluateProductWorkflowTransition({
      product: "Business Builder", from: "captured", to: "scoped"
    }), {
      allowed: false, reason: "required_evidence_missing", product: "Business Builder",
      from: "captured", to: "scoped", missingEvidence: ["scope_record"]
    });
    assert.equal(evaluateProductWorkflowTransition({
      product: "Creator Studio", from: "packaged", to: "published",
      evidence: { provider_receipt: { id: "receipt-1" } }
    }).reason, "owner_approval_required");
    assert.equal(evaluateProductWorkflowTransition({
      product: "Creator Studio", from: "packaged", to: "published",
      evidence: {
        provider_receipt: { id: "receipt-1" },
        owner_approval: { approvalId: "approval-1", approvedBy: "owner-1", approved: true }
      }
    }).allowed, true);
    assert.equal(evaluateProductWorkflowTransition({
      product: "Growth Studio", from: "previewed", to: "dispatched",
      evidence: { provider_receipt: { id: "receipt-2" } }
    }).reason, "transition_not_allowed");
    assert.equal(evaluateProductWorkflowTransition({
      product: "Growth Studio", from: "approved", to: "dispatched",
      evidence: { provider_receipt: { id: "receipt-2" } }
    }).reason, "owner_approval_required");
    assert.equal(evaluateProductWorkflowTransition({
      product: "Growth Studio", from: "approved", to: "dispatched",
      evidence: {
        provider_receipt: { id: "receipt-2" },
        owner_approval: { approvalId: "approval-2", approvedBy: "owner-1", approved: true }
      }
    }).allowed, true);
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
    assert.equal(FRONTEND_VISUAL_VERSION, "1.2.0");
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
    assert.equal(FRONTEND_VISUAL_SNAPSHOT_DATE, "2026-09-30");
    assert.equal(intelligence.productionExecutionCount, 0);
    assert.equal(intelligence.researchOnly, true);
    assert.ok(FRONTEND_MARKET_SIGNALS_2026.length >= 15);
    assert.ok(FRONTEND_REPOSITORY_REFERENCES.length >= 6);
    for (const signal of FRONTEND_MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= FRONTEND_VISUAL_SNAPSHOT_DATE);
    }
    for (const signal of FRONTEND_MARKET_SIGNALS_PASS2_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= FRONTEND_VISUAL_SNAPSHOT_DATE);
    }
  });

  it("maps the requested public-company research into original SONARA brand kits", () => {
    const intelligence = getFrontendVisualIntelligence();
    const companies = new Set(FRONTEND_COMPANY_PATTERN_GROUPS_2026.flatMap((group) => group.companies));
    for (const company of ["Marvel", "Rockstar Games", "DC", "Honda", "Epic Games / Fortnite", "TikTok", "Suno", "Activision / Call of Duty", "Meta", "Amazon", "Google", "Apple", "Ford", "Chevrolet", "Nintendo", "Walmart", "Netflix", "Vizio", "TCL", "PlayStation", "Reddit", "Uber", "Lyft", "quick-service restaurants", "Spotify", "Tesla", "SpaceX", "Airbnb", "Shopify", "Stripe", "Duolingo", "YouTube", "Xbox"]) {
      assert.equal(companies.has(company), true, `missing research reference ${company}`);
    }
    assert.equal(intelligence.companyPatternGroupCount, FRONTEND_COMPANY_PATTERN_GROUPS_2026.length);
    assert.equal(intelligence.brandKitCount, 5);
    assert.deepEqual(intelligence.brandKits.products.map((item) => item.key), ["business_builder", "creator_studio", "growth_studio"]);
    for (const item of intelligence.brandKits.products) {
      const canonical = getBrandProduct(item.key);
      assert.ok(canonical, `brand kit ${item.key} must map to a canonical product`);
      assert.equal(item.name, canonical.name);
      assert.equal(item.route, canonical.route);
      assert.equal(item.dashboardRoute, canonical.dashboardRoute);
      assert.equal(item.primaryRoute, canonical.primaryRoute);
      assert.ok(item.logo.startsWith("/brand/"));
    }
    assert.equal(intelligence.brandKits.platform.name, SONARA_BRAND_REGISTRY.parent.platform);
    assert.equal(intelligence.brandKits.platform.route, SONARA_BRAND_REGISTRY.publicRoutes.products);
    assert.ok(intelligence.brandKits.sharedContracts.includes("Tenant-scoped server authorization and data access"));
    assert.equal(intelligence.productionExecutionCount, 0);
    assert.equal(FRONTEND_BRAND_KITS_2026.sourceUse.includes("Do not copy logos"), true);
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

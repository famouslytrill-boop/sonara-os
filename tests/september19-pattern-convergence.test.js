// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const assert = require("node:assert/strict");
const {
  SOURCE_LEADS,
  PLATFORM_PATTERNS,
  AGENT_ROLES,
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
    assert.equal(readiness.architectureConvergence.version, "1.0.0");
  });

  it("captures architecture, agent, and skill catalogs", () => {
    assert.ok(PLATFORM_PATTERNS.some((item) => item.key === "bounded_agent_harness"));
    assert.ok(PLATFORM_PATTERNS.some((item) => item.key === "control_data_plane_split"));
    assert.ok(AGENT_ROLES.some((item) => item.key === "policy_gate"));
    assert.ok(AGENT_ROLES.some((item) => item.key === "verifier"));
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
});

"use strict";

const assert = require("assert");
const {
  SNAPSHOT_DATE,
  REGISTRY_VERSION,
  MATURITY_STAGES,
  MARKET_SIGNALS,
  INVENTION_SYSTEMS,
  DOMAIN_COVERAGE,
  FORMULAS,
  getInventionSystemsIntelligence,
  scoreInventionOpportunity,
  promotionReadiness
} = require("../lib/sonara-invention-systems-2026.cjs");

describe("SONARA invention systems intelligence", () => {
  it("is a dated non-executing research registry", () => {
    const catalog = getInventionSystemsIntelligence();
    assert.equal(SNAPSHOT_DATE, "2026-09-20");
    assert.equal(REGISTRY_VERSION, "1.1.0");
    assert.equal(catalog.authority, "research_and_design_only");
    assert.equal(catalog.runtimeAuthority, false);
    assert.equal(catalog.executionEnabled, false);
    assert.equal(catalog.claims.productionReady, false);
    assert.equal(catalog.claims.patentStatus, "not_assessed");
    assert.ok(MARKET_SIGNALS.length >= 30);
    assert.ok(INVENTION_SYSTEMS.length >= 29);
    assert.ok(DOMAIN_COVERAGE.length >= 35);
    assert.ok(FORMULAS.length >= 11);
  });

  it("never marks research inventions as executable or production claims", () => {
    for (const item of INVENTION_SYSTEMS) {
      assert.equal(item.executionEnabled, false, item.key);
      assert.equal(item.productionClaim, false, item.key);
      assert.equal(item.maturity, "research", item.key);
      assert.ok(item.boundaries.includes("tenant_scoped"), item.key);
      assert.ok(item.boundaries.includes("approval_for_high_impact_actions"), item.key);
    }
  });

  it("keeps the promotion lifecycle explicit and ordered", () => {
    assert.deepEqual(MATURITY_STAGES, ["research", "design", "sandbox", "validated", "canary", "production"]);
    const blocked = promotionReadiness("canary", {});
    assert.equal(blocked.ok, false);
    assert.equal(blocked.nextStage, "production");
    assert.ok(blocked.missing.includes("exact_sha_release_evidence"));
    assert.ok(blocked.missing.includes("owner_authorization"));

    const ready = promotionReadiness("canary", {
      exact_sha_release_evidence: true,
      rollback_evidence: true,
      production_health: true,
      owner_authorization: true
    });
    assert.equal(ready.ok, true);
  });

  it("scores identical evidence deterministically", () => {
    const input = {
      evidence: 5,
      reuse: 5,
      workflowDepth: 4,
      distribution: 4,
      margin: 4,
      reliability: 5,
      security: 5,
      integrationRisk: 2,
      complianceRisk: 1
    };
    assert.equal(scoreInventionOpportunity(input), scoreInventionOpportunity(input));
    assert.ok(scoreInventionOpportunity(input) >= 0);
    assert.ok(scoreInventionOpportunity(input) <= 100);
  });

  it("maps every domain family to registered invention systems", () => {
    const known = new Set(INVENTION_SYSTEMS.map((item) => item.key));
    for (const domain of DOMAIN_COVERAGE) {
      assert.ok(domain.key, "domain key");
      assert.ok(domain.systemKeys.length > 0, domain.key);
      assert.ok(domain.systemKeys.every((key) => known.has(key)), domain.key);
      assert.ok(domain.strategy, domain.key);
      assert.ok(domain.boundary.length > 20, domain.key);
    }
  });

  it("captures the expanded agent, simulation, realtime, media, and market-signal systems", () => {
    const signalKeys = new Set(MARKET_SIGNALS.map((item) => item.key));
    const systemKeys = new Set(INVENTION_SYSTEMS.map((item) => item.key));
    const formulaKeys = new Set(FORMULAS.map((item) => item.key));

    for (const key of [
      "mcp_stateless_interop",
      "agent_identity_authority",
      "runtime_agent_governance",
      "agentic_storefront_distribution",
      "agentic_payment_runtime",
      "app_ai_economics",
      "operational_vector_search",
      "realtime_stateful_coordination",
      "creative_agent_workflows",
      "open_video_av2",
      "physical_ai_world_models",
      "agentic_design_interop",
      "realtime_engine_convergence",
      "postgres_operational_foundation"
    ]) assert.equal(signalKeys.has(key), true, `missing signal ${key}`);

    for (const key of [
      "agent-identity-authority-mesh",
      "protocol-interop-fabric",
      "realtime-coordination-engine",
      "simulation-rehearsal-engine",
      "reality-model-learning-loop",
      "creative-continuity-graph",
      "adaptive-media-delivery-engine",
      "market-signal-radar"
    ]) assert.equal(systemKeys.has(key), true, `missing invention system ${key}`);

    for (const key of [
      "agent_authority_envelope",
      "interoperability_friction",
      "simulation_reality_fidelity",
      "creative_continuity",
      "realtime_coordination_health"
    ]) assert.equal(formulaKeys.has(key), true, `missing formula ${key}`);
  });

  it("retains source provenance for every market signal", () => {
    for (const item of MARKET_SIGNALS) {
      assert.match(item.sourceUrl, /^https:\/\//, item.key);
      assert.match(item.observedAt, /^2026-/, item.key);
      assert.ok(item.finding.length > 20, item.key);
      assert.ok(item.designRule.length > 20, item.key);
    }
  });
});

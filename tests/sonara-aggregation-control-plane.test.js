"use strict";

const assert = require("node:assert/strict");
const {
  AGGREGATOR_RESEARCH_DATE,
  AGGREGATOR_ARCHITECTURE_VERSION,
  PROTOCOL_BASELINE,
  AGGREGATOR_MARKET_SIGNALS_2026,
  AGGREGATION_CAPABILITY_CLASSES,
  AGGREGATION_DOMAINS,
  AGGREGATION_CONTROL_PLANE_REQUIREMENTS,
  AGGREGATOR_IMPLEMENTATION_SEQUENCE,
  aggregationReadinessScore,
  providerRouteScore,
  mutationAuthorityDecision,
  getAggregatorMarketArchitecture
} = require("../lib/sonara-aggregation-control-plane.cjs");

describe("SONARA aggregator control-plane market architecture", () => {
  it("keeps aggregator research current and non-executing", () => {
    const snapshot = getAggregatorMarketArchitecture();
    assert.equal(AGGREGATOR_RESEARCH_DATE, "2026-09-22");
    assert.equal(AGGREGATOR_ARCHITECTURE_VERSION, "1.1.0");
    assert.equal(snapshot.researchOnly, true);
    assert.equal(snapshot.productionExecutionCount, 0);
    assert.ok(AGGREGATOR_MARKET_SIGNALS_2026.length >= 20);
    assert.equal(AGGREGATION_CAPABILITY_CLASSES.length, 10);
    assert.ok(AGGREGATION_DOMAINS.length >= 25);
    for (const signal of AGGREGATOR_MARKET_SIGNALS_2026) {
      assert.equal(signal.runtimeAuthority, "none");
      assert.equal(signal.productionCapability, false);
      assert.ok(signal.sourceUrl.startsWith("https://"));
      assert.ok(signal.asOf <= AGGREGATOR_RESEARCH_DATE);
    }
    for (const domain of AGGREGATION_DOMAINS) {
      assert.equal(domain.implementationState, "architecture_only");
      assert.equal(domain.productionEnabled, false);
    }
  });

  it("pins current interoperability baselines without granting provider authority", () => {
    assert.equal(PROTOCOL_BASELINE.openapi, "3.2.1");
    assert.equal(PROTOCOL_BASELINE.asyncapi, "3.1.0");
    assert.equal(PROTOCOL_BASELINE.cloudevents, "1.0");
    assert.equal(PROTOCOL_BASELINE.mcp, "2026-07-28");
    assert.equal(PROTOCOL_BASELINE.opentelemetrySemanticConventions, "1.44.0");
  });

  it("keeps capability classes explicit instead of treating every integration as the same connector", () => {
    const keys = new Set(AGGREGATION_CAPABILITY_CLASSES.map((item) => item.key));
    for (const key of [
      "common_model_read", "managed_connection_auth", "incremental_sync", "event_ingress",
      "synchronous_action", "long_running_task", "bidirectional_sync", "policy_routing_gateway",
      "regulated_mutation", "device_edge_command"
    ]) {
      assert.equal(keys.has(key), true, `missing capability class ${key}`);
    }
    assert.equal(getAggregatorMarketArchitecture().capabilityClassCount, 10);
  });

  it("covers the requested cross-industry aggregation surfaces", () => {
    const keys = new Set(AGGREGATION_DOMAINS.map((item) => item.key));
    for (const key of [
      "ai_model_gateway",
      "agent_tool_gateway",
      "saas_unified_api",
      "workflow_automation",
      "data_integration_cdp",
      "banking_financial_data",
      "payments_marketplace",
      "restaurant_order_pos",
      "social_publishing",
      "commerce_catalog_marketplace",
      "shipping_delivery_routes",
      "travel_lodging",
      "places_reviews_reputation",
      "creator_media_distribution",
      "identity_auth",
      "jobs_talent",
      "property_real_estate",
      "iot_edge_robotics",
      "public_sector_open_data",
      "communications_omnichannel",
      "app_store_distribution_analytics",
      "ads_search_marketing",
      "cloud_compute_storage_observability",
      "manufacturing_supply_chain",
      "insurance_risk",
      "utilities_energy",
      "education_learning_translation",
      "gaming_platform_services",
      "mobility_vehicle_fleet"
    ]) {
      assert.equal(keys.has(key), true, `missing aggregation domain ${key}`);
    }
  });

  it("requires production-grade adapter evidence rather than connector-count marketing", () => {
    const requirements = AGGREGATION_CONTROL_PLANE_REQUIREMENTS.join(" ");
    assert.match(requirements, /tenant-scoped connection registry/i);
    assert.match(requirements, /idempotency/i);
    assert.match(requirements, /dead-letter/i);
    assert.match(requirements, /reconciliation/i);
    assert.match(requirements, /OpenTelemetry/i);
    assert.match(requirements, /capability negotiation/i);
    assert.match(requirements, /human approval/i);
    assert.match(requirements, /fail closed/i);
    assert.match(requirements, /deprecation/i);
    assert.match(requirements, /settled state/i);
    assert.match(requirements, /verified-native status/i);
    assert.match(getAggregatorMarketArchitecture().guardrails.join(" "), /native integration count/i);
  });

  it("scores aggregation readiness deterministically", () => {
    assert.equal(aggregationReadinessScore({
      canonicalModelCoverage: 1,
      authScopeCoverage: 1,
      eventCoverage: 1,
      reconciliationCoverage: 1,
      observabilityCoverage: 1,
      failureHandlingCoverage: 1,
      capabilityNegotiationCoverage: 1
    }), 1);

    const partial = aggregationReadinessScore({
      canonicalModelCoverage: 0.8,
      authScopeCoverage: 0.7,
      eventCoverage: 0.6,
      reconciliationCoverage: 0.5,
      observabilityCoverage: 0.9,
      failureHandlingCoverage: 0.8,
      capabilityNegotiationCoverage: 0.6
    });
    assert.equal(partial, 0.7);
    assert.throws(() => aggregationReadinessScore({
      canonicalModelCoverage: 2,
      authScopeCoverage: 1,
      eventCoverage: 1,
      reconciliationCoverage: 1,
      observabilityCoverage: 1,
      failureHandlingCoverage: 1,
      capabilityNegotiationCoverage: 1
    }), /between 0 and 1/);
  });

  it("scores provider routes from quality, reliability, freshness, latency, cost and policy fit", () => {
    assert.equal(providerRouteScore({
      quality: 0.9,
      reliability: 0.95,
      freshness: 0.8,
      latencyFit: 0.7,
      costFit: 0.8,
      policyFit: 1
    }), 0.8825);

    const weaker = providerRouteScore({
      quality: 0.6,
      reliability: 0.5,
      freshness: 0.5,
      latencyFit: 0.5,
      costFit: 0.4,
      policyFit: 0.4
    });
    assert.ok(weaker < 0.8825);
  });

  it("blocks unsafe mutations before provider execution", () => {
    assert.deepEqual(
      mutationAuthorityDecision({
        tenantScoped: false,
        idempotent: true,
        reconciliationPlanned: true,
        providerHealthy: true
      }),
      { allowed: false, mode: "blocked", reason: "tenant_scope_required" }
    );

    assert.equal(
      mutationAuthorityDecision({
        tenantScoped: true,
        idempotent: true,
        reconciliationPlanned: true,
        sensitive: true,
        approved: false,
        providerHealthy: true
      }).mode,
      "approval_required"
    );

    assert.deepEqual(
      mutationAuthorityDecision({
        tenantScoped: true,
        idempotent: true,
        reconciliationPlanned: true,
        sensitive: true,
        approved: true,
        providerHealthy: true
      }),
      { allowed: true, mode: "bounded_provider_mutation", reason: "policy_pass" }
    );
  });

  it("builds read-only aggregation before mutating connectors", () => {
    assert.equal(
      AGGREGATOR_IMPLEMENTATION_SEQUENCE[0],
      "define_connection_capability_and_provider_envelope_contracts"
    );
    const readIndex = AGGREGATOR_IMPLEMENTATION_SEQUENCE.indexOf("ship_read_only_connectors_first_for_low_risk_domains");
    const writeIndex = AGGREGATOR_IMPLEMENTATION_SEQUENCE.indexOf("canary_one_mutating_connector_with_human_approval_and_reconciliation");
    assert.ok(readIndex >= 0);
    assert.ok(writeIndex > readIndex);
    assert.match(AGGREGATOR_IMPLEMENTATION_SEQUENCE.at(-1), /verified_native_connector_counts/);
  });
});

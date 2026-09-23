"use strict";

const assert = require("node:assert/strict");
const {
  AUTH_TYPES,
  CONNECTION_REGISTRY_SCHEMA_DELTA,
  deriveTruthfulConnectionState,
  findForbiddenSecretPaths,
  validateConnectionRecord,
  getConnectionRegistryContract
} = require("../lib/sonara-connection-registry.cjs");
const {
  READ_ONLY_CONNECTOR_WAVE,
  SHARED_SYNC_REQUIREMENTS,
  CANONICAL_REPORT_ENVELOPE,
  getReadOnlyConnectorWave
} = require("../lib/sonara-read-only-connector-wave.cjs");
const {
  AGGREGATOR_MARKET_LAYERS,
  adapterSourcingDecision,
  verifiedDepthKpis,
  getAggregatorSourcingPolicy
} = require("../lib/sonara-aggregator-sourcing-policy.cjs");

function validConnection(overrides = {}) {
  return {
    organization_id: "11111111-1111-4111-8111-111111111111",
    business_id: "22222222-2222-4222-8222-222222222222",
    provider_key: "google_search_console",
    external_account_id: "sc-domain:example.com",
    auth_type: "oauth2",
    credential_reference: "vault://sonara/google-search-console/connection-1",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    environment: "sandbox",
    capability_state: "available",
    provider_version: "v1",
    expires_at: "2026-09-23T12:00:00Z",
    health_state: "healthy",
    deprecation_state: "none",
    deprecation_at: null,
    ...overrides
  };
}

describe("SONARA aggregator execution wave", () => {
  it("extends the active business connection surface instead of reviving retired organization integrations", () => {
    const contract = getConnectionRegistryContract();
    assert.equal(contract.databaseTarget, "business_integration_connections");
    assert.equal(contract.runtimeEnabled, false);
    assert.equal(contract.grantsRuntimeAuthority, false);
    assert.equal(contract.futureMigrationRequired, true);
    assert.ok(AUTH_TYPES.includes("oauth2"));
    assert.ok(AUTH_TYPES.includes("service_account"));
    assert.ok(AUTH_TYPES.includes("managed_auth"));
    assert.ok(CONNECTION_REGISTRY_SCHEMA_DELTA.some((entry) => entry.field === "external_account_id"));
    assert.ok(CONNECTION_REGISTRY_SCHEMA_DELTA.some((entry) => entry.field === "last_reconciliation_at"));
  });

  it("accepts opaque credential references but rejects embedded raw provider secrets", () => {
    const good = validateConnectionRecord(validConnection());
    assert.equal(good.ok, true);
    assert.deepEqual(good.forbiddenSecretPaths, []);

    const badRecord = validConnection({
      settings: {
        nested: {
          access_token: "raw-token",
          clientSecret: "raw-client-secret"
        }
      }
    });
    const bad = validateConnectionRecord(badRecord);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.includes("raw_secret_material_forbidden"));
    assert.deepEqual(findForbiddenSecretPaths(badRecord.settings).sort(), [
      "nested.access_token",
      "nested.clientSecret"
    ].sort());
  });

  it("derives truthful connection states instead of reducing every OAuth success to connected", () => {
    assert.equal(deriveTruthfulConnectionState({ setupComplete: false }), "setup_required");
    assert.equal(deriveTruthfulConnectionState({ reauthorizationRequired: true }), "reauthorization_required");
    assert.equal(deriveTruthfulConnectionState({ scopeMissing: true }), "scope_missing");
    assert.equal(deriveTruthfulConnectionState({ providerOutage: true }), "provider_outage");
    assert.equal(deriveTruthfulConnectionState({ rateLimited: true }), "rate_limited");
    assert.equal(deriveTruthfulConnectionState({ healthState: "degraded" }), "degraded");
    assert.equal(deriveTruthfulConnectionState({ capabilityState: "limited" }), "limited");
    assert.equal(deriveTruthfulConnectionState({}), "connected");
  });

  it("keeps the first connector wave read-only, ordered, shared-infrastructure-first, and unverified", () => {
    const wave = getReadOnlyConnectorWave();
    assert.equal(wave.runtimeEnabled, false);
    assert.equal(wave.verifiedNativeCount, 0);
    assert.equal(wave.mode, "read_only");
    assert.deepEqual(READ_ONLY_CONNECTOR_WAVE.map((item) => item.key), [
      "google_search_console",
      "app_store_connect_analytics",
      "google_play_developer_reporting",
      "google_analytics_data",
      "posthog"
    ]);
    assert.ok(SHARED_SYNC_REQUIREMENTS.includes("initial_backfill"));
    assert.ok(SHARED_SYNC_REQUIREMENTS.includes("checkpoint_persistence"));
    assert.ok(SHARED_SYNC_REQUIREMENTS.includes("reconciliation"));
    assert.ok(SHARED_SYNC_REQUIREMENTS.includes("opentelemetry_trace_metric_log_correlation"));
    assert.ok(CANONICAL_REPORT_ENVELOPE.includes("provider_version"));
    assert.ok(CANONICAL_REPORT_ENVELOPE.includes("provenance"));
    for (const connector of READ_ONLY_CONNECTOR_WAVE) {
      assert.equal(connector.productionEnabled, false);
      assert.equal(connector.verifiedNative, false);
    }
  });

  it("models the aggregator market as replaceable reach layers rather than native connector claims", () => {
    const policy = getAggregatorSourcingPolicy();
    assert.equal(policy.runtimeEnabled, false);
    assert.equal(policy.grantsRuntimeAuthority, false);
    const keys = new Set(AGGREGATOR_MARKET_LAYERS.map((layer) => layer.key));
    for (const key of [
      "unified_saas_common_models",
      "embedded_auth_and_connector_infrastructure",
      "agent_tool_aggregation",
      "data_elt_and_cdc",
      "workflow_ipaas",
      "model_and_media_routing",
      "regulated_and_vertical_aggregators"
    ]) {
      assert.equal(keys.has(key), true, key);
    }
  });

  it("selects direct, unified, or hybrid sourcing deterministically while forcing consequential actions into explicit provider boundaries", () => {
    const direct = adapterSourcingDecision({
      strategicDifferentiation: 1,
      expectedVolume: 0.9,
      specializedCapabilityNeed: 1,
      latencySensitivity: 0.9,
      controlNeed: 1,
      marginSensitivity: 0.8,
      longTailBreadthNeed: 0.1,
      timeToMarketPressure: 0.2,
      maintenanceAvoidanceValue: 0.2,
      unifiedVendorCoverage: 0.4,
      authComplexity: 0.3
    });
    assert.equal(direct.mode, "direct_adapter");

    const unified = adapterSourcingDecision({
      strategicDifferentiation: 0.1,
      expectedVolume: 0.2,
      specializedCapabilityNeed: 0.1,
      latencySensitivity: 0.1,
      controlNeed: 0.2,
      marginSensitivity: 0.2,
      longTailBreadthNeed: 1,
      timeToMarketPressure: 1,
      maintenanceAvoidanceValue: 1,
      unifiedVendorCoverage: 0.9,
      authComplexity: 0.9
    });
    assert.equal(unified.mode, "unified_or_embedded_adapter");

    const consequential = adapterSourcingDecision({
      consequence: "financial_mutation",
      strategicDifferentiation: 0,
      expectedVolume: 0,
      specializedCapabilityNeed: 0,
      latencySensitivity: 0,
      controlNeed: 0,
      marginSensitivity: 0,
      longTailBreadthNeed: 1,
      timeToMarketPressure: 1,
      maintenanceAvoidanceValue: 1,
      unifiedVendorCoverage: 1,
      authComplexity: 1
    });
    assert.equal(consequential.mode, "direct_or_regulated_specialist");
    assert.equal(consequential.genericFallbackAllowed, false);
  });

  it("measures verified depth with operational KPIs instead of catalog size", () => {
    const kpis = verifiedDepthKpis({
      productionVerifiedConnections: 3,
      supportedOperations: 12,
      syncAttempts: 100,
      syncSuccesses: 98,
      syncFreshnessSeconds: 75,
      reconciledRecords: 999,
      comparedRecords: 1000,
      sloAttainment: 0.997,
      cost: 49,
      activeConnections: 25,
      revenueInfluenced: 5000,
      retainedCustomersInfluenced: 4
    });
    assert.equal(kpis.productionVerifiedConnections, 3);
    assert.equal(kpis.successRate, 0.98);
    assert.equal(kpis.reconciliationAccuracy, 0.999);
    assert.equal(kpis.costPerSuccessfulSync, 0.5);
  });
});

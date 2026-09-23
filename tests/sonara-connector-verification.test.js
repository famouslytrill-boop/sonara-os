"use strict";

const assert = require("node:assert/strict");
const {
  CONNECTOR_STAGES,
  CONNECTION_STATES,
  CONNECTOR_BUILD_WAVES_2026,
  CONNECTOR_DOMAIN_MAP,
  requiredProofs,
  evaluateConnectorEvidence,
  connectorDepthScore,
  getConnectorVerificationArchitecture
} = require("../lib/sonara-connector-verification.cjs");
const {
  READONLY_SCOPE,
  PAGE_SIZE,
  getGoogleSearchConsoleReadContract,
  readDailySearchPerformance
} = require("../lib/sonara-google-search-console-read.cjs");

function providerResponse(status, payload, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized[String(name).toLowerCase()] || null },
    text: async () => JSON.stringify(payload)
  };
}

function completeReadProof(overrides = {}) {
  return {
    adapterContract: true,
    tenantIsolation: true,
    authorization: true,
    secretIsolation: true,
    credentialLifecycle: true,
    leastPrivilegeScopes: true,
    capabilityNegotiation: true,
    canonicalMapping: true,
    providerIdentityMapping: true,
    adapterVersioning: true,
    timeouts: true,
    rateLimitHandling: true,
    boundedRetry: true,
    failureTelemetry: true,
    reconciliation: true,
    disconnectAndRevoke: true,
    pagination: true,
    incrementalCursor: true,
    checkpointPersistence: true,
    duplicateAndReplayHandling: true,
    deletionOrTombstoneHandling: true,
    perRecordFailureCapture: true,
    backfillOrResync: true,
    sandboxEvidence: true,
    failureModeEvidence: true,
    ...overrides
  };
}

describe("SONARA verified connector depth", () => {
  it("defines evidence stages without granting runtime authority", () => {
    const architecture = getConnectorVerificationArchitecture();
    assert.deepEqual(CONNECTOR_STAGES, [
      "research_only",
      "adapter_contract",
      "sandbox_verified",
      "tenant_canary_verified",
      "production_verified"
    ]);
    assert.equal(architecture.researchOnly, true);
    assert.equal(architecture.grantsRuntimeAuthority, false);
    assert.match(architecture.rule, /not a verified native connector/i);
    assert.ok(CONNECTION_STATES.includes("reauthorization_required"));
    assert.ok(CONNECTION_STATES.includes("schema_drift"));
    assert.ok(CONNECTION_STATES.includes("provider_outage"));
  });

  it("does not promote a catalog record or happy-path request into verification", () => {
    const result = evaluateConnectorEvidence({
      proof: {
        adapterContract: true,
        productionEvidence: true,
        exactLiveShaEvidence: true
      }
    });
    assert.equal(result.stage, "adapter_contract");
    assert.equal(result.verifiedNative, false);
    assert.ok(result.blockers.includes("tenantIsolation"));
    assert.ok(result.blockers.includes("reconciliation"));
    assert.ok(result.blockers.includes("sandboxEvidence"));
  });

  it("allows a complete read connector to reach sandbox verification only", () => {
    const result = evaluateConnectorEvidence({ proof: completeReadProof() });
    assert.equal(result.stage, "sandbox_verified");
    assert.equal(result.verifiedNative, false);
    assert.ok(result.blockers.includes("tenantCanaryEvidence"));
    assert.ok(result.blockers.includes("exactLiveShaEvidence"));
  });

  it("requires webhook delivery correctness when a connector uses webhooks", () => {
    const required = requiredProofs({ usesWebhooks: true });
    assert.ok(required.includes("webhookSignatureVerification"));
    assert.ok(required.includes("webhookDeduplication"));
    assert.ok(required.includes("persistOrQueueBeforeAck"));
    assert.ok(required.includes("missedEventBackstop"));
  });

  it("requires write idempotency, provider receipts and settlement evidence", () => {
    const required = requiredProofs({ canMutateExternalState: true, sensitiveWrite: true });
    for (const key of [
      "authorityClassification",
      "idempotency",
      "providerReceipt",
      "settlementReconciliation",
      "rollbackOrCompensation",
      "humanApproval"
    ]) {
      assert.ok(required.includes(key), `missing write proof ${key}`);
    }
  });

  it("cannot call a sensitive mutating connector sandbox-verified without approval proof", () => {
    const proof = completeReadProof({
      authorityClassification: true,
      idempotency: true,
      providerReceipt: true,
      settlementReconciliation: true,
      rollbackOrCompensation: true,
      humanApproval: false
    });
    const result = evaluateConnectorEvidence({
      canMutateExternalState: true,
      sensitiveWrite: true,
      proof
    });
    assert.equal(result.stage, "adapter_contract");
    assert.ok(result.blockers.includes("humanApproval"));
  });

  it("requires canary, exact live SHA, rollback, SLO, cost and deletion evidence for native verification", () => {
    const proof = completeReadProof({
      tenantCanaryEvidence: true,
      rollbackEvidence: true,
      exactLiveShaEvidence: true,
      productionEvidence: true,
      operationalRunbook: true,
      providerDeprecationPlan: true,
      dataDeletionPropagation: true,
      sloEvidence: true,
      costAttribution: true
    });
    const result = evaluateConnectorEvidence({ proof });
    assert.equal(result.stage, "production_verified");
    assert.equal(result.verifiedNative, true);

    const withoutDeletion = evaluateConnectorEvidence({
      proof: { ...proof, dataDeletionPropagation: false }
    });
    assert.equal(withoutDeletion.verifiedNative, false);
    assert.ok(withoutDeletion.blockers.includes("dataDeletionPropagation"));
  });

  it("keeps the first build wave read-only and regulated mutations later", () => {
    assert.equal(CONNECTOR_BUILD_WAVES_2026[0].mode, "read_only");
    assert.deepEqual(CONNECTOR_BUILD_WAVES_2026[0].connectors, [
      "google_search_console",
      "app_store_connect_analytics",
      "google_play_developer_reporting",
      "google_analytics_data",
      "posthog"
    ]);
    assert.equal(CONNECTOR_BUILD_WAVES_2026.at(-1).mode, "regulated_or_consequential");
    assert.ok(CONNECTOR_BUILD_WAVES_2026.at(-1).connectors.includes("stripe_connect_mutations"));
    assert.ok(CONNECTOR_BUILD_WAVES_2026.at(-1).connectors.includes("device_iot_control"));
  });

  it("maps the requested cross-industry surface without pretending each domain is implemented", () => {
    const keys = new Set(CONNECTOR_DOMAIN_MAP.map((entry) => entry.key));
    for (const key of [
      "ai_models_and_agents",
      "commerce_payments_banking",
      "restaurant_pos_delivery",
      "field_service_trades",
      "logistics_trucking_routes",
      "manufacturing_engineering",
      "growth_analytics_search",
      "creator_media_distribution",
      "devices_spatial_realtime"
    ]) {
      assert.equal(keys.has(key), true, `missing domain map ${key}`);
    }
  });

  it("defines Search Console as an adapter-contract canary rather than a production connector", () => {
    const contract = getGoogleSearchConsoleReadContract();
    assert.equal(contract.providerKey, "google_search_console");
    assert.equal(contract.direction, "read_only");
    assert.equal(contract.auth.requiredScope, READONLY_SCOPE);
    assert.equal(contract.auth.offlineRefreshRequiredForBackgroundSync, true);
    assert.equal(contract.implementationStage, "adapter_contract");
    assert.equal(contract.productionEnabled, false);
    assert.ok(contract.verificationBlockers.includes("tenant_oauth_credential_vault"));
    assert.ok(contract.verificationBlockers.includes("one_tenant_production_canary"));
  });

  it("fails closed before Search Console network access without tenant scope and least privilege", async () => {
    let called = 0;
    const fetchImpl = async () => {
      called += 1;
      throw new Error("must not call provider");
    };

    const noTenant = await readDailySearchPerformance({
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-09-21",
      accessToken: "secret-token",
      fetchImpl
    });
    assert.equal(noTenant.ok, false);
    assert.equal(noTenant.code, "organization_id_required");

    const broadButWrongScope = await readDailySearchPerformance({
      organizationId: "org-1",
      businessId: "biz-1",
      connectionId: "connection-1",
      grantedScopes: ["https://www.googleapis.com/auth/webmasters"],
      siteUrl: "sc-domain:example.com",
      date: "2026-09-21",
      accessToken: "secret-token",
      fetchImpl
    });
    assert.equal(broadButWrongScope.ok, false);
    assert.equal(broadButWrongScope.code, "least_privilege_readonly_scope_required");
    assert.equal(called, 0);
  });

  it("paginates Search Console at the provider boundary and reconciles the canonical report", async () => {
    const calls = [];
    const repeated = { keys: ["https://example.com/a"], clicks: 1, impressions: 2, ctr: 0.5, position: 3 };
    const firstPage = Array.from({ length: PAGE_SIZE }, () => repeated);
    const fetchImpl = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body, authorization: options.headers.authorization });
      if (calls.length === 1) {
        return providerResponse(200, { rows: [{ clicks: PAGE_SIZE + 1, impressions: (PAGE_SIZE + 1) * 2, ctr: 0.5, position: 3 }] });
      }
      if (body.startRow === 0) return providerResponse(200, { rows: firstPage });
      if (body.startRow === PAGE_SIZE) {
        return providerResponse(200, { rows: [{ keys: ["https://example.com/b"], clicks: 1, impressions: 2, ctr: 0.5, position: 4 }] });
      }
      throw new Error("unexpected page");
    };

    const result = await readDailySearchPerformance({
      organizationId: "org-1",
      businessId: "biz-1",
      connectionId: "connection-1",
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-09-21",
      accessToken: "secret-token",
      fetchImpl,
      sleepImpl: async () => undefined
    });

    assert.equal(result.ok, true);
    assert.equal(result.report.rowCount, PAGE_SIZE + 1);
    assert.equal(result.report.reconciliation.status, "matched");
    assert.equal(result.report.coverage.completeClaimed, false);
    assert.equal(result.report.coverage.providerCoverageContract, "top_rows_not_guaranteed_exhaustive");
    assert.deepEqual(calls.map((call) => call.body.startRow), [0, 0, PAGE_SIZE]);
    assert.equal(calls[1].body.rowLimit, PAGE_SIZE);
    assert.equal(calls[1].body.startDate, "2026-09-21");
    assert.equal(calls[1].body.endDate, "2026-09-21");
    assert.equal(calls.every((call) => call.authorization === "Bearer secret-token"), true);
    assert.equal(JSON.stringify(result).includes("secret-token"), false);
    assert.match(result.report.evidenceHash, /^[a-f0-9]{64}$/);
  });

  it("uses bounded retry for transient Search Console failures without leaking provider credentials", async () => {
    let call = 0;
    const delays = [];
    const fetchImpl = async () => {
      call += 1;
      if (call === 1) return providerResponse(429, { error: { status: "RESOURCE_EXHAUSTED" } }, { "retry-after": "0" });
      if (call === 2) return providerResponse(200, { rows: [] });
      return providerResponse(200, { rows: [] });
    };

    const result = await readDailySearchPerformance({
      organizationId: "org-1",
      businessId: "biz-1",
      connectionId: "connection-1",
      grantedScopes: [READONLY_SCOPE],
      siteUrl: "sc-domain:example.com",
      date: "2026-09-21",
      accessToken: "secret-token",
      fetchImpl,
      sleepImpl: async (delay) => delays.push(delay)
    });

    assert.equal(result.ok, true);
    assert.equal(result.report.health.status, "recovered_after_retry");
    assert.equal(result.report.health.retries, 1);
    assert.deepEqual(delays, [0]);
    assert.equal(JSON.stringify(result).includes("secret-token"), false);
  });

  it("scores engineering depth deterministically without changing verification stage", () => {
    assert.equal(connectorDepthScore({
      authLifecycle: 1,
      capabilityCoverage: 1,
      dataCorrectness: 1,
      eventCorrectness: 1,
      reliability: 1,
      reconciliation: 1,
      tenantSecurity: 1,
      observability: 1,
      operationalProof: 1
    }), 1);

    assert.equal(connectorDepthScore({
      authLifecycle: 0.8,
      capabilityCoverage: 0.7,
      dataCorrectness: 0.9,
      eventCorrectness: 0.6,
      reliability: 0.8,
      reconciliation: 0.9,
      tenantSecurity: 1,
      observability: 0.7,
      operationalProof: 0.5
    }), 0.788);

    assert.throws(() => connectorDepthScore({ authLifecycle: 1.1 }), /between 0 and 1/);
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A connector is not "verified" because an SDK exists, an OAuth screen opens,
// or one happy-path request returned 200. This module turns connector depth into
// an evidence contract that can be tested without calling any provider.
//
// It intentionally grants no runtime authority. Provider activation still
// belongs behind tenant authorization, feature flags, the Provider Gateway /
// approved adapter boundary, agent authority, budgets and controlled release.

const CONNECTOR_VERIFICATION_VERSION = "1.0.0";
const CONNECTOR_RESEARCH_DATE = "2026-09-22";

const CONNECTOR_STAGES = Object.freeze([
  "research_only",
  "adapter_contract",
  "sandbox_verified",
  "tenant_canary_verified",
  "production_verified"
]);

const CONNECTION_STATES = Object.freeze([
  "connected",
  "limited",
  "degraded",
  "setup_required",
  "reauthorization_required",
  "scope_missing",
  "rate_limited",
  "budget_blocked",
  "schema_drift",
  "provider_outage",
  "revoked",
  "disabled",
  "unavailable"
]);

const BASE_PROOFS = Object.freeze([
  "adapterContract",
  "tenantIsolation",
  "authorization",
  "secretIsolation",
  "credentialLifecycle",
  "leastPrivilegeScopes",
  "capabilityNegotiation",
  "canonicalMapping",
  "providerIdentityMapping",
  "adapterVersioning",
  "timeouts",
  "rateLimitHandling",
  "boundedRetry",
  "failureTelemetry",
  "reconciliation",
  "disconnectAndRevoke"
]);

const READ_SYNC_PROOFS = Object.freeze([
  "pagination",
  "incrementalCursor",
  "checkpointPersistence",
  "duplicateAndReplayHandling",
  "deletionOrTombstoneHandling",
  "perRecordFailureCapture",
  "backfillOrResync"
]);

const WEBHOOK_PROOFS = Object.freeze([
  "webhookSignatureVerification",
  "webhookDeduplication",
  "persistOrQueueBeforeAck",
  "missedEventBackstop"
]);

const ASYNC_PROOFS = Object.freeze([
  "deadLetterHandling",
  "concurrencySafety"
]);

const WRITE_PROOFS = Object.freeze([
  "authorityClassification",
  "idempotency",
  "providerReceipt",
  "settlementReconciliation",
  "rollbackOrCompensation"
]);

const PRODUCTION_PROOFS = Object.freeze([
  "sandboxEvidence",
  "failureModeEvidence",
  "tenantCanaryEvidence",
  "exactLiveShaEvidence",
  "productionEvidence",
  "rollbackEvidence",
  "operationalRunbook",
  "providerDeprecationPlan",
  "dataDeletionPropagation",
  "sloEvidence",
  "costAttribution"
]);

const SENSITIVE_WRITE_PROOFS = Object.freeze(["humanApproval"]);

function requiredProofs(connector = {}) {
  const required = new Set(BASE_PROOFS);
  if (connector.syncsCollections !== false) {
    for (const key of READ_SYNC_PROOFS) required.add(key);
  }
  if (connector.usesWebhooks) {
    for (const key of WEBHOOK_PROOFS) required.add(key);
  }
  if (connector.usesAsyncExecution) {
    for (const key of ASYNC_PROOFS) required.add(key);
  }
  if (connector.canMutateExternalState) {
    for (const key of WRITE_PROOFS) required.add(key);
    if (connector.sensitiveWrite) {
      for (const key of SENSITIVE_WRITE_PROOFS) required.add(key);
    }
  }
  return [...required];
}

function missingProofs(connector, keys = requiredProofs(connector)) {
  return keys.filter((key) => connector?.proof?.[key] !== true);
}

function evaluateConnectorEvidence(connector = {}) {
  const proof = connector.proof || {};
  const required = requiredProofs(connector);
  const baseMissing = missingProofs(connector, required);

  let stage = "research_only";

  if (proof.adapterContract === true) stage = "adapter_contract";

  const sandboxReady = baseMissing.length === 0
    && proof.sandboxEvidence === true
    && proof.failureModeEvidence === true;

  if (sandboxReady) stage = "sandbox_verified";

  const canaryReady = sandboxReady
    && proof.tenantCanaryEvidence === true
    && proof.rollbackEvidence === true;

  if (canaryReady) stage = "tenant_canary_verified";

  const productionMissing = missingProofs(connector, PRODUCTION_PROOFS);
  const productionReady = canaryReady
    && productionMissing.length === 0;

  if (productionReady) stage = "production_verified";

  return Object.freeze({
    stage,
    verifiedNative: stage === "production_verified",
    requiredProofs: required,
    blockers: stage === "production_verified"
      ? []
      : [...new Set([
          ...baseMissing,
          ...(proof.sandboxEvidence === true ? [] : ["sandboxEvidence"]),
          ...(proof.failureModeEvidence === true ? [] : ["failureModeEvidence"]),
          ...(proof.tenantCanaryEvidence === true ? [] : ["tenantCanaryEvidence"]),
          ...(proof.rollbackEvidence === true ? [] : ["rollbackEvidence"]),
          ...productionMissing
        ])]
  });
}

const DEPTH_SCORE_WEIGHTS = Object.freeze({
  authLifecycle: 0.12,
  capabilityCoverage: 0.10,
  dataCorrectness: 0.14,
  eventCorrectness: 0.10,
  reliability: 0.14,
  reconciliation: 0.12,
  tenantSecurity: 0.12,
  observability: 0.08,
  operationalProof: 0.08
});

function unit(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
  return number;
}

// This score is a backlog/engineering diagnostic only. It never upgrades a
// connector's verification stage; hard evidence gates above remain authoritative.
function connectorDepthScore(dimensions = {}) {
  let total = 0;
  for (const [key, weight] of Object.entries(DEPTH_SCORE_WEIGHTS)) {
    total += unit(dimensions[key] ?? 0, key) * weight;
  }
  return Number(total.toFixed(4));
}

const CONNECTOR_BUILD_WAVES_2026 = Object.freeze([
  Object.freeze({
    wave: 1,
    mode: "read_only",
    reason: "Prove OAuth/service-account lifecycle, canonical reads, pagination/cursors, reconciliation and observability before external mutations.",
    connectors: Object.freeze([
      "google_search_console",
      "app_store_connect_analytics",
      "google_play_developer_reporting",
      "google_analytics_data",
      "posthog"
    ])
  }),
  Object.freeze({
    wave: 2,
    mode: "read_first_then_bounded_write",
    reason: "Extend the same evidence contract into CRM, commerce and collaboration where reads create immediate customer value.",
    connectors: Object.freeze([
      "hubspot",
      "shopify_graphql_admin",
      "microsoft_graph",
      "slack",
      "quickbooks_online"
    ])
  }),
  Object.freeze({
    wave: 3,
    mode: "regulated_or_consequential",
    reason: "Money movement, banking mutation, publication, ad spend, device control and other consequential actions require stronger approval and settlement evidence.",
    connectors: Object.freeze([
      "stripe_connect_mutations",
      "plaid_mutating_products",
      "social_publishing",
      "ads_mutations",
      "pos_order_writes",
      "device_iot_control"
    ])
  })
]);

const CONNECTOR_DOMAIN_MAP = Object.freeze([
  Object.freeze({ key: "ai_models_and_agents", owner: "SONARA One", examples: ["LLM providers", "MCP tools", "RAG stores", "generation providers"] }),
  Object.freeze({ key: "identity_collaboration_storage", owner: "SONARA One", examples: ["Google Workspace", "Microsoft Graph", "Slack", "GitHub", "file storage"] }),
  Object.freeze({ key: "commerce_payments_banking", owner: "Business Builder", examples: ["Shopify", "Stripe", "Plaid", "accounting", "subscriptions", "refund evidence"] }),
  Object.freeze({ key: "restaurant_pos_delivery", owner: "Business Builder", examples: ["POS", "menus", "orders", "KDS", "delivery aggregators", "loyalty"] }),
  Object.freeze({ key: "field_service_trades", owner: "Business Builder", examples: ["HVAC", "electrical", "plumbing", "carpentry", "cleaning", "work orders", "dispatch"] }),
  Object.freeze({ key: "logistics_trucking_routes", owner: "Business Builder", examples: ["fleet", "GPS", "shipping", "tracking", "route optimization", "proof of delivery"] }),
  Object.freeze({ key: "manufacturing_engineering", owner: "Business Builder", examples: ["ERP", "MES", "CAD metadata", "inventory", "quality", "maintenance"] }),
  Object.freeze({ key: "property_jobs_public_data", owner: "Business Builder", examples: ["real estate", "rentals", "jobs", "permits", "official open data"] }),
  Object.freeze({ key: "growth_analytics_search", owner: "Growth Studio", examples: ["Search Console", "GA4", "PostHog", "SEO", "ASO", "attribution"] }),
  Object.freeze({ key: "crm_campaigns_social", owner: "Growth Studio", examples: ["CRM", "email", "social analytics", "reviews", "ads", "publishing"] }),
  Object.freeze({ key: "creator_media_distribution", owner: "Creator Studio", examples: ["video", "audio", "podcasts", "music", "images", "streaming", "distribution"] }),
  Object.freeze({ key: "devices_spatial_realtime", owner: "SONARA One", examples: ["cameras", "GPS", "gyroscope", "AR", "notifications", "haptics", "realtime communications"] })
]);

function getConnectorVerificationArchitecture() {
  return Object.freeze({
    version: CONNECTOR_VERIFICATION_VERSION,
    observed: CONNECTOR_RESEARCH_DATE,
    researchOnly: true,
    grantsRuntimeAuthority: false,
    connectorStages: CONNECTOR_STAGES,
    connectionStates: CONNECTION_STATES,
    buildWaves: CONNECTOR_BUILD_WAVES_2026,
    domainMap: CONNECTOR_DOMAIN_MAP,
    rule: "A catalog entry, SDK, compatible API, successful OAuth screen, or isolated 2xx response is not a verified native connector."
  });
}

module.exports = {
  CONNECTOR_VERIFICATION_VERSION,
  CONNECTOR_RESEARCH_DATE,
  CONNECTOR_STAGES,
  CONNECTION_STATES,
  BASE_PROOFS,
  READ_SYNC_PROOFS,
  WEBHOOK_PROOFS,
  ASYNC_PROOFS,
  WRITE_PROOFS,
  PRODUCTION_PROOFS,
  SENSITIVE_WRITE_PROOFS,
  DEPTH_SCORE_WEIGHTS,
  CONNECTOR_BUILD_WAVES_2026,
  CONNECTOR_DOMAIN_MAP,
  requiredProofs,
  missingProofs,
  evaluateConnectorEvidence,
  connectorDepthScore,
  getConnectorVerificationArchitecture
};

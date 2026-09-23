// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const AGGREGATOR_SOURCING_VERSION = "1.0.0";
const AGGREGATOR_SOURCING_DATE = "2026-09-23";

const AGGREGATOR_MARKET_LAYERS = Object.freeze([
  Object.freeze({
    key: "unified_saas_common_models",
    examples: Object.freeze(["Merge", "Apideck"]),
    useWhen: "Common business objects across many SaaS providers are more valuable than provider-specific differentiation.",
    sonaraBoundary: "SONARA owns tenant authority, canonical truth, capability state, evidence, reconciliation, metering, and billing."
  }),
  Object.freeze({
    key: "embedded_auth_and_connector_infrastructure",
    examples: Object.freeze(["Nango", "Paragon", "Pipedream Connect"]),
    useWhen: "Managed OAuth, credential lifecycle, webhook/sync plumbing, and long-tail provider reach reduce undifferentiated engineering work.",
    sonaraBoundary: "Hosted or headless connection UX cannot bypass SONARA scope, entitlement, secret, approval, or audit policy."
  }),
  Object.freeze({
    key: "agent_tool_aggregation",
    examples: Object.freeze(["Composio", "Pipedream", "MCP-compatible tool servers"]),
    useWhen: "Agents need a governed catalog of external tools and authenticated accounts.",
    sonaraBoundary: "Tool discovery never grants tool invocation authority; consequential actions remain policy-gated."
  }),
  Object.freeze({
    key: "data_elt_and_cdc",
    examples: Object.freeze(["Airbyte", "Fivetran"]),
    useWhen: "Broad extraction/load coverage and schema maintenance are more important than provider-specific product UX.",
    sonaraBoundary: "SONARA retains canonical object mapping, freshness SLOs, lineage, reconciliation, and customer-visible health."
  }),
  Object.freeze({
    key: "workflow_ipaas",
    examples: Object.freeze(["Workato", "n8n"]),
    useWhen: "Commodity workflow reach accelerates orchestration across external systems.",
    sonaraBoundary: "External workflow engines cannot become a second source of truth for SONARA policy, approvals, billing, or settled state."
  }),
  Object.freeze({
    key: "model_and_media_routing",
    examples: Object.freeze(["OpenRouter", "LiteLLM", "specialized generation providers"]),
    useWhen: "Policy-aware routing across models or compute providers improves reach, resilience, or cost.",
    sonaraBoundary: "Hard constraints for rights, residency, retention, budget, safety, and capability run before route scoring."
  }),
  Object.freeze({
    key: "regulated_and_vertical_aggregators",
    examples: Object.freeze(["Stripe Connect", "Plaid", "Deliverect", "vertical channel partners"]),
    useWhen: "A specialist provider owns regulated, institution, marketplace, POS, travel, logistics, or other difficult network reach.",
    sonaraBoundary: "SONARA records authority, receipts, reconciliation, reversals, and customer evidence without pretending to be the regulated rail."
  })
]);

function unit(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return number;
}

function round(value) {
  return Number(value.toFixed(4));
}

function adapterSourcingDecision(input = {}) {
  const consequence = String(input.consequence || "read_only");
  const direct = round(
    0.20 * unit(input.strategicDifferentiation ?? 0, "strategicDifferentiation") +
    0.15 * unit(input.expectedVolume ?? 0, "expectedVolume") +
    0.20 * unit(input.specializedCapabilityNeed ?? 0, "specializedCapabilityNeed") +
    0.10 * unit(input.latencySensitivity ?? 0, "latencySensitivity") +
    0.20 * unit(input.controlNeed ?? 0, "controlNeed") +
    0.15 * unit(input.marginSensitivity ?? 0, "marginSensitivity")
  );

  const unified = round(
    0.25 * unit(input.longTailBreadthNeed ?? 0, "longTailBreadthNeed") +
    0.25 * unit(input.timeToMarketPressure ?? 0, "timeToMarketPressure") +
    0.20 * unit(input.maintenanceAvoidanceValue ?? 0, "maintenanceAvoidanceValue") +
    0.20 * unit(input.unifiedVendorCoverage ?? 0, "unifiedVendorCoverage") +
    0.10 * unit(input.authComplexity ?? 0, "authComplexity")
  );

  if (["regulated_mutation", "financial_mutation", "public_publish", "device_control", "security_mutation"].includes(consequence)) {
    return Object.freeze({
      mode: "direct_or_regulated_specialist",
      directScore: direct,
      unifiedScore: unified,
      reason: "consequential_operation_requires_explicit_provider_boundary_and_connector_specific_evidence",
      genericFallbackAllowed: false
    });
  }

  const delta = round(direct - unified);
  if (delta >= 0.08) {
    return Object.freeze({
      mode: "direct_adapter",
      directScore: direct,
      unifiedScore: unified,
      reason: "control_or_differentiation_outweighs_aggregation_savings",
      genericFallbackAllowed: consequence === "read_only"
    });
  }

  if (delta <= -0.08) {
    return Object.freeze({
      mode: "unified_or_embedded_adapter",
      directScore: direct,
      unifiedScore: unified,
      reason: "breadth_time_to_market_or_maintenance_savings_outweigh_direct_control",
      genericFallbackAllowed: consequence === "read_only"
    });
  }

  return Object.freeze({
    mode: "hybrid_evaluate",
    directScore: direct,
    unifiedScore: unified,
    reason: "economics_are_close_keep_a_replaceable_adapter_boundary_and_measure_real_usage",
    genericFallbackAllowed: consequence === "read_only"
  });
}

function verifiedDepthKpis(input = {}) {
  const attempts = Number(input.syncAttempts || 0);
  const successes = Number(input.syncSuccesses || 0);
  const reconciled = Number(input.reconciledRecords || 0);
  const compared = Number(input.comparedRecords || 0);

  return Object.freeze({
    productionVerifiedConnections: Math.max(0, Number(input.productionVerifiedConnections || 0)),
    supportedOperations: Math.max(0, Number(input.supportedOperations || 0)),
    successRate: attempts > 0 ? round(successes / attempts) : null,
    syncFreshnessSeconds: input.syncFreshnessSeconds == null ? null : Math.max(0, Number(input.syncFreshnessSeconds)),
    reconciliationAccuracy: compared > 0 ? round(reconciled / compared) : null,
    sloAttainment: input.sloAttainment == null ? null : unit(input.sloAttainment, "sloAttainment"),
    costPerSuccessfulSync: successes > 0 ? round(Math.max(0, Number(input.cost || 0)) / successes) : null,
    activeConnections: Math.max(0, Number(input.activeConnections || 0)),
    revenueInfluenced: Math.max(0, Number(input.revenueInfluenced || 0)),
    retainedCustomersInfluenced: Math.max(0, Number(input.retainedCustomersInfluenced || 0))
  });
}

function getAggregatorSourcingPolicy() {
  return Object.freeze({
    version: AGGREGATOR_SOURCING_VERSION,
    observed: AGGREGATOR_SOURCING_DATE,
    runtimeEnabled: false,
    grantsRuntimeAuthority: false,
    marketLayers: AGGREGATOR_MARKET_LAYERS,
    sourcingRule: "Own SONARA's control plane and canonical truth; buy replaceable reach where it accelerates breadth without surrendering authority.",
    verificationRule: "Adapter sourcing mode never upgrades connector verification stage."
  });
}

module.exports = {
  AGGREGATOR_SOURCING_VERSION,
  AGGREGATOR_SOURCING_DATE,
  AGGREGATOR_MARKET_LAYERS,
  adapterSourcingDecision,
  verifiedDepthKpis,
  getAggregatorSourcingPolicy
};

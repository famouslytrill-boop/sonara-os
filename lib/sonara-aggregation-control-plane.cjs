// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const AGGREGATOR_RESEARCH_DATE = "2026-09-22";
const AGGREGATOR_ARCHITECTURE_VERSION = "1.0.0";

const PROTOCOL_BASELINE = Object.freeze({
  openapi: "3.2.1",
  asyncapi: "3.1.0",
  cloudevents: "1.0",
  mcp: "2026-07-28",
  opentelemetrySemanticConventions: "1.44.0"
});

const AGGREGATOR_MARKET_SIGNALS_2026 = Object.freeze([
  signal({
    key: "unified_saas_apis",
    finding: "Customer-facing integration platforms normalize multiple SaaS providers into common models while preserving provider-specific capabilities.",
    source: "Merge Unified",
    sourceUrl: "https://docs.merge.dev/merge-unified/overview",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Use canonical SONARA domain objects plus provider envelopes; never let provider-specific payload shapes become core business state."
  }),
  signal({
    key: "llm_multi_provider_gateway",
    finding: "AI gateways increasingly expose one API across many models with routing, fallback, budget, observability, and governance controls.",
    source: "OpenRouter and LiteLLM",
    sourceUrl: "https://docs.litellm.ai/",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Model aggregation belongs behind SONARA Provider Gateway with explicit routing policy, cost ceilings, health state, and no silent authority escalation."
  }),
  signal({
    key: "data_connector_scale",
    finding: "Modern data integration vendors compete on hundreds of maintained connectors, schema-change handling, incremental sync, and custom connector SDKs.",
    source: "Airbyte and Fivetran",
    sourceUrl: "https://airbyte.com/connectors",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Connector count is not enough; SONARA needs lifecycle evidence for auth, schema drift, incremental cursors, replay, backfill, and reconciliation."
  }),
  signal({
    key: "workflow_aggregation",
    finding: "Automation platforms combine connectors, triggers, actions, event recipes, data pipelines, error handling, concurrency controls, and job history.",
    source: "Workato and n8n",
    sourceUrl: "https://docs.workato.com/en/ipaas",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "SONARA aggregation must plug into durable workflows rather than become a separate low-code island."
  }),
  signal({
    key: "embedded_marketplace_payments",
    finding: "Marketplace payment platforms aggregate onboarding, verification, split money movement, payouts, disputes, tax, and compliance support.",
    source: "Stripe Connect",
    sourceUrl: "https://stripe.com/connect",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Keep payment aggregation behind regulated provider boundaries and reconcile provider receipts into SONARA commerce state."
  }),
  signal({
    key: "financial_data_networks",
    finding: "Financial-data aggregators expose normalized access across thousands of institutions with product-by-institution availability and health differences.",
    source: "Plaid",
    sourceUrl: "https://plaid.com/docs/institutions/",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Capability negotiation must be connection-specific; never assume every institution supports every financial product."
  }),
  signal({
    key: "restaurant_order_aggregation",
    finding: "Restaurant aggregation leaders unify third-party orders, menus, POS/KDS connections, fulfillment, and revenue recovery across large integration networks.",
    source: "Deliverect",
    sourceUrl: "https://www.deliverect.com/en-us",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Restaurant aggregation should normalize menu, modifier, order, fulfillment, location, and receipt semantics while keeping POS adapters replaceable."
  }),
  signal({
    key: "social_distribution_aggregation",
    finding: "Social API aggregators normalize publishing, scheduling, comments, and analytics across multiple social networks and now expose agent-facing interfaces.",
    source: "Ayrshare",
    sourceUrl: "https://www.ayrshare.com/integrations/",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Use one SONARA content package and publishing receipt model with per-network capability negotiation and explicit approval."
  }),
  signal({
    key: "travel_connectivity_permissions",
    finding: "Travel connectivity platforms require granular partner permissions and separate availability, reservations, content, and payment capabilities.",
    source: "Booking.com Connectivity APIs",
    sourceUrl: "https://developers.booking.com/connectivity/docs",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Connection scopes belong in first-class policy data rather than being treated as a generic connected/not-connected boolean."
  }),
  signal({
    key: "geospatial_capability_families",
    finding: "Location platforms expose distinct places, route, route-optimization, roads, geocoding, weather, and environmental APIs with different quotas and billing.",
    source: "Google Maps Platform",
    sourceUrl: "https://developers.google.com/maps/apis-by-platform",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Use task-specific geo capabilities under one adapter family while preserving cost, quota, region, and field-selection controls."
  }),
  signal({
    key: "agent_protocol_aggregation",
    finding: "The July 2026 MCP specification moved to a stateless core with header routing, cacheable capability lists, authorization hardening, and task extensions.",
    source: "Model Context Protocol",
    sourceUrl: "https://blog.modelcontextprotocol.io/posts/2026-07-28/",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Expose approved SONARA tools through a stateless gateway that authorizes by tenant, tool, scope, cost, and action class."
  }),
  signal({
    key: "machine_readable_contracts",
    finding: "OpenAPI 3.2.1, AsyncAPI, CloudEvents, and OpenTelemetry provide current machine-readable contracts for request/response APIs, event APIs, event envelopes, and telemetry.",
    source: "OpenAPI, AsyncAPI, CloudEvents, OpenTelemetry",
    sourceUrl: "https://spec.openapis.org/oas/v3.2.1.html",
    asOf: AGGREGATOR_RESEARCH_DATE,
    implication: "Prefer open contracts and semantic conventions over SONARA-only wire formats."
  })
]);

const AGGREGATION_DOMAINS = Object.freeze([
  domain("ai_model_gateway", ["models", "embeddings", "image", "audio", "video", "rerankers"], ["model", "deployment", "usage", "cost", "latency", "provider_receipt"], "Provider Gateway", "bounded_external_compute"),
  domain("agent_tool_gateway", ["MCP tools", "resources", "tasks", "agent-to-system actions"], ["tool", "capability", "scope", "task", "approval", "receipt"], "Nexus", "approval_gated"),
  domain("saas_unified_api", ["CRM", "HRIS", "ATS", "accounting", "ticketing", "file storage", "knowledge", "chat"], ["connection", "external_account", "canonical_record", "sync_cursor", "provider_receipt"], "Nexus", "tenant_scoped"),
  domain("workflow_automation", ["triggers", "actions", "recipes", "event workflows", "data pipelines"], ["workflow", "run", "step", "event", "retry", "dead_letter", "evidence"], "Nexus", "deterministic_execution"),
  domain("data_integration_cdp", ["ETL/ELT", "reverse ETL", "customer data", "warehouses", "lakes"], ["source", "destination", "schema", "cursor", "batch", "lineage", "quality"], "Nexus", "governed_data_plane"),
  domain("banking_financial_data", ["accounts", "transactions", "balances", "identity", "investments", "liabilities"], ["institution", "account", "transaction", "balance_snapshot", "consent", "coverage"], "Business Builder", "regulated_partner_boundary"),
  domain("payments_marketplace", ["checkout", "subscriptions", "connected accounts", "payouts", "refunds", "disputes"], ["payment_account", "payment", "refund", "payout", "dispute", "entitlement", "ledger_event"], "Business Builder", "regulated_partner_boundary"),
  domain("restaurant_order_pos", ["marketplace orders", "menus", "POS", "KDS", "loyalty", "last mile"], ["location", "menu", "modifier", "order", "fulfillment", "receipt", "menu_sync"], "Business Builder", "vertical_pack"),
  domain("social_publishing", ["publishing", "scheduling", "comments", "analytics", "profile connections"], ["social_account", "content_package", "publication", "network_receipt", "metric_snapshot"], "Growth Studio", "approval_gated"),
  domain("commerce_catalog_marketplace", ["products", "variants", "inventory", "orders", "marketplaces", "returns"], ["product", "variant", "sku", "inventory_position", "order", "return", "channel_listing"], "Business Builder", "vertical_pack"),
  domain("shipping_delivery_routes", ["carrier rates", "labels", "tracking", "dispatch", "route optimization"], ["shipment", "package", "rate_quote", "label", "tracking_event", "route", "stop"], "Business Builder", "provider_backed"),
  domain("travel_lodging", ["availability", "rates", "reservations", "property content", "metasearch"], ["property", "room_type", "rate_plan", "availability", "reservation", "connection_scope"], "Business Builder", "partner_boundary"),
  domain("places_reviews_reputation", ["business search", "places", "reviews", "reputation", "local discovery"], ["place", "business_profile", "review_reference", "rating_snapshot", "source_attribution"], "Growth Studio", "read_first"),
  domain("creator_media_distribution", ["video", "audio", "podcasts", "images", "streaming", "publishing"], ["asset", "rendition", "timeline", "rights", "package", "publication", "analytics_receipt"], "Creator Studio", "rights_aware"),
  domain("identity_auth", ["OAuth", "OIDC", "passkeys", "KYC handoff", "directory sync"], ["principal", "credential_reference", "connection_scope", "consent", "auth_event"], "Nexus", "security_boundary"),
  domain("jobs_talent", ["job boards", "applicants", "HRIS", "ATS", "scheduling"], ["job", "candidate", "application", "interview", "offer_reference", "employment_reference"], "Business Builder", "partner_boundary"),
  domain("property_real_estate", ["listings", "rentals", "properties", "maintenance", "bookings"], ["property", "unit", "listing", "booking", "maintenance_request", "tenant_reference"], "Business Builder", "vertical_pack"),
  domain("iot_edge_robotics", ["devices", "telemetry", "cameras", "GPS", "sensors", "robots"], ["device", "observation", "command_request", "location_event", "media_evidence", "safety_state"], "Nexus", "safety_gated"),
  domain("public_sector_open_data", ["open data", "permits", "public records", "government service APIs"], ["jurisdiction", "dataset", "record_reference", "permit", "status_event", "provenance"], "Business Builder", "policy_reviewed")
]);

const AGGREGATION_CONTROL_PLANE_REQUIREMENTS = Object.freeze([
  "tenant-scoped connection registry with provider/account identity",
  "credential references only; no secrets in model context or client-visible payloads",
  "capability negotiation per connection and operation",
  "canonical SONARA objects plus preserved provider envelope and external identifiers",
  "OpenAPI 3.2.1 contracts for request-response adapters where applicable",
  "AsyncAPI plus CloudEvents envelopes for event-driven adapters where applicable",
  "MCP 2026-07-28 gateway for approved agent-facing tools/resources/tasks",
  "idempotency keys for every externally mutating operation",
  "bounded retries with retry classification, deadlines, backoff, and dead-letter handling",
  "rate, quota, concurrency, latency, and monetary budgets",
  "explicit human approval for sensitive financial, destructive, publication, security, legal, or bulk actions",
  "provider receipts, webhook signatures, sync cursors, timestamps, and immutable audit evidence",
  "reconciliation jobs comparing SONARA desired/recorded state with provider state",
  "provider health, circuit-breaker state, degradation, setup-required, and disabled states",
  "OpenTelemetry correlation by tenant, capability, provider, operation, latency, cost, result, and error class",
  "field-level provenance, source attribution, freshness, consent, retention, and deletion policy",
  "schema/version drift detection with compatibility tests",
  "sandbox/test mode separated from production credentials and production evidence",
  "provider-specific extensions allowed only outside canonical core models",
  "customer-visible truthful capability state: connected, limited, degraded, setup_required, disabled, or unavailable"
]);

const AGGREGATOR_IMPLEMENTATION_SEQUENCE = Object.freeze([
  "define_connection_capability_and_provider_envelope_contracts",
  "define_canonical_identity_external_id_and_provenance_rules",
  "standardize_openapi_asyncapi_cloudevents_mcp_contract_boundaries",
  "add_provider_health_quota_cost_and_capability_registry",
  "add_sync_cursor_webhook_receipt_and_reconciliation_contracts",
  "add_idempotent_mutation_retry_dead_letter_and_concurrency_contracts",
  "add_opentelemetry_aggregation_semantics_and_slos",
  "ship_read_only_connectors_first_for_low_risk_domains",
  "canary_one_mutating_connector_with_human_approval_and_reconciliation",
  "expand_domain_by_domain_only_after_connector_specific_proof",
  "publish_verified_native_connector_counts_separately_from_research_catalog_counts"
]);

function signal(input) {
  return Object.freeze({
    ...input,
    runtimeAuthority: "none",
    productionCapability: false
  });
}

function domain(key, capabilities, canonicalObjects, productOwner, authorityClass) {
  return Object.freeze({
    key,
    capabilities: Object.freeze([...capabilities]),
    canonicalObjects: Object.freeze([...canonicalObjects]),
    productOwner,
    authorityClass,
    implementationState: "architecture_only",
    productionEnabled: false
  });
}

function unit(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return n;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function aggregationReadinessScore(input = {}) {
  const canonicalModelCoverage = unit(input.canonicalModelCoverage, "canonicalModelCoverage");
  const authScopeCoverage = unit(input.authScopeCoverage, "authScopeCoverage");
  const eventCoverage = unit(input.eventCoverage, "eventCoverage");
  const reconciliationCoverage = unit(input.reconciliationCoverage, "reconciliationCoverage");
  const observabilityCoverage = unit(input.observabilityCoverage, "observabilityCoverage");
  const failureHandlingCoverage = unit(input.failureHandlingCoverage, "failureHandlingCoverage");
  const capabilityNegotiationCoverage = unit(input.capabilityNegotiationCoverage, "capabilityNegotiationCoverage");

  return round(
    0.20 * canonicalModelCoverage +
    0.15 * authScopeCoverage +
    0.15 * eventCoverage +
    0.15 * reconciliationCoverage +
    0.10 * observabilityCoverage +
    0.15 * failureHandlingCoverage +
    0.10 * capabilityNegotiationCoverage
  );
}

function providerRouteScore(input = {}) {
  const quality = unit(input.quality, "quality");
  const reliability = unit(input.reliability, "reliability");
  const freshness = unit(input.freshness, "freshness");
  const latencyFit = unit(input.latencyFit, "latencyFit");
  const costFit = unit(input.costFit, "costFit");
  const policyFit = unit(input.policyFit, "policyFit");

  return round(
    0.25 * quality +
    0.25 * reliability +
    0.15 * freshness +
    0.10 * latencyFit +
    0.10 * costFit +
    0.15 * policyFit
  );
}

function mutationAuthorityDecision(input = {}) {
  if (!input.tenantScoped) return Object.freeze({ allowed: false, mode: "blocked", reason: "tenant_scope_required" });
  if (!input.idempotent) return Object.freeze({ allowed: false, mode: "blocked", reason: "idempotency_required" });
  if (!input.reconciliationPlanned) return Object.freeze({ allowed: false, mode: "blocked", reason: "reconciliation_required" });
  if (input.sensitive && !input.approved) return Object.freeze({ allowed: false, mode: "approval_required", reason: "sensitive_action" });
  if (!input.providerHealthy) return Object.freeze({ allowed: false, mode: "defer", reason: "provider_unhealthy" });
  return Object.freeze({ allowed: true, mode: "bounded_provider_mutation", reason: "policy_pass" });
}

function getAggregatorMarketArchitecture() {
  return {
    ok: true,
    researchOnly: true,
    productionExecutionCount: 0,
    researchDate: AGGREGATOR_RESEARCH_DATE,
    version: AGGREGATOR_ARCHITECTURE_VERSION,
    protocolBaseline: { ...PROTOCOL_BASELINE },
    marketSignalCount: AGGREGATOR_MARKET_SIGNALS_2026.length,
    domainCount: AGGREGATION_DOMAINS.length,
    requirementCount: AGGREGATION_CONTROL_PLANE_REQUIREMENTS.length,
    implementationStepCount: AGGREGATOR_IMPLEMENTATION_SEQUENCE.length,
    marketSignals: AGGREGATOR_MARKET_SIGNALS_2026.map((item) => ({ ...item })),
    domains: AGGREGATION_DOMAINS.map((item) => ({
      ...item,
      capabilities: [...item.capabilities],
      canonicalObjects: [...item.canonicalObjects]
    })),
    requirements: [...AGGREGATION_CONTROL_PLANE_REQUIREMENTS],
    implementationSequence: [...AGGREGATOR_IMPLEMENTATION_SEQUENCE],
    formulas: {
      aggregationReadinessScore: "0.20*canonical_model + 0.15*auth_scope + 0.15*events + 0.15*reconciliation + 0.10*observability + 0.15*failure_handling + 0.10*capability_negotiation",
      providerRouteScore: "0.25*quality + 0.25*reliability + 0.15*freshness + 0.10*latency_fit + 0.10*cost_fit + 0.15*policy_fit"
    },
    guardrails: [
      "Research catalog size is never reported as verified SONARA native integration count.",
      "No provider, model, connector, repository, payment rail, social account, device, or external service is enabled by this module.",
      "Provider-specific extensions cannot silently redefine canonical SONARA business state.",
      "Sensitive external mutations require deterministic policy checks and human approval where the action class requires it.",
      "Every externally mutating operation requires idempotency, provider receipt evidence, and reconciliation.",
      "Financial, identity, public-sector, safety-critical, and regulated capabilities remain reviewed provider boundaries.",
      "Raw credentials and secrets never enter customer-visible payloads, model prompts, analytics events, or logs.",
      "A successful API response is not sufficient proof of business completion; reconciliation determines settled state."
    ]
  };
}

module.exports = {
  AGGREGATOR_RESEARCH_DATE,
  AGGREGATOR_ARCHITECTURE_VERSION,
  PROTOCOL_BASELINE,
  AGGREGATOR_MARKET_SIGNALS_2026,
  AGGREGATION_DOMAINS,
  AGGREGATION_CONTROL_PLANE_REQUIREMENTS,
  AGGREGATOR_IMPLEMENTATION_SEQUENCE,
  aggregationReadinessScore,
  providerRouteScore,
  mutationAuthorityDecision,
  getAggregatorMarketArchitecture
};

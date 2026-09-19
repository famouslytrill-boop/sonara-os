// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { getUnifiedBatchConvergence, inferLicenseRisk } = require("./sonara-batch-convergence-engine.cjs");
const hostedModels = require("./sonara-model-provider-router.cjs");

const PRODUCTS = Object.freeze([
  "SONARA One",
  "Business Builder™",
  "Creator Studio™",
  "Growth Studio™"
]);

const RUNTIME_LANES = Object.freeze([
  "web_process",
  "isolated_worker",
  "isolated_gpu_worker",
  "owner_device",
  "browser_runtime",
  "developer_only",
  "external_api"
]);

const ADOPTION_TIERS = Object.freeze([
  "active_core",
  "available_with_setup",
  "isolated_worker_candidate",
  "developer_tool",
  "external_companion",
  "research_only",
  "blocked"
]);

function getRuntimeCapabilityPlan(options = {}) {
  const convergence = options.convergence || getUnifiedBatchConvergence();
  const providerState = sanitizeProviderState(options.providerState || hostedModels.getProviderReadiness());
  const research = (convergence.repositories || []).map(planResearchRecord);
  const runtimeCore = buildRuntimeCore(providerState);
  const capabilities = [...runtimeCore, ...research];
  const productPlans = Object.fromEntries(PRODUCTS.map((product) => [
    product,
    capabilities.filter((item) => item.productTargets.includes(product)).map(copy)
  ]));

  return {
    ok: true,
    mode: "governed_research_to_runtime_capability_plan",
    sourceMode: convergence.mode || "unknown",
    sourceRepositoryCount: Number(convergence.counts?.uniqueRepositoryResearch || research.length),
    runtimeLanes: [...RUNTIME_LANES],
    adoptionTiers: [...ADOPTION_TIERS],
    counts: countByTier(capabilities),
    providerState,
    runtimeCore: runtimeCore.map(copy),
    research: research.map(copy),
    productPlans,
    promotionPolicy: {
      rule: "Research presence never grants execution authority.",
      requiredEvidence: [
        "verified repository identity and source provenance",
        "explicit license and commercial-use decision",
        "security and dependency review for the chosen version",
        "tenant and customer-data boundary",
        "provider/account authority boundary where an external service is involved",
        "bounded runtime placement with rollback and observability",
        "tests for the exact SONARA integration path",
        "human approval plus green release gates before production"
      ]
    },
    boundaries: [
      "This planner classifies and prioritizes; it does not download repositories, install packages, start workers, call providers, or mutate customer data.",
      "No research record can execute from this plan, even when its license is permissive or its product fit is strong.",
      "Hosted OpenAI and Anthropic entries describe the governed adapters already present in SONARA; provider calls still require explicit selection, server-side credentials, and the existing draft_content authority path.",
      "Unknown, missing, source-available, model-weight, dataset, copyleft, privacy-sensitive, or dual-use rights remain separately reviewable.",
      "Business Builder™, Creator Studio™, and Growth Studio™ inherit SONARA tenancy, approval, audit, cost, privacy, and release controls."
    ]
  };
}

function buildRuntimeCore(providerState) {
  return [
    {
      key: "sonara_local_rules",
      label: "SONARA deterministic local rules",
      sourceType: "internal_runtime",
      runtimeLane: "web_process",
      adoptionTier: "active_core",
      executionAuthority: "existing_runtime_only",
      licenseDisposition: "internal",
      securityDisposition: "governed_core",
      tenantBoundary: "existing SONARA tenant and authorization controls",
      providerBoundary: "no external model provider required",
      productTargets: [...PRODUCTS],
      configured: true,
      canExecuteFromPlan: false,
      humanReviewRequired: false,
      recommendedNextStep: "Keep deterministic rules as the default path and regression-test them when hosted or worker capabilities are added."
    },
    providerCapability("openai", "OpenAI / ChatGPT hosted drafting", providerState.openai),
    providerCapability("anthropic", "Anthropic Claude hosted drafting", providerState.anthropic)
  ];
}

function providerCapability(key, label, state = {}) {
  const configured = state.status === "configured" && state.enabled === true;
  return {
    key: `hosted_${key}`,
    label,
    sourceType: "installed_provider_adapter",
    runtimeLane: "external_api",
    adoptionTier: "available_with_setup",
    executionAuthority: configured ? "draft_content_only_via_agent_runner" : "setup_required",
    licenseDisposition: "external_service_contract",
    securityDisposition: "server_side_credential_fixed_official_host",
    tenantBoundary: "first shipped drafting surface accepts only founder/admin-entered text; no customer-record fetch",
    providerBoundary: `${label} is explicit-only; no silent paid-provider fallback`,
    productTargets: ["SONARA One", "Business Builder™", "Creator Studio™", "Growth Studio™"],
    configured,
    providerStatus: state.status || "unknown",
    model: state.model || null,
    host: state.host || null,
    canExecuteFromPlan: false,
    humanReviewRequired: true,
    recommendedNextStep: configured
      ? "Keep use explicit and draft-only until a product-specific data, cost, and approval review widens the path."
      : "Configure the server-side provider credential only if SONARA intends to operate this optional hosted drafting path."
  };
}

function planResearchRecord(record = {}) {
  const licenseDisposition = classifyLicense(record);
  const securityDisposition = classifySecurity(record);
  const runtimeLane = inferRuntimeLane(record);
  const adoptionTier = inferAdoptionTier(record, { licenseDisposition, securityDisposition, runtimeLane });
  const productTargets = inferProductTargets(record);
  return {
    key: `research:${String(record.repository || record.key || "unknown").toLowerCase()}`,
    label: record.label || record.repository || "Research record",
    repository: record.repository || null,
    sourceType: "governed_research_record",
    sourceRecords: Number(Array.isArray(record.sourceRecords) ? record.sourceRecords.length : 0),
    seenInBatches: [...(record.seenInBatches || [])],
    repositoryVerified: record.repositoryVerified === true,
    license: record.license || "NOASSERTION",
    licenseDisposition,
    commercialUseStatus: record.commercialUseStatus || "needs_review",
    securityDisposition,
    runtimeLane,
    adoptionTier,
    executionAuthority: "none_from_research",
    tenantBoundary: "No tenant/customer data until a product-specific integration proves least-privilege access and isolation.",
    providerBoundary: "No provider credentials, accounts, quotas, subscriptions, or external actions are granted by research metadata.",
    productTargets,
    capabilities: [...(record.capabilities || [])],
    blockedUses: [...(record.blockedUses || [])],
    enabledInProduction: record.enabledInProduction === true,
    canExecuteFromPlan: false,
    humanReviewRequired: true,
    recommendedNextStep: nextStep(record, { adoptionTier, licenseDisposition, runtimeLane, securityDisposition })
  };
}

function classifyLicense(record = {}) {
  const license = String(record.license || "NOASSERTION");
  const risk = String(record.licenseRisk || inferLicenseRisk(license));
  const commercial = String(record.commercialUseStatus || "needs_review");
  if (record.repositoryVerified !== true) return "blocked_unverified_repository";
  if (/NOASSERTION|UNKNOWN|UNVERIFIED|NONE|null/i.test(license)) return "blocked_license_review";
  if (/blocked/i.test(commercial)) return "blocked_commercial_use_review";
  if (/AGPL|GPL|MPL|EUPL|SSPL/i.test(license)) return "copyleft_or_reciprocal_isolation_review";
  if (risk === "low" && /MIT|Apache|BSD|CC0|PostgreSQL|ISC/i.test(license)) return "permissive_reviewable";
  return "needs_license_scope_review";
}

function classifySecurity(record = {}) {
  const text = [
    record.runtimeClass,
    record.integrationStatus,
    ...(record.safety || []),
    ...(record.blockedUses || []),
    ...(record.capabilities || [])
  ].join(" ").toLowerCase();
  if (/blocked|quarantin|credential.?rotation|limit.?bypass|subscription.?pool/.test(text)) return "restricted_or_blocked";
  if (/reverse.?engineer|cyber|security|tracker|surveillance|device.?activity|computer.?use/.test(text)) return "security_privacy_or_dual_use_review";
  if (/customer|email|campaign|publish|payment|billing|account|browser/.test(text)) return "customer_action_review";
  return "standard_integration_review";
}

function inferRuntimeLane(record = {}) {
  const text = [record.runtimeClass, record.integrationMode, record.integrationStatus, ...(record.capabilities || [])].join(" ").toLowerCase();
  if (/developer|cli|code.?agent|devops|testing/.test(text)) return "developer_only";
  if (/browser|canvas|webgl|three|frontend/.test(text)) return "browser_runtime";
  if (/desktop|owner.?device|local.?companion|external.?companion/.test(text)) return "owner_device";
  if (/gpu|image.?generation|video.?generation|music.?generation|model.?family|comfy/.test(text)) return "isolated_gpu_worker";
  if (/worker|python|transcri|audio|media|pipeline|orchestrat/.test(text)) return "isolated_worker";
  if (/external.?api|provider|saas|http.?adapter/.test(text)) return "external_api";
  if (/web.?process|library|server/.test(text)) return "web_process";
  return "developer_only";
}

function inferAdoptionTier(record = {}, context = {}) {
  const status = String(record.integrationStatus || "research_only").toLowerCase();
  if (
    context.licenseDisposition.startsWith("blocked_") ||
    context.securityDisposition === "restricted_or_blocked" ||
    /blocked|quarantined/.test(status)
  ) return "blocked";
  if (/active_core/.test(status) && record.enabledInProduction === true) return "active_core";
  if (/adapter_available|available_with_setup|setup_required/.test(status)) return "available_with_setup";
  if (context.runtimeLane === "owner_device") return "external_companion";
  if (context.runtimeLane === "developer_only" && /developer|tool|testing|cli/.test([record.runtimeClass, status].join(" ").toLowerCase())) return "developer_tool";
  if (["isolated_worker", "isolated_gpu_worker"].includes(context.runtimeLane) && context.licenseDisposition === "permissive_reviewable") return "isolated_worker_candidate";
  return "research_only";
}

function inferProductTargets(record = {}) {
  const text = [...(record.productFit || []), ...(record.capabilities || []), record.runtimeClass, record.label].join(" ").toLowerCase();
  const targets = [];
  if (/business|invoice|quote|booking|customer|inventory|vendor|operation|restaurant|commerce/.test(text)) targets.push("Business Builder™");
  if (/creator|media|music|audio|video|image|artist|content|canvas|transcri|3d/.test(text)) targets.push("Creator Studio™");
  if (/growth|marketing|campaign|seo|aeo|geo|lead|sales|analytics|abm|email/.test(text)) targets.push("Growth Studio™");
  if (/platform|infrastructure|security|developer|agent|model|database|api|devops|system.?design|visualization/.test(text)) targets.push("SONARA One");
  return targets.length ? [...new Set(targets)] : ["SONARA One"];
}

function nextStep(record = {}, context = {}) {
  if (context.adoptionTier === "blocked") {
    if (context.licenseDisposition === "blocked_unverified_repository") return "Verify the exact repository identity and provenance before any technical evaluation.";
    if (context.licenseDisposition === "blocked_license_review") return "Resolve source/license rights before copying, installing, vendoring, or depending on code.";
    return "Keep blocked until the formal registry/security decision changes after review.";
  }
  if (context.securityDisposition === "security_privacy_or_dual_use_review") return "Keep defensive/research-only until a narrow, consented, auditable use case passes security and privacy review.";
  if (context.adoptionTier === "developer_tool") return "Evaluate only in isolated development/test workflow; do not make it a customer runtime dependency without a separate promotion review.";
  if (context.adoptionTier === "external_companion") return "Keep on the owner device or external application boundary and integrate only through documented, least-privilege interfaces.";
  if (context.adoptionTier === "isolated_worker_candidate") return "Prototype behind a versioned worker contract, resource budget, queue, timeout, audit, and kill switch; then run license/security/performance tests.";
  return record.nextStep || "Retain as governed research until a product requirement justifies a scoped integration proposal and release evidence.";
}

function sanitizeProviderState(state = {}) {
  return Object.fromEntries(["local_rules", "openai", "anthropic"].map((key) => {
    const item = state[key] || {};
    return [key, {
      enabled: item.enabled === true,
      status: item.status || "unknown",
      provider: item.provider || key,
      label: item.label || key,
      model: item.model || null,
      host: item.host || null,
      detail: item.detail || null
    }];
  }));
}

function countByTier(items) {
  const result = Object.fromEntries(ADOPTION_TIERS.map((tier) => [tier, 0]));
  for (const item of items) result[item.adoptionTier] = Number(result[item.adoptionTier] || 0) + 1;
  result.total = items.length;
  return result;
}

function copy(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copy);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
}

module.exports = {
  PRODUCTS,
  RUNTIME_LANES,
  ADOPTION_TIERS,
  getRuntimeCapabilityPlan,
  planResearchRecord,
  classifyLicense,
  classifySecurity,
  inferRuntimeLane,
  inferAdoptionTier,
  inferProductTargets
};

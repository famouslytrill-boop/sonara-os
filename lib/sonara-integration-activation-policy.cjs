// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A deterministic release gate for external business connections.
//
// Provider credentials never enter this object. It records the owner's review
// of commercial terms, the rate-limit behavior the adapter must follow, and
// who must approve consequential operations. AI is explicitly optional: an
// integration cannot claim that the product depends on it.

const COMMERCIAL_STATUSES = Object.freeze(["approved", "not_required", "review_required", "blocked"]);
const RATE_LIMIT_MODES = Object.freeze(["provider_headers", "durable_local", "manual_only"]);
const OPERATOR_MODES = Object.freeze(["automatic_internal", "human_approval", "manual_only"]);
const AI_MODES = Object.freeze(["disabled", "optional_local", "optional_external"]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function validHttpsUrl(value) {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch {
    return false;
  }
}

function validDate(value) {
  return Number.isFinite(Date.parse(String(value || "")));
}

function evaluateIntegrationActivation(input = {}) {
  const settings = object(input.settings);
  const governance = object(settings.governance);
  const commercial = object(governance.commercial);
  const rateLimit = object(governance.rateLimit || governance.rate_limit);
  const operator = object(governance.operator);
  const ai = object(governance.ai);
  const reasons = [];

  if (!COMMERCIAL_STATUSES.includes(commercial.status)) reasons.push("commercial_status_required");
  else if (!["approved", "not_required"].includes(commercial.status)) reasons.push("commercial_use_not_approved");

  if (commercial.status === "approved") {
    if (!validHttpsUrl(commercial.termsUrl || commercial.terms_url)) reasons.push("commercial_terms_url_required");
    if (!validDate(commercial.reviewedAt || commercial.reviewed_at)) reasons.push("commercial_review_date_required");
  }

  if (!RATE_LIMIT_MODES.includes(rateLimit.mode)) reasons.push("rate_limit_mode_required");
  if (rateLimit.mode === "provider_headers" && rateLimit.honorsRetryAfter !== true && rateLimit.honors_retry_after !== true) {
    reasons.push("retry_after_handling_required");
  }
  if (rateLimit.mode === "durable_local") {
    const maximum = Number(rateLimit.maxRequests || rateLimit.max_requests);
    const windowSeconds = Number(rateLimit.windowSeconds || rateLimit.window_seconds);
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10000) reasons.push("valid_rate_limit_maximum_required");
    if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) reasons.push("valid_rate_limit_window_required");
  }

  if (!OPERATOR_MODES.includes(operator.mode)) reasons.push("operator_control_required");
  if (operator.mode === "automatic_internal" && operator.externalActionsAllowed !== false && operator.external_actions_allowed !== false) {
    reasons.push("automatic_external_actions_must_be_disabled");
  }

  const aiMode = ai.mode || "disabled";
  if (!AI_MODES.includes(aiMode)) reasons.push("valid_ai_mode_required");
  if (ai.required === true) reasons.push("ai_cannot_be_required");

  if (governance.secrets !== "server_only") reasons.push("server_only_secret_boundary_required");
  if (governance.organizationScoped !== true && governance.organization_scoped !== true) reasons.push("organization_scope_required");

  return {
    allowed: reasons.length === 0,
    code: reasons.length ? "integration_governance_required" : "integration_governance_approved",
    reasons,
    policy: {
      commercialStatus: commercial.status || "review_required",
      rateLimitMode: rateLimit.mode || null,
      operatorMode: operator.mode || null,
      aiMode,
      aiRequired: false,
      secrets: "server_only",
      organizationScoped: true
    }
  };
}

function requiresActivationReview(connectionStatus) {
  return String(connectionStatus || "").toLowerCase() === "connected";
}

module.exports = {
  AI_MODES,
  COMMERCIAL_STATUSES,
  OPERATOR_MODES,
  RATE_LIMIT_MODES,
  evaluateIntegrationActivation,
  requiresActivationReview
};

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { createFeatureFlagService } = require("./sonara-feature-flags.cjs");

const EVENT_CONSUMER_CANARY = "runtime.event-consumer-canary";
const SEARCH_CONSOLE_READ_CANARY = "growth.google-search-console-read-canary";

function truthy(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function cleanList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function createRuntimeCapabilityService({
  capabilities = {},
  environment = process.env.NODE_ENV || "development",
  entitlementChecker = async () => true
} = {}) {
  if (typeof entitlementChecker !== "function") throw new TypeError("entitlementChecker must be a function");

  const definitions = {};
  const policies = new Map();

  for (const [key, input] of Object.entries(capabilities)) {
    const policy = input && typeof input === "object" ? input : {};
    definitions[key] = policy.enabled === true;
    policies.set(key, Object.freeze({
      tenantScoped: policy.tenantScoped !== false,
      requireExplicitTenantAllowlist: policy.requireExplicitTenantAllowlist !== false,
      allowedOrganizations: Object.freeze(cleanList(policy.allowedOrganizations).filter(isUuid)),
      requiredEntitlements: Object.freeze(cleanList(policy.requiredEntitlements))
    }));
  }

  const flags = createFeatureFlagService({ definitions });

  async function evaluate(key, input = {}) {
    const flagKey = String(key || "").trim();
    const policy = policies.get(flagKey);
    if (!policy) return decision(false, flagKey, "unknown_capability");

    const organizationId = String(input.organizationId || "").trim();
    const userId = String(input.userId || "").trim();
    const role = String(input.role || "").trim();
    const targetingKey = userId || organizationId || "sonara-process";

    const flagEnabled = await flags.enabled(flagKey, {
      targetingKey,
      organizationId: organizationId || undefined,
      role: role || undefined,
      environment: String(environment || "unknown")
    });
    if (!flagEnabled) return decision(false, flagKey, "flag_disabled");

    if (policy.tenantScoped) {
      if (!isUuid(organizationId)) return decision(false, flagKey, "tenant_context_required");
      if (policy.requireExplicitTenantAllowlist && policy.allowedOrganizations.length === 0) {
        return decision(false, flagKey, "tenant_allowlist_required");
      }
      if (policy.allowedOrganizations.length > 0 && !policy.allowedOrganizations.includes(organizationId)) {
        return decision(false, flagKey, "tenant_not_enabled");
      }
    }

    for (const entitlement of policy.requiredEntitlements) {
      const allowed = await entitlementChecker({
        capability: flagKey,
        entitlement,
        organizationId: organizationId || null,
        userId: userId || null
      });
      if (allowed !== true) return decision(false, flagKey, "entitlement_required");
    }

    return decision(true, flagKey, "enabled");
  }

  return Object.freeze({
    domain: flags.domain,
    evaluate,
    async enabled(key, input = {}) {
      return (await evaluate(key, input)).allowed;
    },
    summary() {
      return Object.freeze([...policies.entries()].map(([key, policy]) => Object.freeze({
        key,
        tenantScoped: policy.tenantScoped,
        explicitlyTenantScoped: policy.allowedOrganizations.length > 0,
        requiredEntitlements: [...policy.requiredEntitlements]
      })));
    }
  });
}

function createDefaultRuntimeCapabilityService({ env = process.env, entitlementChecker } = {}) {
  const consumerEnabled = truthy(env.SONARA_EVENT_CONSUMER_ENABLED);
  const consumerOrg = String(env.SONARA_EVENT_CONSUMER_CANARY_ORG_ID || "").trim();

  return createRuntimeCapabilityService({
    environment: env.NODE_ENV || env.VERCEL_ENV || "development",
    entitlementChecker,
    capabilities: {
      [EVENT_CONSUMER_CANARY]: {
        enabled: consumerEnabled,
        tenantScoped: true,
        allowedOrganizations: isUuid(consumerOrg) ? [consumerOrg] : []
      },
      [SEARCH_CONSOLE_READ_CANARY]: {
        enabled: false,
        tenantScoped: true,
        allowedOrganizations: []
      }
    }
  });
}

function decision(allowed, capability, reason) {
  return Object.freeze({ allowed: allowed === true, capability, reason });
}

module.exports = {
  EVENT_CONSUMER_CANARY,
  SEARCH_CONSOLE_READ_CANARY,
  createRuntimeCapabilityService,
  createDefaultRuntimeCapabilityService
};

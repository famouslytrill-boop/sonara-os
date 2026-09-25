"use strict";

const assert = require("node:assert/strict");
const {
  EVENT_CONSUMER_CANARY,
  SEARCH_CONSOLE_READ_CANARY,
  createRuntimeCapabilityService,
  createDefaultRuntimeCapabilityService
} = require("../lib/sonara-runtime-capabilities.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("runtime capability control plane", () => {
  it("requires both the OpenFeature flag and an explicit tenant allowlist", async () => {
    const service = createRuntimeCapabilityService({
      capabilities: {
        "runtime.canary": { enabled: true, tenantScoped: true, allowedOrganizations: [ORG] }
      }
    });

    assert.equal(await service.enabled("runtime.canary", { organizationId: ORG }), true);
    assert.equal((await service.evaluate("runtime.canary", { organizationId: OTHER })).reason, "tenant_not_enabled");
    assert.equal((await service.evaluate("runtime.canary", {})).reason, "tenant_context_required");
  });

  it("fails closed when a tenant-scoped flag has no allowlist", async () => {
    const service = createRuntimeCapabilityService({
      capabilities: { "runtime.closed": { enabled: true, tenantScoped: true } }
    });
    const result = await service.evaluate("runtime.closed", { organizationId: ORG });
    assert.deepEqual(result, { allowed: false, capability: "runtime.closed", reason: "tenant_allowlist_required" });
  });

  it("keeps billing/entitlement authority outside the feature flag provider", async () => {
    const checks = [];
    const service = createRuntimeCapabilityService({
      entitlementChecker: async (input) => {
        checks.push(input);
        return input.entitlement === "growth_studio";
      },
      capabilities: {
        "growth.safe": {
          enabled: true,
          tenantScoped: true,
          allowedOrganizations: [ORG],
          requiredEntitlements: ["growth_studio", "connector_access"]
        }
      }
    });

    const result = await service.evaluate("growth.safe", { organizationId: ORG, userId: "user-1" });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "entitlement_required");
    assert.equal(checks.length, 2);
  });

  it("maps the existing event-consumer canary environment into OpenFeature without inventing a second switch", async () => {
    const service = createDefaultRuntimeCapabilityService({
      env: {
        NODE_ENV: "test",
        SONARA_EVENT_CONSUMER_ENABLED: "true",
        SONARA_EVENT_CONSUMER_CANARY_ORG_ID: ORG
      }
    });
    assert.equal(await service.enabled(EVENT_CONSUMER_CANARY, { organizationId: ORG }), true);
    assert.equal(await service.enabled(EVENT_CONSUMER_CANARY, { organizationId: OTHER }), false);
    assert.equal(await service.enabled(SEARCH_CONSOLE_READ_CANARY, { organizationId: ORG }), false);
  });

  it("does not expose tenant identifiers in the public summary", () => {
    const service = createDefaultRuntimeCapabilityService({
      env: {
        NODE_ENV: "test",
        SONARA_EVENT_CONSUMER_ENABLED: "true",
        SONARA_EVENT_CONSUMER_CANARY_ORG_ID: ORG
      }
    });
    const encoded = JSON.stringify(service.summary());
    assert.equal(encoded.includes(ORG), false);
    assert.equal(encoded.includes("explicitlyTenantScoped"), true);
  });
});

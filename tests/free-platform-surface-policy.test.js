// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CATALOG, surfacePolicy, freeSurfaceSummary } = require("../lib/sonara-free-platform-surface-policy.cjs");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const U = "33333333-3333-4333-8333-333333333333";
describe("free login-based SONARA platform surface policy", () => {
  it("covers the parent and all 3 studios across social, marketplace and storefront", () => {
    assert.equal(CATALOG.length, 12);
    assert.equal(new Set(CATALOG.map((x) => x.key)).size, 12);
    for (const item of CATALOG) {
      assert.equal(item.access, "free_with_authenticated_writes");
      assert.equal(item.platformSubscriptionRequired, false);
      assert.equal(item.platformListingFeeCents, 0);
      assert.equal(item.platformPostingFeeCents, 0);
      assert.equal(item.launchState, "policy_only", "catalog policy is not proof of shipped product");
    }
  });
  it("allows browsing without login but not posting without identity", () => {
    assert.equal(surfacePolicy({ product: "sonara_industries", service: "social", action: "browse" }).ok, true);
    assert.equal(surfacePolicy({ product: "growth_studio", service: "social", action: "publish" }).code, "login_required");
  });
  it("denies unauthorized or foreign-tenant posts regardless of paid plan", () => {
    const x = { product: "growth_studio", service: "social", action: "create",
      userId: U, organizationId: A, serverOrganizationId: B,
      actorHasPermission: true, paidEntitlement: true };
    assert.equal(surfacePolicy(x).code, "tenant_scope_unverified");
    assert.equal(surfacePolicy({ ...x, serverOrganizationId: A, actorHasPermission: false }).code,
      "surface_permission_required");
  });
  it("requires moderation before publishing or commenting", () => {
    const x = { product: "creator_studio", service: "marketplace", action: "publish",
      userId: U, organizationId: A, serverOrganizationId: A, actorHasPermission: true };
    assert.equal(surfacePolicy(x).code, "moderation_check_required");
    const approved = surfacePolicy({ ...x, moderationApproved: true });
    assert.equal(approved.ok, true);
    assert.equal(approved.subscriptionRequired, false);
    assert.equal(approved.checkoutAuthorized, false);
    assert.equal(approved.sideEffectExecuted, false);
    assert.equal(surfacePolicy({ ...x, action: "comment", moderationApproved: false }).ok, false);
  });
  it("refuses malformed user UUIDs, tenant UUIDs and scope spoofing on every free write", () => {
    const base = { product: "sonara_industries", service: "social", action: "create",
      userId: U, organizationId: A, serverOrganizationId: A,
      actorHasPermission: true, paidEntitlement: false };
    assert.equal(surfacePolicy(base).ok, true);
    for (const userId of ["x".repeat(36), "1".repeat(36), "11111111--111-4111-8111-111111111111", null]) {
      assert.equal(surfacePolicy({ ...base, userId }).code, "login_required");
    }
    for (const organizationId of ["x".repeat(36), "1".repeat(36), "11111111--111-4111-8111-111111111111", null]) {
      assert.equal(surfacePolicy({ ...base, organizationId, serverOrganizationId: organizationId }).code,
        "tenant_scope_unverified");
    }
    assert.equal(surfacePolicy({ ...base, organizationId: B }).code, "tenant_scope_unverified");
    assert.equal(surfacePolicy({ ...base, actorHasPermission: "true" }).code, "surface_permission_required");
    assert.equal(surfacePolicy({ ...base, action: "publish", moderationApproved: "true" }).code,
      "moderation_check_required");
  });
  it("uses the shared policy in Growth Studio's real authenticated channel screen", () => {
    const code = fs.readFileSync(path.join(__dirname, "..", "routes",
      "sonara-growth-channel-routes.cjs"), "utf8");
    assert.ok(code.includes('require("../lib/sonara-free-platform-surface-policy.cjs")'));
    assert.ok(code.includes('channelSurface.platformSubscriptionRequired === false'));
    assert.ok(code.includes('channelSurface.platformPostingFeeCents === 0'));
    assert.ok(code.includes('const guard = requireWorkspaceAccess("growth_studio")'));
    assert.ok(code.includes("Your channel is free"));
    assert.ok(!code.includes("requirePaidOrOwnerAccess"));
  });
  it("does not make seller charges into SONARA membership charges", () => {
    const summary = freeSurfaceSummary();
    assert.equal(summary.platformSubscriptionRequired, false);
    assert.equal(summary.platformFeesCharged, false);
    assert.match(summary.commerceTerms, /payment processor may charge fees/);
    assert.equal(surfacePolicy({ product: "business_builder", service: "storefront", action: "unknown" }).code,
      "unsupported_surface_action");
  });
});

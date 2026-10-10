// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Binds package readiness to one authenticated server session, real membership,
// and the canonical paid-access reader. This is NOT a route or execution gate.
const { createIndustryPackagePreflight } = require("./sonara-industry-package-preflight.cjs");

const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/;
const SOURCES = new Set(["organization_memberships", "business_memberships"]);
const BILLING_SOURCES = new Set(["billing_subscriptions", "billing_entitlements"]);
const validId = (value) => typeof value === "string" && ID.test(value);

function createIndustrySessionPreflight({ authenticatedUser, getCustomerPrimaryOrganization,
  getCustomerPaidEntitlement, readCapabilityEvidence } = {}) {
  const user = authenticatedUser;
  // Caller must bind an already authenticated user from session middleware.
  if (!validId(user?.id)) throw new TypeError("A verified session user is required");
  if (typeof getCustomerPrimaryOrganization !== "function" ||
    typeof getCustomerPaidEntitlement !== "function" ||
    typeof readCapabilityEvidence !== "function") {
    throw new TypeError("Canonical membership, billing and evidence readers are required");
  }

  return async function forPackage(packageKey) {
    // Per-invocation scope: concurrent requests never share mutable auth state.
    let confirmedOrganization = null;
    const readers = {
      async resolveMemberOrganization({ userId }) {
        if (userId !== user.id) return { ok: false };
        const result = await getCustomerPrimaryOrganization(user, { autoBootstrap: false });
        if (!result?.ok || !validId(result.organizationId) || !SOURCES.has(result.source)) return { ok: false };
        confirmedOrganization = result.organizationId;
        return { ok: true, userId: user.id, organizationId: result.organizationId, status: "active" };
      },
      async readProductEntitlement({ organizationId, product }) {
        if (!confirmedOrganization || organizationId !== confirmedOrganization) return { ok: false };
        // This third argument is supported by SONARA's canonical paid reader.
        // A readiness check MUST NOT auto-bootstrap the organization.
        const paid = await getCustomerPaidEntitlement(user, product, { autoBootstrap: false });
        if (paid?.code === "entitlement_unreadable") throw new Error("entitlement_unavailable");
        if (!paid?.ok || paid.organizationId !== organizationId || !BILLING_SOURCES.has(paid.source)) return { ok: false };
        return { ok: true, organizationId, product, status: "active", active: true };
      },
      async readCapabilityEvidence({ organizationId, product, requiredFields }) {
        if (!confirmedOrganization || organizationId !== confirmedOrganization) return { ok: false };
        // An unconfigured adapter must fail, never manufacture a green result.
        return readCapabilityEvidence({ organizationId, product, requiredFields });
      }
    };
    return createIndustryPackagePreflight(readers)({ authenticatedUserId: user.id, packageKey });
  };
}

module.exports = { createIndustrySessionPreflight };

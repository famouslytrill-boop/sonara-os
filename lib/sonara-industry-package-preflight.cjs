// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Server-only, read-only application boundary for cross-suite industry packs.
// Untrusted request JSON is never a source of tenant, entitlements or evidence.
// This does not authorize execution, publishing, charges, booking or delivery.
const { PACKAGES, createIndustryPackagePreview } = require("./sonara-industry-package-blueprints.cjs");

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/;
const HEX256 = /^[0-9a-fA-F]{64}$/;
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const validId = (v) => typeof v === "string" && SAFE_ID.test(v);
const owns = (v, k) => Object.prototype.hasOwnProperty.call(v, k);

function failure(code) {
  return { ok: false, code, canExecute: false, canActivate: false };
}

function createIndustryPackagePreflight(dependencies = {}) {
  const { resolveMemberOrganization, readProductEntitlement, readCapabilityEvidence } = dependencies;
  for (const fn of [resolveMemberOrganization, readProductEntitlement, readCapabilityEvidence]) {
    if (typeof fn !== "function") throw new TypeError("industry preflight requires server-side membership, entitlement and evidence readers");
  }

  // authenticatedUserId MUST come from server session middleware, never req.body.
  return async function preflight({ authenticatedUserId, packageKey } = {}) {
    if (!owns(PACKAGES, packageKey)) return failure("unknown_industry_package");
    if (!validId(authenticatedUserId)) return failure("authenticated_user_required");
    const pack = PACKAGES[packageKey];

    let membership;
    try { membership = await resolveMemberOrganization({ userId: authenticatedUserId }); }
    catch { return failure("membership_unavailable"); }
    if (!isPlain(membership) || membership.ok !== true ||
      membership.userId !== authenticatedUserId || !validId(membership.organizationId) ||
      membership.status !== "active") return failure("membership_not_verified");
    const organizationId = membership.organizationId;

    let entitlement;
    try { entitlement = await readProductEntitlement({ organizationId, product: pack.product }); }
    catch { return failure("entitlement_unavailable"); }
    if (!isPlain(entitlement) || entitlement.ok !== true || entitlement.organizationId !== organizationId ||
      entitlement.product !== pack.product || entitlement.status !== "active" ||
      entitlement.active !== true) return failure("entitlement_not_verified");

    const requirements = [...new Set(Object.values(pack.capabilities).flat())];
    let result;
    try { result = await readCapabilityEvidence({ organizationId, product: pack.product, requiredFields: [...requirements] }); }
    catch { return failure("evidence_unavailable"); }
    if (!isPlain(result) || result.ok !== true || result.organizationId !== organizationId ||
      result.product !== pack.product || !isPlain(result.fields)) return failure("evidence_not_verified");
    // Per-field rows must be explicitly tenant-scoped; failed/missing reads are
    // not zeros and an empty response is never proof that the pack is ready.
    const evidence = {};
    const unreadable = [];
    for (const field of requirements) {
      const row = owns(result.fields, field) ? result.fields[field] : null;
      if (!isPlain(row) || row.organizationId !== organizationId || row.status !== "verified" ||
        (field === "sourceSha256" ? !HEX256.test(row.value || "") : !validId(row.value))) {
        unreadable.push(field);
        continue;
      }
      evidence[field] = row.value;
    }

    const preview = createIndustryPackagePreview(packageKey, {
      identity: { organizationId, actorOrganizationId: organizationId, entitledProducts: [pack.product] },
      evidence
    });
    if (!preview.ok) return failure("package_plan_unavailable");
    // No raw source values, customer identifiers, credentials, or provider receipts
    // are returned. This only describes setup visibility, never execution authority.
    return {
      ok: true,
      packageKey,
      product: pack.product,
      organizationScoped: true,
      launchState: "template_only",
      capabilities: preview.capabilities.map((capability) => ({
        name: capability.name,
        missing: capability.missing,
        status: capability.missing.length ? "needs_verified_evidence" : "requires_owner_and_runtime_review"
      })),
      unreadableEvidence: [...unreadable],
      requiresOwnerReview: true,
      providerExecutionEnabled: false,
      canExecute: false,
      canActivate: false,
      canPublish: false,
      canDeliverPaidAssets: false
    };
  };
}

module.exports = { createIndustryPackagePreflight };

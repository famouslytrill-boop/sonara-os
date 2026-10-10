// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Customer policy for SONARA-owned social, creator marketplace and storefront
// features. Using the surface is free; an optional sale of a real product is
// not the same thing as a platform fee. This file grants NO authority and
// cannot replace session auth, tenant RLS, product moderation or checkout.
const PRODUCTS = Object.freeze(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
const SERVICES = Object.freeze(["social", "marketplace", "storefront"]);
const VERIFIED_ACTIONS = Object.freeze(["create", "edit", "publish", "follow", "comment", "report", "moderate", "manage"]);
const PUBLIC_ACTIONS = Object.freeze(["browse", "search"]);
// Exact PostgreSQL UUID-shaped user and tenant identifiers, not any 36-character
// value containing hexadecimal digits and dashes. This is input hygiene only;
// server session verification and RLS still establish real authorization.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATALOG = Object.freeze(PRODUCTS.flatMap((product) =>
  SERVICES.map((service) => Object.freeze({
    key: product + "." + service,
    product, service,
    access: "free_with_authenticated_writes",
    platformSubscriptionRequired: false,
    platformListingFeeCents: 0,
    platformPostingFeeCents: 0,
    // A third-party payment processor or an item seller may charge money.
    // Creating and managing a free shop must not trigger a paid-plan gate.
    externalCommerceOptional: service !== "social",
    ownerControlsPerOrganization: true,
    moderationRequiredForPublicWrites: true,
    launchState: "policy_only"
  }))
));

function surfacePolicy({ product, service, action, userId, organizationId, serverOrganizationId,
  actorHasPermission = false, actorCanModerate = false, actorCanManage = false,
  moderationApproved = false, rightsCleared = false,
  termsAcceptanceVerified = false, paidEntitlement = false } = {}) {
  const item = CATALOG.find((entry) => entry.product === product && entry.service === service);
  if (!item) return Object.freeze({ ok: false, code: "unknown_free_surface", subscriptionRequired: false });
  if (!PUBLIC_ACTIONS.includes(action) && !VERIFIED_ACTIONS.includes(action)) {
    return Object.freeze({ ok: false, code: "unsupported_surface_action", subscriptionRequired: false });
  }
  if (PUBLIC_ACTIONS.includes(action)) return Object.freeze({
    ok: true, code: "public_read_allowed", subscriptionRequired: false, sideEffectExecuted: false,
    feeCents: 0, checkoutAuthorized: false
  });
  if (typeof userId !== "string" || !UUID.test(userId)) {
    return Object.freeze({ ok: false, code: "login_required", subscriptionRequired: false });
  }
  // Never use user-edited profile metadata or a tenant ID from a request as
  // evidence of tenant ownership. Permission is computed by route/middleware.
  if (typeof organizationId !== "string" || !UUID.test(organizationId) || organizationId !== serverOrganizationId) {
    return Object.freeze({ ok: false, code: "tenant_scope_unverified", subscriptionRequired: false });
  }
  if (actorHasPermission !== true) return Object.freeze({
    ok: false, code: "surface_permission_required", subscriptionRequired: false
  });
  // Moderation is a privileged action, not an ordinary signed-in posting right.
  // The route must independently derive this grant from trusted server roles.
  if (action === "moderate" && actorCanModerate !== true) {
    return Object.freeze({ ok: false, code: "moderator_permission_required", subscriptionRequired: false });
  }
  // Posting permission is NOT authority over an organization's settings,
  // ownership, connected sellers, billing or member access.
  if (action === "manage" && actorCanManage !== true) {
    return Object.freeze({ ok: false, code: "business_manager_permission_required", subscriptionRequired: false });
  }
  // UGC publication and comments need a server-verified affirmative acceptance
  // of the *current* terms/version. A prechecked client box or string value
  // does not satisfy this decision; the caller must consult a durable receipt.
  if (["publish", "comment"].includes(action) && termsAcceptanceVerified !== true) {
    return Object.freeze({ ok: false, code: "ugc_terms_acceptance_required", subscriptionRequired: false });
  }
  if (["publish", "comment"].includes(action) && moderationApproved !== true) {
    return Object.freeze({ ok: false, code: "moderation_check_required", subscriptionRequired: false });
  }
  // Listing another person's copyrighted work is not made lawful by a
  // moderation pass or a free-membership policy. A server-side licence/rights
  // reviewer must establish the grant at the exact listing version.
  if (service === "marketplace" && action === "publish" && rightsCleared !== true) {
    return Object.freeze({ ok: false, code: "marketplace_rights_review_required", subscriptionRequired: false });
  }
  return Object.freeze({
    ok: true, code: "free_surface_candidate", subscriptionRequired: false,
    paidEntitlementIgnored: paidEntitlement === true,
    sideEffectExecuted: false, checkoutAuthorized: false, externalProviderConnected: false,
    feeCents: 0
  });
}

function freeSurfaceSummary() {
  return Object.freeze({
    accessPolicy: "Free to use after login for account actions; public browsing remains possible.",
    products: PRODUCTS.slice(), services: SERVICES.slice(),
    catalogue: CATALOG.slice(),
    platformSubscriptionRequired: false,
    platformFeesCharged: false,
    commerceTerms: "A seller may charge for an item and a payment processor may charge fees. These are not fees to use SONARA's storefront or marketplace.",
    currentRuntimeClaim: "policy_only"
  });
}

module.exports = { PRODUCTS, SERVICES, CATALOG, surfacePolicy, freeSurfaceSummary };

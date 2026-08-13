"use strict";

// Does this customer hold a plan that opens this product?
//
// Lifted out of server.js, which the split ratchet in tests/server-split.test.js
// exists to shrink. It moved rather than being copied: there is exactly one
// answer to this question and two would drift.
//
// The four strings scripts/verify-production-product-catalog.mjs greps the
// deployed runtime for came with it -- the two PostgREST paths, the
// active-or-trialing filter, and the locked message. The gate reads server.js
// plus lib/ and routes/, so they are still in scope, and
// tests/product-catalog-production-boundary.test.js resolves every marker
// against all three because an earlier move of this same code broke a
// production deploy while the whole suite stayed green.
//
// Injected rather than imported, because everything it needs -- the
// organization lookup, the Supabase config and the request headers -- is
// server.js's, and reaching back into server.js from lib/ is the cycle this
// codebase avoids everywhere else.
function createPaidEntitlementReader(deps) {
  const { getCustomerPrimaryOrganization, getSupabaseServerConfig, supabaseHeaders, getPaidEntitlementKeys } = deps;
  const { billingRowOpensProduct } = require("./sonara-paid-access.cjs");

  return async function getCustomerPaidEntitlement(user, productKey) {
    const organization = await getCustomerPrimaryOrganization(user);
    if (!organization.ok) return { ok: false, status: 402, code: "upgrade_required", reason: organization.code };

    const config = getSupabaseServerConfig();
    const allowedKeys = getPaidEntitlementKeys(productKey);
    if (!allowedKeys.length) {
      return {
        ok: false,
        status: 402,
        code: "upgrade_required",
        reason: "product_entitlement_unmapped",
        message: "Paid access is not configured for this product."
      };
    }
    const entitlementFilter = allowedKeys.map((key) => encodeURIComponent(key)).join(",");
    const entitlementResponse = await fetch(`${config.url}/rest/v1/billing_entitlements?select=entitlement_key,status,metadata&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=eq.active&entitlement_key=in.(${entitlementFilter})&limit=1`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (entitlementResponse?.ok) {
      const rows = await entitlementResponse.json().catch(() => []);
      const match = rows[0];
      if (match?.entitlement_key && match.status === "active") {
        // Matching the key is not the whole test any more. workspace_monthly
        // buys one workspace, so a row carrying it opens this product only if
        // this is the workspace the customer chose -- otherwise $19 would buy
        // all three, which is what $39 is for.
        const opens = billingRowOpensProduct(match, productKey);
        if (!opens.ok) return { ok: false, status: 402, code: "upgrade_required", reason: opens.code, message: opens.message };
        return { ok: true, organizationId: organization.organizationId, source: "billing_entitlements", entitlementKey: match.entitlement_key };
      }
    }

    const subscriptionResponse = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,metadata&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=in.(active,trialing)&plan_slug=in.(${entitlementFilter})&limit=1`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (subscriptionResponse?.ok) {
      const rows = await subscriptionResponse.json().catch(() => []);
      const match = rows[0];
      if (match?.plan_slug && ["active", "trialing"].includes(match.status)) {
        const opens = billingRowOpensProduct(match, productKey);
        if (!opens.ok) return { ok: false, status: 402, code: "upgrade_required", reason: opens.code, message: opens.message };
        return { ok: true, organizationId: organization.organizationId, source: "billing_subscriptions", entitlementKey: match.plan_slug };
      }
    }

    return {
      ok: false,
      status: 402,
      code: "upgrade_required",
      reason: "billing_state_missing",
      message: "Paid access is locked until payment updates show an active or trialing plan, or an active one-time purchase."
    };
  };
}

module.exports = { createPaidEntitlementReader };

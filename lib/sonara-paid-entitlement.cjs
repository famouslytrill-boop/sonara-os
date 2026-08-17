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

  // A billing read that did not answer, kept apart from a billing read that
  // answered with nothing. Both used to end at the same 402 and the same
  // sentence, so a customer who had paid was told, during an outage, that they
  // had not -- on a page headed "Upgrade required", beside a link to pricing.
  //
  // Returns the rows, or null for a read that failed. Never []. A 200 carrying
  // something that is not an array counts as failed too: that is a real
  // PostgREST error shape, and `rows[0]` on an object is undefined, which read
  // as "no entitlement".
  async function readBilling(url, config) {
    const response = await fetch(url, { headers: supabaseHeaders(config) }).catch(() => undefined);
    if (!response?.ok) return null;
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows : null;
  }

  // 503 rather than 402: nothing here establishes that the customer owes money.
  // The message says whose fault it is, because the first thought of somebody
  // shown a paywall they already paid past is that they have been charged
  // wrongly.
  const unreadable = (reason) => ({
    ok: false,
    status: 503,
    code: "entitlement_unreadable",
    reason,
    // `heading` exists so the page can stop saying "Upgrade required" over a
    // question nobody answered. server.js reads it as the page title and, when
    // it is present, drops the pricing link -- there is nothing to buy here.
    // Results that genuinely mean "upgrade" carry no heading and are unchanged.
    heading: "We could not check your plan",
    message: "We could not read your plan just now. This is on our side, and nothing about your subscription has changed. Try again shortly."
  });

  // Which organization failures are the customer's situation, and which are
  // ours. workspace_not_ready and customer_auth_required are theirs.
  const ORGANIZATION_READ_FAILURES = new Set(["workspace_unreadable", "workspace_unavailable"]);

  return async function getCustomerPaidEntitlement(user, productKey) {
    const organization = await getCustomerPrimaryOrganization(user);
    if (!organization.ok) {
      if (ORGANIZATION_READ_FAILURES.has(organization.code)) return unreadable(organization.code);
      return { ok: false, status: 402, code: "upgrade_required", reason: organization.code };
    }

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
    const entitlementRows = await readBilling(`${config.url}/rest/v1/billing_entitlements?select=entitlement_key,status,metadata&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=eq.active&entitlement_key=in.(${entitlementFilter})&limit=1`, config);
    {
      const match = entitlementRows?.[0];
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

    const subscriptionRows = await readBilling(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,metadata&organization_id=eq.${encodeURIComponent(organization.organizationId)}&status=in.(active,trialing)&plan_slug=in.(${entitlementFilter})&limit=1`, config);
    {
      const match = subscriptionRows?.[0];
      if (match?.plan_slug && ["active", "trialing"].includes(match.status)) {
        const opens = billingRowOpensProduct(match, productKey);
        if (!opens.ok) return { ok: false, status: 402, code: "upgrade_required", reason: opens.code, message: opens.message };
        return { ok: true, organizationId: organization.organizationId, source: "billing_subscriptions", entitlementKey: match.plan_slug };
      }
    }

    // Both reads had to answer before "this customer has not paid" is something
    // anyone may put on a page. An entitlement can live in either table, so one
    // silent read is enough to make the conclusion unfounded.
    if (entitlementRows === null || subscriptionRows === null) return unreadable("billing_state_unreadable");

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

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Read-only diagnosis, never a billing mutation. Stripe Event.created cannot
// order two conflicting Events created in the same second. Instead, inspect
// today's authoritative subscription state while pinning its tenant and price
// to a previously recorded subscription and SONARA's canonical catalog.
//
// No route or background worker invokes this module. Operators opt into the
// separate CLI; its outputs are recommendations for reviewed reconciliation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const WORKSPACES = new Set(["business_builder", "creator_studio", "growth_studio"]);

const blocked = (code) => ({ ok: false, code, readOnly: true });
const inspected = (code, detail) => Object.freeze({
  ok: true, code, readOnly: true, action: code === "consistent" ? "none" : "human_review",
  ...detail
});

function normalizeWorkspace(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return WORKSPACES.has(normalized) ? normalized : "";
}

function createStripeReconciliationInspector({ fetch: transport, getEnv, getSupabaseServerConfig, supabaseHeaders, plans }) {
  if (typeof transport !== "function" || typeof getEnv !== "function" ||
      typeof getSupabaseServerConfig !== "function" || typeof supabaseHeaders !== "function" ||
      !plans || typeof plans !== "object") {
    throw new TypeError("Stripe reconciliation requires explicit read-only dependencies");
  }

  async function jsonGet(url, headers) {
    // Explicit GET, no request body, and no cross-host redirect carrying
    // service credentials or provider authorization.
    const response = await transport(url, { method: "GET", redirect: "error", headers }).catch(() => null);
    if (!response?.ok) return null;
    return response.json().catch(() => null);
  }

  async function inspect({ organizationId, subscriptionId, allowLiveReadonly = false } = {}) {
    if (!UUID.test(String(organizationId || "")) || !SUBSCRIPTION_ID.test(String(subscriptionId || ""))) {
      return blocked("invalid_inspection_scope");
    }
    // Requiring opt-in BEFORE the first database or Stripe read prevents an
    // accidentally configured live key from probing any customer account.
    const secret = String(getEnv("STRIPE_SECRET_KEY") || "").trim();
    const testKey = /^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(secret);
    const liveKey = /^(?:sk|rk)_live_[A-Za-z0-9_]+$/.test(secret);
    if (!testKey && !(liveKey && allowLiveReadonly === true)) {
      return blocked(liveKey ? "live_inspection_requires_explicit_opt_in" : "stripe_readonly_key_unavailable");
    }
    const config = getSupabaseServerConfig();
    if (!config?.ok) return blocked("database_unavailable");
    let origin;
    try {
      const u = new URL(config.url);
      if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash) {
        return blocked("database_origin_untrusted");
      }
      origin = u.origin;
    } catch {
      return blocked("database_origin_untrusted");
    }

    // Never accept tenant or price identity from Stripe metadata alone. The
    // subscription record must already exist in exactly this organization.
    const databaseUrl = `${origin}/rest/v1/billing_subscriptions?select=organization_id,provider_subscription_ref,provider_customer_ref,plan_slug,status,metadata,provider_event_at&organization_id=eq.${encodeURIComponent(organizationId)}&provider=eq.stripe&provider_subscription_ref=eq.${encodeURIComponent(subscriptionId)}&limit=2`;
    const rows = await jsonGet(databaseUrl, supabaseHeaders(config));
    if (!Array.isArray(rows)) return blocked("subscription_record_unreadable");
    if (rows.length !== 1) return blocked("subscription_record_missing_or_ambiguous");
    const saved = rows[0];
    if (!saved || saved.organization_id !== organizationId ||
        saved.provider_subscription_ref !== subscriptionId || !CUSTOMER_ID.test(String(saved.provider_customer_ref || ""))) {
      return blocked("subscription_identity_mismatch");
    }
    const plan = plans[saved.plan_slug];
    if (!plan || plan.mode !== "subscription" || !plan.env || plan.retired || plan.quoted) {
      return blocked("subscription_plan_unrecognized");
    }
    const expectedPrice = String(getEnv(plan.env) || "").trim();
    if (!PRICE_ID.test(expectedPrice)) return blocked("configured_price_unavailable");

    const stripe = await jsonGet(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json"
    });
    if (!stripe || typeof stripe !== "object" || stripe.object !== "subscription" ||
        stripe.id !== subscriptionId || stripe.customer !== saved.provider_customer_ref) {
      return blocked("stripe_subscription_identity_unverified");
    }

    // One SONARA checkout line item at quantity one, using the exact
    // configured Stripe Price. Do not assume subscription.metadata.plan
    // is authoritative; it is user-controlled during checkout.
    const items = stripe.items?.data;
    if (!Array.isArray(items) || items.length !== 1 || stripe.items?.has_more === true) {
      return blocked("stripe_subscription_items_ambiguous");
    }
    const price = items[0]?.price;
    const priceId = typeof price === "string" ? price : price?.id;
    if (priceId !== expectedPrice || (items[0].quantity ?? 1) !== 1) {
      return blocked("stripe_subscription_price_mismatch");
    }
    const stripeOrg = String(stripe.metadata?.organization_id || "").trim();
    const stripePlan = String(stripe.metadata?.plan || "").trim();
    const savedWorkspace = normalizeWorkspace(saved.metadata?.workspace || saved.metadata?.workspace_key);
    const stripeWorkspace = normalizeWorkspace(stripe.metadata?.workspace || stripe.metadata?.workspace_key);
    if ((stripeOrg && stripeOrg !== organizationId) ||
        (stripePlan && stripePlan !== saved.plan_slug) ||
        (stripeWorkspace && stripeWorkspace !== savedWorkspace)) {
      return blocked("stripe_subscription_metadata_conflict");
    }
    if (String(saved.plan_slug).startsWith("workspace_") && !savedWorkspace) {
      return blocked("single_workspace_choice_missing");
    }
    if (typeof stripe.status !== "string" || !stripe.status.trim() ||
        typeof saved.status !== "string" || !saved.status.trim()) {
      return blocked("subscription_status_unreadable");
    }

    // A non-write recommendation: no event stamp is synthesized, no table is
    // patched, and no access is restored by inspecting the provider.
    const conflicted = saved.status === "reconciliation_required" ||
      saved.metadata?.same_second_conflict === true;
    const mismatch = saved.status !== stripe.status;
    const code = conflicted ? "reconciliation_required" :
      mismatch && stripe.status === "canceled" ? "revocation_review_priority" :
      mismatch ? "subscription_status_differs" : "consistent";
    return inspected(code, {
      organizationId, subscriptionId, planSlug: saved.plan_slug,
      workspace: savedWorkspace || null, recordedStatus: saved.status,
      providerStatus: stripe.status,
      providerEventAt: saved.provider_event_at || null
    });
  }
  return Object.freeze({ inspect });
}

module.exports = { createStripeReconciliationInspector };

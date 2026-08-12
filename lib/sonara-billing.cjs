"use strict";

// Everything that knows about Stripe and about billing records.
//
// The cut is at the HTTP seam, not around "billing" as a topic.
// `handleCheckoutSessionRequest` and `handleStripeWebhook` stayed in server.js:
// they are Express handlers, and between them they need nine more dependencies
// that exist only to turn a result into a response -- acceptsHtml, wantsJson,
// responsePage, sendSetupRequired, resolveCustomerSession,
// getCustomerPrimaryOrganization and the readiness statuses. Moving them too
// would have made this an eighteen-argument factory, which is a wiring surface
// to get wrong on the payment path rather than a reduction in coupling.
//
// `getCustomerPaidEntitlement` also stayed, and had no choice:
// apply-customer-ready-production-experience.cjs uses its declaration line as
// the end boundary of a replaceBetween. Delete the line and that generator
// fails.
//
// Nothing here changes behaviour. The one substitution is `getEnv(...)` in
// place of a direct `process.env` read in getCheckoutRedirectUrls, which is
// equivalent because the value goes to getSafeAbsoluteUrl and its isSafePublicUrl
// check rejects "" and undefined identically.

const crypto = require("node:crypto");
const { brandCard, displayStatus, escapeHtml } = require("./sonara-shell.cjs");
const paidAccess = require("./sonara-paid-access.cjs");

const REQUIRED = [
  "STRIPE_PLANS",
  "getEnv",
  "getPublicAppUrl",
  "getSafeAbsoluteUrl",
  "getSupabaseServerConfig",
  "supabaseHeaders",
  "safeCountTable",
  "formatMetric",
  "insertActivityEvent"
];

function createBilling(deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`createBilling requires ${name}`);
  }
  const {
    STRIPE_PLANS,
    getEnv,
    getPublicAppUrl,
    getSafeAbsoluteUrl,
    getSupabaseServerConfig,
    supabaseHeaders,
    safeCountTable,
    formatMetric,
    insertActivityEvent
  } = deps;

  function isValidPlan(plan) {
    return Object.prototype.hasOwnProperty.call(STRIPE_PLANS, plan);
  }

  // A real plan that cannot be bought through checkout. Kept separate from
  // isValidPlan because the key is still a valid entitlement -- somebody granted
  // the setup package has it -- it just is not for sale self-serve.
  function isQuotedPlan(plan) {
    return Boolean(STRIPE_PLANS[plan]?.quoted);
  }

  function normalizeCheckoutPlan(body) {
    const requested = String(body.plan || body.priceKey || body.price_key || body.product || body.product_key || "").trim();
    const aliases = {
      business_builder_monthly: "starter_monthly",
      business_builder_starter_monthly: "starter_monthly",
      creator_studio_monthly: "core_monthly",
      growth_studio_monthly: "pro_monthly",
      business_builder_onetime: "business_builder_one_time",
      business_builder_setup: "business_builder_one_time"
    };
    return aliases[requested] || requested;
  }

  // Reads the shared map in lib/sonara-paid-access.cjs. It used to be declared
  // here, where the product catalog could not see it, so the catalog decided
  // paid access was unverified for everything. One list, both readers.
  function getPaidEntitlementKeys(productKey) {
    return paidAccess.getPaidEntitlementKeys(productKey);
  }

  function getPriceCardSetupText(planStatus, readiness) {
    if (readiness.services.stripe !== "configured") return "Not open for checkout yet: our payment connection is still being set up.";
    if (planStatus.reason === "missing") return "Checkout is not configured for this plan yet.";
    if (planStatus.reason === "invalid_placeholder") return "Not open for checkout yet: this price is still a placeholder.";
    if (planStatus.reason === "invalid_prefix") return "Not open for checkout yet: this price is not set correctly.";
    return "Not open for checkout yet.";
  }

  function priceCard(plan, config, planStatus, readiness) {
    if (plan === "free") return brandCard(`${config.name} - ${config.price}`, `${config.description} No checkout required.`);
    // Quoted work has no self-serve price, so it gets a way to ask rather than
    // a button that charges an amount the page never showed.
    if (config.quoted) {
      return `<article class="card">
    <h2>${escapeHtml(`${config.name} - ${config.price}`)}</h2>
    <p>${escapeHtml(config.description)}</p>
    <a class="action" href="/contact">Ask for a quote</a>
  </article>`;
    }
    const enabled = planStatus.checkout === "enabled";
    const setupText = getPriceCardSetupText(planStatus, readiness);
    return `<article class="card">
    <h2>${escapeHtml(`${config.name} - ${config.price}`)}</h2>
    <p>${escapeHtml(`${config.description} ${enabled ? "Checkout available." : setupText}`)}</p>
    <form method="post" action="/api/checkout/session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${enabled ? "Start checkout" : "Not open yet"}</button>
    </form>
  </article>`;
  }

  function billingPanel(readiness, billing) {
    const planForms = Object.entries(STRIPE_PLANS)
      .filter(([plan, config]) => plan !== "free" && !config.quoted)
      .map(([plan, config]) => `<form method="post" action="/api/billing/create-checkout-session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      <button type="submit">${escapeHtml(`Upgrade: ${config.name}`)}</button>
    </form>`)
      .join("");
    return `<article class="card">
    <h2>Billing actions</h2>
    <p>${escapeHtml(readiness.services.checkout === "enabled" ? "You can check out on any plan that is set up." : "Paid plans are not open for checkout yet.")}</p>
    ${planForms}
    <form method="post" action="/api/billing/create-portal-session">
      <button type="submit">Manage billing portal</button>
    </form>
    <p class="fine">${escapeHtml(billing.rows?.length ? "Current records come from the account database." : "No billing records returned yet.")}</p>
  </article>`;
  }

  function getCheckoutRedirectUrls(req) {
    const baseUrl = getPublicAppUrl(req);
    return {
      successUrl: getSafeAbsoluteUrl(getEnv("STRIPE_SUCCESS_URL"), `${baseUrl}/account`),
      cancelUrl: getSafeAbsoluteUrl(getEnv("STRIPE_CANCEL_URL"), `${baseUrl}/pricing`)
    };
  }

  // What a price actually charges, straight from Stripe.
  //
  // The price id comes from an environment variable. Nothing before this
  // confirmed that the price behind it charges what the page says, so setting
  // STRIPE_PRICE_STARTER_MONTHLY to the wrong id would have advertised $7 and
  // billed whatever that price happened to be -- including one of the retired
  // prices still active in the account.
  //
  // scripts/verify-stripe-env.mjs compares these, but it skips whenever
  // STRIPE_SECRET_KEY is absent, which is every CI run. A check that never
  // executes is not a check, so the comparison happens here too, where the
  // money actually moves and the key is always present.
  async function assertPriceMatchesAdvertised(plan, priceId) {
    const expected = STRIPE_PLANS[plan]?.amountCents;
    if (expected === null || expected === undefined) return { ok: true, reason: "no_advertised_amount" };
    // The product is expanded because a price can be active while the product
    // it belongs to is archived. Archiving a product in Stripe does not clear
    // its prices' active flag, so a price in that state still reads
    // active: true and only the product says otherwise.
    //
    // This comment used to cite the three retired plans on this account as
    // exactly that shape. Checked read-only on 2026-08-12, it is no longer
    // true: SONARA OS Creator, Pro and Label all read active: false on both the
    // price and the product. The check stays because the shape is real and
    // costs one expand, but it is a guard against something that could happen
    // rather than a description of something that is.
    //
    // Stripe refuses checkout for a price whose product is archived, so this is
    // not the difference between selling and not selling. It is the difference
    // between refusing here, with a reason, and letting Stripe reject the
    // session -- which surfaces to the customer as a failure at the checkout
    // rather than a plan that was never offered.
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, {
      headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}` }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, code: "price_unreadable" };
    const price = await response.json().catch(() => undefined);
    if (!price || typeof price !== "object") return { ok: false, code: "price_unreadable" };
    if (price.active === false) return { ok: false, code: "price_archived" };
    if (price.product && typeof price.product === "object" && price.product.active === false) {
      return { ok: false, code: "price_product_archived" };
    }
    if (price.unit_amount !== expected) return { ok: false, code: "price_mismatch", charges: price.unit_amount, advertised: expected };
    return { ok: true };
  }

  async function createStripeCheckoutSession(req, plan, priceId, organizationId, user, stripeCustomerId) {
    // Refusing to sell is the right outcome when the price is wrong. Taking
    // the money and reconciling later is not.
    const priceCheck = await assertPriceMatchesAdvertised(plan, priceId);
    if (!priceCheck.ok) return { ok: false, code: priceCheck.code };

    const urls = getCheckoutRedirectUrls(req);
    const params = new URLSearchParams({
      mode: STRIPE_PLANS[plan].mode,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      customer: stripeCustomerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[plan]": plan,
      "metadata[organization_id]": organizationId,
      "metadata[user_id]": user?.id || "",
      "metadata[price_id]": priceId
    });
    if (STRIPE_PLANS[plan].mode === "subscription") {
      params.set("subscription_data[metadata][plan]", plan);
      params.set("subscription_data[metadata][organization_id]", organizationId);
      params.set("subscription_data[metadata][user_id]", user?.id || "");
    }
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false };
    const session = await response.json();
    return { ok: true, url: session.url };
  }

  async function getOrCreateStripeCustomer(user, organizationId) {
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, code: "supabase" };
    const userId = String(user?.id || "").trim();
    if (!userId || !organizationId) return { ok: false, code: "customer_organization" };

    const existing = await fetch(`${config.url}/rest/v1/stripe_customers?select=stripe_customer_id&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (existing?.ok) {
      const rows = await existing.json().catch(() => []);
      if (rows[0]?.stripe_customer_id) return { ok: true, stripeCustomerId: rows[0].stripe_customer_id, source: "database" };
    }

    const params = new URLSearchParams({
      email: user.email || "",
      "metadata[user_id]": userId,
      "metadata[organization_id]": organizationId
    });
    const created = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }).catch(() => undefined);
    if (!created?.ok) return { ok: false, code: "stripe_customer_create_failed" };
    const customer = await created.json().catch(() => ({}));
    if (!customer.id) return { ok: false, code: "stripe_customer_missing" };

    await fetch(`${config.url}/rest/v1/stripe_customers?on_conflict=stripe_customer_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
      body: JSON.stringify({ user_id: userId, organization_id: organizationId, stripe_customer_id: customer.id })
    }).catch(() => undefined);
    return { ok: true, stripeCustomerId: customer.id, source: "stripe" };
  }

  // Constant-time, and length-checked first because timingSafeEqual throws on a
  // length mismatch rather than returning false.
  function verifyStripeWebhookSignature(rawBody, header, secret) {
    if (!header || !Buffer.isBuffer(rawBody)) return { ok: false };
    const parts = Object.fromEntries(header.split(",").map((part) => part.split("=")));
    if (!parts.t || !parts.v1) return { ok: false };
    const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody.toString("utf8")}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1);
    return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
  }

  async function recordBillingWebhookEvent(event) {
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false };
    const response = await fetch(`${config.url}/rest/v1/billing_webhook_events?on_conflict=provider,provider_event_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
      body: JSON.stringify({
        provider: "stripe",
        provider_event_id: event.id,
        event_type: event.type,
        livemode: Boolean(event.livemode),
        payload: event,
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        metadata: { object: event.data?.object?.object, customer: event.data?.object?.customer, subscription: event.data?.object?.subscription || event.data?.object?.id }
      })
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok) };
  }

  async function synchronizeBillingFromStripeEvent(event) {
    if (event.type === "checkout.session.completed") return synchronizeCheckoutSessionCompleted(event);
    if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return { ok: true, ignored: true };
    const config = getSupabaseServerConfig();
    const subscription = event.data?.object;
    const organizationId = subscription?.metadata?.organization_id;
    if (!config.ok || !subscription?.id || !organizationId) return { ok: false };
    const planSlug = subscription.metadata?.plan || "core_monthly";
    const currentPeriodEnd = Number.isFinite(subscription.current_period_end) ? new Date(subscription.current_period_end * 1000).toISOString() : null;
    const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?on_conflict=provider,provider_subscription_ref`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ organization_id: organizationId, provider: "stripe", provider_customer_ref: subscription.customer, provider_subscription_ref: subscription.id, plan_slug: planSlug, status: subscription.status, current_period_end: currentPeriodEnd, cancel_at_period_end: Boolean(subscription.cancel_at_period_end), metadata: { source: "stripe_webhook" } })
    }).catch(() => undefined);
    await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ organization_id: organizationId, entitlement_key: planSlug, status: ["active", "trialing"].includes(subscription.status) ? "active" : "disabled", source: "billing", metadata: { provider: "stripe", provider_subscription_ref: subscription.id } })
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok) };
  }

  async function synchronizeCheckoutSessionCompleted(event) {
    const config = getSupabaseServerConfig();
    const session = event.data?.object;
    const organizationId = session?.metadata?.organization_id;
    const planSlug = session?.metadata?.plan;
    if (!config.ok || !session?.id || !organizationId || !planSlug) return { ok: true, ignored: true };
    if (session.mode === "payment" && session.payment_status === "paid") {
      await fetch(`${config.url}/rest/v1/purchases?on_conflict=stripe_checkout_session_id`, {
        method: "POST",
        headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          user_id: session.metadata?.user_id || null,
          organization_id: organizationId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || null,
          product_key: planSlug,
          price_id: session.metadata?.price_id || null,
          status: "paid"
        })
      }).catch(() => undefined);
      const entitlement = await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
        method: "POST",
        headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          organization_id: organizationId,
          entitlement_key: planSlug,
          status: "active",
          source: "billing",
          metadata: { provider: "stripe", checkout_session_id: session.id }
        })
      }).catch(() => undefined);
      await insertActivityEvent(organizationId, session.metadata?.user_id || null, "billing.purchase_completed", { plan: planSlug, checkout_session_id: session.id });
      return { ok: Boolean(entitlement?.ok) };
    }
    return { ok: true, ignored: true };
  }

  async function getBillingSummary() {
    const config = getSupabaseServerConfig();
    if (!config.ok) return { webhookEvents: "Setup required: Supabase is not configured.", subscriptions: "Setup required: Supabase is not configured." };
    const [webhookEvents, subscriptions] = await Promise.all([
      safeCountTable(config, "billing_webhook_events"),
      safeCountTable(config, "billing_subscriptions")
    ]);
    return {
      webhookEvents: formatMetric("Recorded events", webhookEvents),
      subscriptions: formatMetric("Subscription records", subscriptions)
    };
  }

  async function getBillingPanelSummary(organizationId) {
    const config = getSupabaseServerConfig();
    if (!config.ok) return { status: "Setup required: account database is not configured.", rows: [] };
    if (!organizationId) return { status: "Setup required: organization membership is missing.", rows: [] };
    const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=5`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { status: "No subscription records returned.", rows: [] };
    const rows = await response.json().catch(() => []);
    const active = rows.find((row) => ["active", "trialing"].includes(row.status));
    return {
      status: active ? `${displayStatus(active.plan_slug)}: ${displayStatus(active.status)}` : "No active paid plan found.",
      rows
    };
  }

  return {
    billingPanel,
    assertPriceMatchesAdvertised,
    createStripeCheckoutSession,
    getBillingPanelSummary,
    getBillingSummary,
    getCheckoutRedirectUrls,
    getOrCreateStripeCustomer,
    getPaidEntitlementKeys,
    getPriceCardSetupText,
    isValidPlan,
    isQuotedPlan,
    normalizeCheckoutPlan,
    priceCard,
    recordBillingWebhookEvent,
    synchronizeBillingFromStripeEvent,
    synchronizeCheckoutSessionCompleted,
    verifyStripeWebhookSignature
  };
}

module.exports = { createBilling, REQUIRED };

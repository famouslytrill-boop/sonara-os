// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { subscriptionPeriod } = require("./sonara-generation-allowance.cjs");

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
const { emitEvent } = require("./sonara-structured-log.cjs");

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
    return String(body.plan || body.priceKey || body.price_key || body.product || body.product_key || "").trim();
  }

  function normalizeWorkspaceChoice(value) {
    const workspace = String(value || "").trim().toLowerCase().replace(/-/g, "_");
    return ["business_builder", "creator_studio", "growth_studio"].includes(workspace) ? workspace : "";
  }

  function workspaceChoiceField(plan) {
    if (!paidAccess.choosesOneWorkspace(plan)) return "";
    return `<label>Choose your workspace
      <select name="workspace" required>
        <option value="">Choose one</option>
        <option value="business_builder">Business Builder</option>
        <option value="creator_studio">Creator Studio</option>
        <option value="growth_studio">Growth Studio</option>
      </select>
    </label>`;
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
      ${workspaceChoiceField(plan)}
      <button type="submit">${enabled ? "Start checkout" : "Not open yet"}</button>
    </form>
  </article>`;
  }

  function billingPanel(readiness, billing) {
    const planForms = Object.entries(STRIPE_PLANS)
      .filter(([plan, config]) => plan !== "free" && !config.quoted)
      .map(([plan, config]) => `<form method="post" action="/api/billing/create-checkout-session">
      <input type="hidden" name="plan" value="${escapeHtml(plan)}">
      ${workspaceChoiceField(plan)}
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
    <p class="fine">${escapeHtml(
      billing.ok === false
        ? "We could not read your billing records just now, so nothing here reflects your plan."
        : billing.rows?.length
          ? "Current records come from the account database."
          : "No billing records returned yet."
    )}</p>
  </article>`;
  }

  function getCheckoutRedirectUrls(req) {
    const baseUrl = getPublicAppUrl(req);
    // A request header is not the authority for the payment return address.
    // Missing canonical configuration must stop checkout before contacting
    // Stripe; a relative "/account" URL is never a safe substitute.
    if (!baseUrl) return { ok: false, code: "site_origin_not_configured" };

    let canonical;
    try {
      canonical = new URL(baseUrl);
      const localOnly =
        canonical.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(canonical.hostname) &&
        getEnv("NODE_ENV") !== "production" &&
        !getEnv("VERCEL_ENV") &&
        !getEnv("VERCEL");
      if (
        (canonical.protocol !== "https:" && !localOnly) ||
        canonical.origin !== baseUrl ||
        canonical.username ||
        canonical.password
      ) return { ok: false, code: "site_origin_not_configured" };
    } catch {
      return { ok: false, code: "site_origin_not_configured" };
    }

    // Optional Stripe redirect overrides are deployment configuration, not
    // a grant to send paying customers to a different website. Require the
    // same HTTPS origin, and reject fragments and embedded credentials.
    function checkedRedirect(name, defaultPath) {
      const supplied = String(getEnv(name) || "").trim();
      if (!supplied) return new URL(defaultPath, canonical).href;
      const accepted = getSafeAbsoluteUrl(supplied, "");
      try {
        const candidate = new URL(accepted);
        if (
          candidate.protocol !== canonical.protocol ||
          candidate.origin !== canonical.origin ||
          candidate.username ||
          candidate.password ||
          candidate.hash
        ) return null;
        return candidate.href;
      } catch {
        return null;
      }
    }

    const successUrl = checkedRedirect("STRIPE_SUCCESS_URL", "/account");
    const cancelUrl = checkedRedirect("STRIPE_CANCEL_URL", "/pricing");
    if (!successUrl || !cancelUrl) return { ok: false, code: "checkout_redirect_untrusted" };
    return { ok: true, successUrl, cancelUrl };
  }

  // What a price actually charges, straight from Stripe.
  //
  // The price id comes from an environment variable. Nothing before this
  // confirmed that the price behind it charges what the page says, so the
  // runtime verifies amount and active product state before creating checkout.
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
    const oneWorkspacePlan = paidAccess.choosesOneWorkspace(plan);
    const workspace = oneWorkspacePlan
      ? normalizeWorkspaceChoice(req?.body?.workspace || req?.body?.workspace_key)
      : "";
    // A single-workspace plan is not sellable until the product being bought is
    // explicit. Refuse before Stripe is contacted so a successful charge can
    // never produce an entitlement that immediately fails workspace_not_chosen.
    if (oneWorkspacePlan && !workspace) {
      return { ok: false, code: "workspace_required" };
    }

    // Validate the destination BEFORE any external Stripe request. A missing
    // origin or unsafe return URL must never trigger an API request or charge.
    const urls = getCheckoutRedirectUrls(req);
    if (!urls.ok) {
      emitEvent({
        event: "checkout.session",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "refused",
        reason: urls.code,
        detail: { plan }
      });
      return { ok: false, code: urls.code };
    }

    // Refusing to sell is the right outcome when the price is wrong. Taking
    // the money and reconciling later is not.
    const priceCheck = await assertPriceMatchesAdvertised(plan, priceId);
    if (!priceCheck.ok) {
      // `refused`, not `failed`. Refusing to sell at a price the page does not
      // advertise is this guard working, and counting it against an error
      // budget would make the budget measure catalog drift rather than
      // reliability.
      emitEvent({
        event: "checkout.session",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "refused",
        reason: priceCheck.code,
        detail: { plan, charges: priceCheck.charges ?? null, advertised: priceCheck.advertised ?? null }
      });
      return { ok: false, code: priceCheck.code };
    }

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
    if (workspace) {
      params.set("metadata[workspace]", workspace);
      params.set("metadata[workspace_key]", workspace);
    }
    if (STRIPE_PLANS[plan].mode === "subscription") {
      params.set("subscription_data[metadata][plan]", plan);
      params.set("subscription_data[metadata][organization_id]", organizationId);
      params.set("subscription_data[metadata][user_id]", user?.id || "");
      if (workspace) {
        params.set("subscription_data[metadata][workspace]", workspace);
        params.set("subscription_data[metadata][workspace_key]", workspace);
      }
    }
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }).catch(() => undefined);

    if (!response?.ok) {
      // **This used to be `return { ok: false }` with no code at all.**
      //
      // Every other refusal in this function is named -- price_mismatch,
      // price_product_archived -- and the one that was not is the one Stripe
      // itself produces. The customer saw "Checkout could not be started" and
      // the server kept no record of why, so a 401 from a key that cannot
      // create sessions was indistinguishable from a 400 on bad parameters and
      // from the network not answering.
      //
      // That is exactly the failure docs/owner/STRIPE-RUNTIME-KEY-CUTOVER.md
      // warns about: "a verifier restricted to Prices/Products read access can
      // make the price audit pass while every customer/Checkout Session write
      // fails." The documented failure mode had no diagnostic.
      //
      // The status is the whole diagnosis. 401 is the credential, 400 is the
      // request, 0 is the network, and an owner reading one line can tell which.
      const status = response?.status || 0;
      emitEvent({
        event: "checkout.session",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "failed",
        reason: status === 401 || status === 403 ? "stripe_rejected_credential" : status ? "stripe_rejected_request" : "stripe_unreachable",
        detail: { plan, status }
      });
      return { ok: false, code: "stripe_session_rejected", status };
    }

    const session = await response.json().catch(() => ({}));
    if (!session?.url) {
      // A 200 with no url is not a session. Named separately because the
      // remedy differs: the credential worked and the response did not carry
      // what it is supposed to carry.
      emitEvent({
        event: "checkout.session",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "failed",
        reason: "stripe_session_without_url",
        detail: { plan, status: response.status }
      });
      return { ok: false, code: "stripe_session_without_url" };
    }

    emitEvent({
      event: "checkout.session",
      scope: "organization",
      organizationId,
      capability: "checkout_session",
      outcome: "ok",
      reason: "created",
      detail: { plan }
    });
    return { ok: true, url: session.url };
  }

  async function getOrCreateStripeCustomer(user, organizationId) {
    const config = getSupabaseServerConfig();
    if (!config.ok) return { ok: false, code: "supabase" };
    const userId = String(user?.id || "").trim();
    if (!userId || !organizationId) return { ok: false, code: "customer_organization" };

    const existing = await fetch(`${config.url}/rest/v1/stripe_customers?select=stripe_customer_id&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=2`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!existing?.ok) return { ok: false, code: "stripe_customer_mapping_unreadable" };
    const rows = await existing.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, code: "stripe_customer_mapping_unreadable" };
    if (rows.length > 1) return { ok: false, code: "stripe_customer_mapping_ambiguous" };
    if (rows.length === 1) {
      if (!/^cus_[a-zA-Z0-9]+$/.test(String(rows[0]?.stripe_customer_id || ""))) return { ok: false, code: "stripe_customer_mapping_unreadable" };
      return { ok: true, stripeCustomerId: rows[0].stripe_customer_id, source: "database" };
    }

    const params = new URLSearchParams({
      "metadata[user_id]": userId,
      "metadata[organization_id]": organizationId
    });
    // Identity, rather than mutable email, defines retry parameters. Stripe
    // rejects reuse of an idempotency key with different parameters. Email is
    // already collected by Checkout and does not define the customer mapping.
    const customerKey = `sonara-customer-v1-${crypto.createHash("sha256").update(JSON.stringify([organizationId, userId])).digest("hex")}`;
    const created = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: { Authorization: `Bearer ${getEnv("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": customerKey },
      body: params.toString()
    }).catch(() => undefined);
    if (!created?.ok) {
      const status = created?.status || 0;
      emitEvent({
        event: "checkout.customer",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "failed",
        reason: status === 401 || status === 403 ? "stripe_rejected_credential" : status ? "stripe_rejected_request" : "stripe_unreachable",
        detail: { status }
      });
      return { ok: false, code: "stripe_customer_create_failed" };
    }
    const customer = await created.json().catch(() => ({}));
    if (!/^cus_[a-zA-Z0-9]+$/.test(String(customer?.id || ""))) {
      emitEvent({
        event: "checkout.customer",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "failed",
        reason: "stripe_customer_missing",
        detail: { status: created.status }
      });
      return { ok: false, code: "stripe_customer_missing" };
    }

    // Do not open checkout until the provider identity is durably mapped.
    // Stripe's idempotency window makes immediate retries safe; it is not a
    // permanent database uniqueness guarantee or complete reconciliation.
    const stored = await fetch(`${config.url}/rest/v1/stripe_customers?on_conflict=stripe_customer_id`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=ignore-duplicates" }),
      body: JSON.stringify({ user_id: userId, organization_id: organizationId, stripe_customer_id: customer.id })
    }).catch(() => undefined);

    if (!stored?.ok) {
      emitEvent({
        event: "checkout.customer",
        scope: "organization",
        organizationId,
        capability: "checkout_session",
        outcome: "degraded",
        reason: "stripe_customer_not_recorded",
        detail: {
          status: stored?.status || 0,
          consequence: "checkout is blocked until the Stripe customer mapping can be recorded"
        }
      });
      return { ok: false, code: "stripe_customer_mapping_unwritable" };
    }

    // ignore-duplicates can succeed without inserting our mapping. Confirm
    // the mapping inside this tenant, including after a concurrent retry.
    const confirmed = await fetch(`${config.url}/rest/v1/stripe_customers?select=stripe_customer_id&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=2`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    const mapped = confirmed?.ok ? await confirmed.json().catch(() => null) : null;
    if (!Array.isArray(mapped) || mapped.length !== 1 || mapped[0]?.stripe_customer_id !== customer.id) {
      return { ok: false, code: "stripe_customer_mapping_unconfirmed" };
    }

    emitEvent({
      event: "checkout.customer",
      scope: "organization",
      organizationId,
      capability: "checkout_session",
      outcome: "ok",
      reason: "created",
      detail: { recorded: Boolean(stored?.ok) }
    });
    return { ok: true, stripeCustomerId: customer.id, source: "stripe" };
  }

  // Constant-time, and length-checked first because timingSafeEqual throws on a
  // length mismatch rather than returning false.
  function verifyStripeWebhookSignature(rawBody, header, secret) {
    if (typeof header !== "string" || !Buffer.isBuffer(rawBody) || !secret) return { ok: false };
    const parts = header.split(",").map((part) => part.trim().split("="));
    const timestamps = parts.filter(([key]) => key === "t");
    if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1] || "")) return { ok: false };
    const timestamp = Number(timestamps[0][1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return { ok: false };
    const expected = crypto.createHmac("sha256", secret).update(`${timestamps[0][1]}.${rawBody.toString("utf8")}`).digest();
    const ok = parts.some(([key, signature]) => {
      if (key !== "v1" || !/^[a-f0-9]{64}$/i.test(signature || "")) return false;
      return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
    });
    return { ok };
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

  // Stripe metadata labels the intended SONARA organization, but it cannot
  // establish tenant ownership on its own. The unique Stripe customer ID must
  // already map to that organization in our server-side customer ledger.
  // Refuse before writing subscriptions, purchases or entitlements if the
  // mapping is missing, inconsistent or unreadable. Do not create mappings
  // from inbound webhook metadata.
  async function verifyWebhookCustomerBinding(config, customerId, organizationId, userId) {
    if (!/^cus_[a-zA-Z0-9]+$/.test(String(customerId || ""))) {
      return { ok: false, code: "stripe_webhook_customer_missing" };
    }
    const response = await fetch(`${config.url}/rest/v1/stripe_customers?select=stripe_customer_id,organization_id,user_id&stripe_customer_id=eq.${encodeURIComponent(customerId)}&limit=2`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, code: "stripe_webhook_customer_unreadable" };
    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, code: "stripe_webhook_customer_unreadable" };
    if (
      rows.length !== 1 ||
      rows[0]?.stripe_customer_id !== customerId ||
      rows[0]?.organization_id !== organizationId ||
      (userId && rows[0]?.user_id !== userId)
    ) return { ok: false, code: "stripe_webhook_customer_mismatch" };
    return { ok: true };
  }

  async function synchronizeBillingFromStripeEvent(event) {
    // Connected merchant events must never grant platform subscription access.
    if (event.account) return { ok: true, ignored: true };
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return synchronizeCheckoutSessionCompleted(event);
    if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return { ok: true, ignored: true };
    // Stripe Events always include an integral Unix-second 'created' stamp.
    // Our SQL stale-event guard intentionally permits null stamps for legacy
    // writers. Webhook ingestion must NEVER use that compatibility path, or
    // a late unversioned event could overwrite a more recent cancellation.
    // Check before DB reads/writes, including deletion recovery.
    if (!Number.isSafeInteger(event.created) || event.created <= 0 || event.created > 253402300799) {
      return { ok: false, code: "stripe_event_timestamp_invalid" };
    }
    const config = getSupabaseServerConfig();
    const subscription = event.data?.object;
    if (!config.ok || !subscription?.id) return { ok: false };
    let organizationId = subscription?.metadata?.organization_id;
    let planSlug = String(subscription?.metadata?.plan || "").trim();
    let workspace = normalizeWorkspaceChoice(subscription?.metadata?.workspace || subscription?.metadata?.workspace_key);

    if (event.type === "customer.subscription.deleted") {
      // A deleted Stripe subscription needs to revoke access even after an
      // account's customer mapping was removed. Only an existing subscription
      // row can authorize this path: match the immutable subscription ID and
      // original Stripe customer, and never infer a NEW tenant from metadata.
      // Do not enable any access or use this fallback for subscription updates.
      if (subscription.status !== "canceled" || !/^cus_[a-zA-Z0-9]+$/.test(String(subscription.customer || ""))) {
        return { ok: false, code: "stripe_cancellation_invalid" };
      }
      const previous = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=organization_id,provider_customer_ref,provider_subscription_ref,plan_slug,metadata&provider=eq.stripe&provider_subscription_ref=eq.${encodeURIComponent(subscription.id)}&limit=2`, {
        headers: supabaseHeaders(config)
      }).catch(() => undefined);
      if (!previous?.ok) return { ok: false, code: "stripe_cancellation_subscription_unreadable" };
      const rows = await previous.json().catch(() => null);
      if (!Array.isArray(rows)) return { ok: false, code: "stripe_cancellation_subscription_unreadable" };
      if (rows.length !== 1) return { ok: false, code: "stripe_cancellation_subscription_mismatch" };
      const persisted = rows[0];
      const storedWorkspace = normalizeWorkspaceChoice(persisted?.metadata?.workspace || persisted?.metadata?.workspace_key);
      if (
        persisted?.provider_subscription_ref !== subscription.id ||
        persisted?.provider_customer_ref !== subscription.customer ||
        typeof persisted?.organization_id !== "string" || !persisted.organization_id ||
        typeof persisted?.plan_slug !== "string" ||
        STRIPE_PLANS[persisted.plan_slug]?.mode !== "subscription" ||
        (organizationId && organizationId !== persisted.organization_id) ||
        (planSlug && planSlug !== persisted.plan_slug) ||
        (workspace && workspace !== storedWorkspace)
      ) return { ok: false, code: "stripe_cancellation_subscription_mismatch" };
      organizationId = persisted.organization_id;
      planSlug = persisted.plan_slug;
      workspace = storedWorkspace;
    } else {
      if (!organizationId || !planSlug || STRIPE_PLANS[planSlug]?.mode !== "subscription") {
        return { ok: false, code: "invalid_plan_metadata" };
      }
      const binding = await verifyWebhookCustomerBinding(config, subscription.customer, organizationId);
      if (!binding.ok) return binding;
    }
    const period = subscriptionPeriod(subscription);
    const currentPeriodEnd = period.ok ? period.end : (Number.isSafeInteger(subscription.current_period_end) && subscription.current_period_end > 0 && subscription.current_period_end <= 253402300799 ? new Date(subscription.current_period_end * 1000).toISOString() : null);
    // Stripe does not guarantee delivery order. A verified event-created
    // timestamp goes to BOTH provider rows, which reject strictly older
    // updates under the database row lock. The timestamp is never null on
    // this webhook path; the nullable SQL compatibility case is reserved
    // for separate legacy writers, not provider event delivery.
    const providerEventAt = new Date(event.created * 1000).toISOString();
    const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?on_conflict=provider,provider_subscription_ref`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        organization_id: organizationId,
        provider: "stripe",
        provider_customer_ref: subscription.customer,
        provider_subscription_ref: subscription.id,
        plan_slug: planSlug,
        status: subscription.status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        provider_event_at: providerEventAt,
        metadata: {
          source: "stripe_webhook",
          ...(period.ok ? { current_period_start: period.start, current_period_end: period.end } : {}),
          ...(workspace ? { workspace, workspace_key: workspace } : {})
        }
      })
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false };
    const entitlement = await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
      method: "POST",
      headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        organization_id: organizationId,
        entitlement_key: planSlug,
        status: ["active", "trialing"].includes(subscription.status) ? "active" : "disabled",
        source: "billing",
        provider_event_at: providerEventAt,
        metadata: {
          provider: "stripe",
          provider_subscription_ref: subscription.id,
          ...(period.ok ? { current_period_start: period.start, current_period_end: period.end } : {}),
          ...(workspace ? { workspace, workspace_key: workspace } : {})
        }
      })
    }).catch(() => undefined);
    return { ok: Boolean(response?.ok && entitlement?.ok) };
  }

  async function synchronizeCheckoutSessionCompleted(event) {
    if (event.account) return { ok: true, ignored: true };
    const config = getSupabaseServerConfig();
    const session = event.data?.object;
    const organizationId = session?.metadata?.organization_id;
    const planSlug = session?.metadata?.plan;
    const workspace = normalizeWorkspaceChoice(session?.metadata?.workspace || session?.metadata?.workspace_key);
    if (!config.ok) return { ok: false };
    // Subscription Checkout is fulfilled by verified subscription events,
    // never by a one-time Checkout payment event. A malformed paid session
    // must not be acknowledged as fulfilled when it has no tenant/plan identity.
    if (session?.mode !== "payment" || session.payment_status !== "paid") return { ok: true, ignored: true };
    if (!session.id || !organizationId || !planSlug) return { ok: false, code: "checkout_metadata_missing" };

    // Do not allow a payment-mode Checkout receipt to create an unlimited
    // active entitlement for a recurring plan. A future one-time product must
    // explicitly declare mode: "payment" in the canonical catalog, and
    // quoted/retired plans are not eligible for automated fulfillment.
    const purchasePlan = STRIPE_PLANS[planSlug];
    if (!purchasePlan || purchasePlan.mode !== "payment" || purchasePlan.quoted || purchasePlan.retired) {
      return { ok: false, code: "checkout_plan_mode_mismatch" };
    }
    const binding = await verifyWebhookCustomerBinding(config, session.customer, organizationId, session.metadata?.user_id);
    if (!binding.ok) return binding;

    {
      const purchase = await fetch(`${config.url}/rest/v1/purchases?on_conflict=stripe_checkout_session_id`, {
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
      if (!purchase?.ok) return { ok: false };
      const entitlement = await fetch(`${config.url}/rest/v1/billing_entitlements?on_conflict=organization_id,entitlement_key`, {
        method: "POST",
        headers: supabaseHeaders(config, { prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({
          organization_id: organizationId,
          entitlement_key: planSlug,
          status: "active",
          source: "billing",
          metadata: {
            provider: "stripe",
            checkout_session_id: session.id,
            ...(workspace ? { workspace, workspace_key: workspace } : {})
          }
        })
      }).catch(() => undefined);
      await insertActivityEvent(organizationId, session.metadata?.user_id || null, "billing.purchase_completed", { plan: planSlug, checkout_session_id: session.id });
      return { ok: Boolean(purchase?.ok && entitlement?.ok) };
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
    if (!config.ok) return { ok: false, status: "Setup required: account database is not configured.", rows: [] };
    if (!organizationId) return { ok: false, status: "Setup required: organization membership is missing.", rows: [] };
    // cancel_at_period_end joins the select, and its absence was the defect.
    //
    // The page read "Core monthly: active" for a customer who had already
    // cancelled -- true and misleading in the direction that costs a support
    // ticket, because the one thing they wanted to confirm is that it stops.
    // The webhook has always written the column; nothing had ever asked for it.
    //
    // current_period_end was already selected here and never used. So the page
    // fetched the renewal date and showed a customer their own billing without
    // it, which is the second thing anybody opens that page to see.
    const response = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,current_period_end,cancel_at_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=5`, {
      headers: supabaseHeaders(config)
    }).catch(() => undefined);
    // "No subscription records returned." was the answer to a read that failed,
    // and it renders on the billing page as a statement about the customer's
    // plan. Somebody paying $39 a month, on a day the database is unreachable,
    // was told they had no active paid plan -- which is the one place in the
    // product where being wrong in that direction costs a support ticket at
    // best and a cancellation at worst.
    const unreadable = () => ({ ok: false, status: "We could not check your plan just now. Try again shortly.", rows: [] });
    // PostgREST's plural GET contract is a JSON array. A 200 with malformed
    // JSON, a singular error object or a partial row is NOT evidence that the
    // customer has no subscription. A false "no plan" statement can encourage
    // a duplicate checkout while payment records are unavailable.
    const validRows = (value) => Array.isArray(value) && value.every((row) =>
      row && typeof row === "object" && !Array.isArray(row) &&
      typeof row.plan_slug === "string" && row.plan_slug.trim() &&
      typeof row.status === "string" && row.status.trim()
    );
    if (!response?.ok) return unreadable();
    const rows = await response.json().catch(() => null);
    if (!validRows(rows)) return unreadable();

    let active = rows.find((row) => ["active", "trialing"].includes(row.status));
    if (!active) {
      // The five most recently updated subscriptions are for display; they
      // are not a proof that there are no older active subscriptions. Ask the
      // organization-scoped active-plan question explicitly before saying
      // "No active paid plan found." A failed second read is unknown, not none.
      const activeResponse = await fetch(`${config.url}/rest/v1/billing_subscriptions?select=plan_slug,status,current_period_end,cancel_at_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&status=in.(active,trialing)&order=updated_at.desc&limit=1`, {
        headers: supabaseHeaders(config)
      }).catch(() => undefined);
      if (!activeResponse?.ok) return unreadable();
      const activeRows = await activeResponse.json().catch(() => null);
      if (!validRows(activeRows)) return unreadable();
      active = activeRows[0];
    }
    return {
      ok: true,
      status: active ? `${STRIPE_PLANS[active.plan_slug]?.name || displayStatus(active.plan_slug)}: ${displayStatus(active.status)}${periodSentence(active)}` : "No active paid plan found.",
      rows
    };
  }

  // What happens next to a plan that is running, said only as far as the row
  // supports it. Three states, because absent is not false:
  //
  //   cancelling, with a date  -- it ends, and when
  //   renewing, with a date    -- it renews, and when
  //   a date and no answer     -- when the period ends, and nothing about what
  //                               happens after it, because nothing here knows
  //
  // A row with no date says nothing at all rather than guessing a month ahead.
  function periodSentence(row) {
    const ends = billingDay(row?.current_period_end);
    if (!ends) return "";
    if (row?.cancel_at_period_end === true) return `. It ends ${ends} and will not renew`;
    if (row?.cancel_at_period_end === false) return `. Renews ${ends}`;
    return `. This period ends ${ends}`;
  }

  // Day precision on purpose. The stored value is a timestamptz, and printing a
  // time would print it in a zone that is not the customer's.
  function billingDay(value) {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
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
    normalizeWorkspaceChoice,
    priceCard,
    recordBillingWebhookEvent,
    synchronizeBillingFromStripeEvent,
    synchronizeCheckoutSessionCompleted,
    verifyStripeWebhookSignature
  };
}

module.exports = { createBilling, REQUIRED };

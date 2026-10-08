// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A storefront order, paid on the shop's own Stripe account, and checked against
// Stripe's record.
//
//   GET  /store/:slug/orders/:orderId?t=…            the buyer's receipt. No account; the token is the key.
//   POST /store/:slug/orders/:orderId/pay            pay (again) from the receipt
//   GET  /business-builder/owner/store/reconciliation  every payment here against Stripe's record of it
//   POST /api/business/storefront/reconcile/record   record a payment Stripe holds and this order lacks
//
// and `handleMerchantEvent`, which the Connect webhook
// (routes/sonara-marketplace-checkout-routes.cjs) calls for `sonara_kind =
// merchant_order`. One webhook, one secret, dispatched by kind: the contract in
// docs/CODEX_HANDOFF_SKILLS_FORMULAS_AGENTS.md section 12.
//
// Every decision is lib/sonara-merchant-payments.cjs. Every Stripe call is
// lib/sonara-connected-checkout.cjs. This file reads, writes and renders.
//
// ## Why the repair is not a shortcut
//
// "Record from Stripe" marks an order paid without a webhook. It does so by reading
// the Checkout Session from Stripe's API with the platform key, on the shop's own
// account, and passing it through the same `eventDecision` a signed event goes
// through -- account, order id in two places, amount, currency, payment status. The
// owner's press supplies which order; Stripe supplies whether it was paid.

const pay = require("../lib/sonara-merchant-payments.cjs");
const checkout = require("../lib/sonara-connected-checkout.cjs");
const payments = require("../lib/sonara-connected-payments.cjs");
const storefront = require("../lib/sonara-merchant-storefront.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

const enc = encodeURIComponent;

// Column lists are written out in each query rather than built from a constant:
// report-unused-selected-columns.mjs cannot read a computed select.

function restClient({ getSupabaseServerConfig, supabaseHeaders }) {
  async function read(pathAndQuery) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, rows: [] };
    try {
      const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, { headers: supabaseHeaders(config) });
      if (!response.ok) return { ok: false, rows: [] };
      const rows = await response.json().catch(() => null);
      return Array.isArray(rows) ? { ok: true, rows } : { ok: false, rows: [] };
    } catch {
      return { ok: false, rows: [] };
    }
  }
  async function write(pathAndQuery, { method = "POST", body, prefer = "return=minimal" } = {}) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, status: 0, rows: [] };
    try {
      const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
        method,
        headers: supabaseHeaders(config, { prefer }),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const rows = prefer.includes("return=representation") ? await response.json().catch(() => []) : [];
      return { ok: response.ok, status: response.status, rows: Array.isArray(rows) ? rows : [] };
    } catch {
      return { ok: false, status: 0, rows: [] };
    }
  }
  return { read, write };
}

/**
 * The parts shared by the storefront's order form, the receipt, the webhook and
 * reconciliation: applying a Stripe event to an order, and opening a checkout.
 */
function createMerchantPayments(deps) {
  const { getEnv, getSupabaseServerConfig, supabaseHeaders } = deps;
  const { read, write } = restClient({ getSupabaseServerConfig, supabaseHeaders });
  const stripeDeps = { getEnv };

  async function sellerAccount(organizationId) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false, code: "unavailable" };
    try {
      return await payments.canAcceptPayments(
        { getEnv, supabaseUrl: config.url, serviceRoleHeaders: () => supabaseHeaders(config) },
        organizationId,
        (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(6000) })
      );
    } catch {
      return { ok: false, code: "unavailable" };
    }
  }

  /**
   * Apply a Stripe event -- signed, or read from Stripe by reconciliation -- to an
   * order. `{ ok, outcome }`; `ok: false` means a write failed and the caller should
   * answer so that Stripe retries.
   */
  async function applyEvent(event, order) {
    const decision = pay.eventDecision({ event, order });
    const scope = `id=eq.${enc(order.id)}&organization_id=eq.${enc(order.organization_id)}`;
    const now = new Date().toISOString();
    let outcome = decision.code;
    let changed = { ok: true };

    if (decision.action === "pay") {
      changed = await write(`merchant_orders?${scope}&payment_state=in.(unpaid,checkout_open,processing)`, {
        method: "PATCH",
        body: {
          payment_state: "paid",
          paid_at: now,
          payment_intent_id: decision.paymentIntentId,
          amount_paid_cents: decision.amountCents,
          checkout_session_id: decision.sessionId,
          checkout_url: null,
          updated_at: now
        }
      });
    } else if (decision.action === "processing") {
      changed = await write(`merchant_orders?${scope}&payment_state=in.(unpaid,checkout_open)`, {
        method: "PATCH",
        body: { payment_state: "processing", checkout_session_id: decision.sessionId, checkout_url: null, updated_at: now }
      });
    } else if (decision.action === "reopen") {
      // Back to unpaid, so the buyer can try again from the receipt -- conditional
      // on the session still being the current one, so a late "expired" for an old
      // attempt cannot close the checkout the buyer is looking at now.
      changed = await write(`merchant_orders?${scope}&payment_state=in.(checkout_open,processing)&checkout_session_id=eq.${enc(event.data.object.id)}`, {
        method: "PATCH",
        body: { payment_state: "unpaid", checkout_url: null, checkout_expires_at: null, updated_at: now }
      });
    } else if (decision.action === "refund" || decision.action === "partial_refund") {
      changed = await write(`merchant_orders?${scope}&payment_state=in.(paid,refunded)&refunded_cents=lt.${enc(decision.refundedCents)}`, {
        method: "PATCH",
        body: { ...(decision.action === "refund" ? { payment_state: "refunded" } : {}), refunded_cents: decision.refundedCents, updated_at: now }
      });
    } else if (decision.action === "dispute") {
      changed = await write(`merchant_orders?${scope}&payment_state=in.(paid,refunded)`, {
        method: "PATCH",
        body: { payment_state: "disputed", updated_at: now }
      });
    } else if (decision.action === "reinstate") {
      changed = await write(`merchant_orders?${scope}&payment_state=eq.disputed`, {
        method: "PATCH",
        body: { payment_state: decision.restoreState, updated_at: now }
      });
    }
    if (!changed.ok) return { ok: false, outcome: "not_saved" };

    const object = event.data?.object || {};
    const recorded = await write("merchant_order_payment_events?on_conflict=stripe_event_id", {
      method: "POST",
      body: {
        stripe_event_id: String(event.id).slice(0, 200),
        organization_id: order.organization_id,
        order_id: order.id,
        event_type: String(event.type || "").slice(0, 80),
        stripe_account_id: String(event.account || "").slice(0, 80),
        outcome: String(outcome || "").slice(0, 60),
        amount_cents: Number.isInteger(object.amount_total) ? object.amount_total : (Number.isInteger(object.amount_refunded) ? object.amount_refunded : null)
      },
      prefer: "resolution=ignore-duplicates,return=minimal"
    });
    if (!recorded.ok) return { ok: false, outcome: "audit_not_saved" };
    return { ok: true, outcome, action: decision.action };
  }

  /** The order a verified Connect event is about, or null. `{ ok, order }`. */
  async function orderForEvent(event) {
    const object = event?.data?.object || {};
    // Filtered on the account the event came from as well as the id: the guard
    // allows these unscoped reads only with that filter.
    const account = String(event?.account || "");
    if (!/^acct_[A-Za-z0-9]{8,}$/.test(account)) return { ok: true, order: null };
    if (String(event?.type || "").startsWith("checkout.session.")) {
      const orderId = object.metadata?.sonara_order_id;
      if (!pay.isUuid(orderId)) return { ok: true, order: null };
      const found = await read(`merchant_orders?select=id,organization_id,status,payment_state,subtotal_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,amount_paid_cents,refunded_cents&id=eq.${enc(orderId)}&stripe_account_id=eq.${enc(account)}&limit=1`);
      return found.ok ? { ok: true, order: found.rows[0] || null } : { ok: false };
    }
    const intent = typeof object.payment_intent === "string" ? object.payment_intent : "";
    if (!/^pi_[A-Za-z0-9]{8,}$/.test(intent)) return { ok: true, order: null };
    const found = await read(`merchant_orders?select=id,organization_id,status,payment_state,subtotal_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,amount_paid_cents,refunded_cents&payment_intent_id=eq.${enc(intent)}&stripe_account_id=eq.${enc(account)}&limit=1`);
    return found.ok ? { ok: true, order: found.rows[0] || null } : { ok: false };
  }

  /**
   * Open (or reuse) a checkout for an order. `{ ok, url }` or `{ ok: false,
   * sentence, status }`. `order` must carry the columns read in `orderForCheckout`.
   */
  async function openCheckout({ order, lines, slug, token, req }) {
    const ready = checkout.checkoutReadiness(stripeDeps);
    if (!ready.ok) return { ok: false, status: 503, code: "checkout_off", sentence: "This shop cannot take payments online yet. Nothing has been charged -- the shop will tell you how to pay." };
    const account = await sellerAccount(order.organization_id);
    const decision = pay.payDecision({ order, lines, payment: account });
    if (!decision.ok) return { ok: false, status: decision.code === "shop_cannot_take_payment" ? 503 : 409, code: decision.code, sentence: decision.sentence };
    if (decision.action === "reuse") return { ok: true, url: decision.url };

    const scope = `id=eq.${enc(order.id)}&organization_id=eq.${enc(order.organization_id)}`;
    if (decision.expirePrevious) {
      // One open checkout per order. If the previous one cannot be expired because
      // it has already been paid, nothing new is opened: the payment is applied from
      // Stripe's own record and the buyer is told.
      const expired = await checkout.expireSession(stripeDeps, { accountId: decision.accountId, sessionId: decision.expirePrevious });
      if (!expired.ok) {
        const previous = await checkout.retrieveSession(stripeDeps, { accountId: decision.accountId, sessionId: decision.expirePrevious });
        if (previous.ok && previous.session.status === "complete") {
          await applyEvent({ id: `reconciled:${previous.session.id}`, type: "checkout.session.completed", account: decision.accountId, data: { object: previous.session } },
            { ...order, stripe_account_id: order.stripe_account_id || decision.accountId });
          return { ok: false, status: 409, code: "already_paid", sentence: "Your earlier checkout went through, so this order is paid. Nothing more is owed." };
        }
        return { ok: false, status: 503, code: "previous_open", sentence: "Your earlier checkout could not be closed just now, so a second one was not opened. Nothing more has been charged -- try again shortly." };
      }
    }

    // Claim the attempt first, conditionally, so two presses cannot open two
    // checkouts: the second finds the counter already moved and stops.
    const attempt = (Number(order.checkout_attempts) || 0) + 1;
    const claimed = await write(`merchant_orders?${scope}&checkout_attempts=eq.${enc(attempt - 1)}&payment_state=in.(unpaid,checkout_open)`, {
      method: "PATCH",
      body: { checkout_attempts: attempt, stripe_account_id: decision.accountId, updated_at: new Date().toISOString() },
      prefer: "return=representation"
    });
    if (!claimed.ok) return { ok: false, status: 503, code: "not_saved", sentence: "The checkout could not be started just now. Nothing has been charged." };
    if (!claimed.rows.length) return { ok: false, status: 409, code: "busy", sentence: "A checkout for this order is being opened already. Reload this page in a moment." };

    const origin = siteOrigin(req, getEnv);
    if (!origin) return { ok: false, status: 503, code: "no_origin", sentence: "This site does not know its own address, so Stripe would have nowhere to send you back. Nothing has been charged." };
    const receipt = `${origin}/store/${enc(slug)}/orders/${enc(order.id)}?t=${enc(token)}`;
    const expiresAt = new Date(Date.now() + pay.CHECKOUT_SECONDS * 1000).toISOString();
    const session = await checkout.createSession(stripeDeps, {
      accountId: decision.accountId,
      orderId: order.id,
      idempotencyKey: `sonara-merchant-order-${order.id}-${attempt}`,
      fields: pay.checkoutFields({ order, lines, successUrl: receipt, cancelUrl: receipt, expiresAt })
    });
    if (!session.ok) {
      await write(`merchant_orders?${scope}&checkout_attempts=eq.${enc(attempt)}&payment_state=eq.checkout_open`, {
        method: "PATCH", body: { payment_state: "unpaid", checkout_url: null, checkout_expires_at: null, updated_at: new Date().toISOString() }
      });
      return { ok: false, status: 503, code: "stripe_refused", sentence: "Stripe's checkout could not be opened just now. Nothing has been charged -- try again shortly." };
    }
    const recorded = await write(`merchant_orders?${scope}&checkout_attempts=eq.${enc(attempt)}&payment_state=in.(unpaid,checkout_open)`, {
      method: "PATCH",
      body: { payment_state: "checkout_open", checkout_session_id: session.id, checkout_url: session.url, checkout_expires_at: expiresAt, updated_at: new Date().toISOString() }
    });
    // A session the order does not know about can still be paid -- its metadata
    // names the order, and the webhook accepts an earlier attempt -- but the buyer
    // is not sent to it, because this page could not then tell them it is open.
    if (!recorded.ok) return { ok: false, status: 503, code: "not_saved", sentence: "The checkout could not be recorded, so you were not sent to pay. Nothing has been charged." };
    return { ok: true, url: session.url };
  }

  /** The order and its lines, by id within an organization, for checkout and receipt. */
  async function orderForCheckout(organizationId, orderId) {
    const found = await read(`merchant_orders?select=id,organization_id,storefront_id,buyer_name,buyer_email,status,payment_state,subtotal_cents,currency,stripe_account_id,checkout_session_id,checkout_url,checkout_expires_at,checkout_attempts,payment_intent_id,amount_paid_cents,refunded_cents,paid_at,created_at&id=eq.${enc(orderId)}&organization_id=eq.${enc(organizationId)}&limit=1`);
    if (!found.ok) return { ok: false };
    const order = found.rows[0] || null;
    if (!order) return { ok: true, order: null, lines: [] };
    const lines = await read(`merchant_order_lines?select=description,quantity,unit_price_cents,line_total_cents,currency&order_id=eq.${enc(order.id)}&organization_id=eq.${enc(organizationId)}&order=created_at.asc&limit=60`);
    if (!lines.ok) return { ok: false };
    return { ok: true, order, lines: lines.rows };
  }

  return { applyEvent, orderForEvent, openCheckout, orderForCheckout, sellerAccount, read, write };
}

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml", "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "getEnv", "createRateLimiter"
];

function registerMerchantPaymentRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerMerchantPaymentRoutes requires ${name}`);
  }
  const { layout, brandCard, linkAction, escapeHtml, requireBusinessManager, getCustomerPrimaryOrganization, getSupabaseServerConfig, getEnv, createRateLimiter } = deps;
  const shared = createMerchantPayments(deps);
  const { read } = shared;
  const money = (centsValue, currency) => storefront.money(centsValue, currency);
  const RECONCILE_PAGE = "/business-builder/owner/store/reconciliation";

  const publicPage = (res, { status = 200, heading, body, sections = [] }) => res.status(status).type("html").send(layout({
    title: heading, eyebrow: "Shop", heading, body, sections, actions: [linkAction("/", "SONARA One")]
  }));
  const noSuchOrder = (res) => publicPage(res, { status: 404, heading: "No such order", body: "There is no order at this address. Check the link you were given when you placed it." });

  // Per address: 120 receipt views and 30 pay presses an hour. The token is 192
  // random bits, so this is not what stops guessing; it is what stops a script
  // spending this application's database reads -- and the shop's Stripe sessions --
  // on trying.
  const receiptLimiter = createRateLimiter({ name: "public_store_receipt", windowSeconds: 3600, maxAttempts: 120, scopes: ["ip"], getSupabaseServerConfig });
  const payLimiter = createRateLimiter({ name: "public_store_payment", windowSeconds: 3600, maxAttempts: 30, scopes: ["ip"], getSupabaseServerConfig });

  /**
   * The order a presented token opens, or null. Found by id AND the token's hash,
   * so a wrong token and a wrong id are the same answer.
   */
  async function orderByToken(orderId, token) {
    const hash = pay.hashToken(token);
    if (!pay.isUuid(orderId) || !hash) return { ok: true, order: null };
    const found = await read(`merchant_orders?select=id,organization_id&id=eq.${enc(orderId)}&buyer_token_hash=eq.${enc(hash)}&limit=1`);
    if (!found.ok) return { ok: false };
    const hit = found.rows[0];
    if (!hit) return { ok: true, order: null };
    return shared.orderForCheckout(hit.organization_id, hit.id);
  }

  app.get("/store/:slug/orders/:orderId", receiptLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    const token = String(req.query?.t || "");
    const found = await orderByToken(String(req.params.orderId || ""), token);
    if (!found.ok) return publicPage(res, { status: 503, heading: "Your order", body: "We could not read your order just now. That says nothing about whether you have paid -- try again shortly." });
    if (!found.order) return noSuchOrder(res);
    const { order, lines } = found;
    const shops = await read(`merchant_storefronts?select=headline&id=eq.${enc(order.storefront_id)}&organization_id=eq.${enc(order.organization_id)}&limit=1`);
    const shopName = String(shops.rows[0]?.headline || "").trim() || "The shop";

    const sections = [
      brandCard("What you ordered", "<ul>" + lines.map((line) =>
        `<li>${escapeHtml(String(line.quantity))} × ${escapeHtml(line.description)} at ${escapeHtml(money(line.unit_price_cents, line.currency))} — ${escapeHtml(money(line.line_total_cents, line.currency))}</li>`).join("")
        + `</ul><p>Total: ${escapeHtml(money(order.subtotal_cents, order.currency))}</p>`),
      brandCard("Payment", [
        `<p>${escapeHtml(pay.receiptSentence(order))}</p>`,
        order.paid_at ? `<p>Paid ${escapeHtml(money(order.amount_paid_cents, order.currency))} on ${escapeHtml(new Date(order.paid_at).toUTCString())}.</p>` : "",
        Number(order.refunded_cents) > 0 ? `<p>Refunded: ${escapeHtml(money(order.refunded_cents, order.currency))}.</p>` : "",
        order.payment_intent_id ? `<p>Payment reference: ${escapeHtml(order.payment_intent_id)}</p>` : ""
      ].join("")),
      brandCard("The order", `<p>Placed ${order.created_at ? escapeHtml(new Date(order.created_at).toUTCString()) : "at a time we did not record"} by ${escapeHtml(order.buyer_name)}. `
        + `${order.status === "cancelled" ? "The shop has cancelled it." : `The shop has it as ${escapeHtml(order.status)}.`}</p>`)
    ];
    const payable = order.status !== "cancelled" && ["unpaid", "checkout_open"].includes(order.payment_state) && checkout.checkoutReadiness({ getEnv }).ok;
    if (payable) {
      sections.push(brandCard("Pay for it", `<form method="post" action="/store/${escapeHtml(slug)}/orders/${escapeHtml(order.id)}/pay">`
        + `<input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">Pay ${escapeHtml(money(order.subtotal_cents, order.currency))} on Stripe</button></form>`
        + "<p>You pay on Stripe's own page, charged to the shop directly. Card details are typed there, never here.</p>"));
    }
    sections.push(brandCard("Keep this address", "This page is your receipt, and its address is the only key to it. Nobody can open it without the link."));
    return publicPage(res, { heading: shopName, body: "Your order, and where the payment stands. Landing here changes nothing; what it shows is what Stripe has confirmed.", sections });
  });

  app.post("/store/:slug/orders/:orderId/pay", payLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!storefront.SLUG_PATTERN.test(slug)) return noSuchOrder(res);
    const token = String(req.body?.t || "");
    const found = await orderByToken(String(req.params.orderId || ""), token);
    if (!found.ok) return publicPage(res, { status: 503, heading: "Your order", body: "We could not read your order just now. Nothing has been charged -- try again shortly." });
    if (!found.order) return noSuchOrder(res);
    const opened = await shared.openCheckout({ order: found.order, lines: found.lines, slug, token, req });
    if (opened.ok) return res.redirect(303, opened.url);
    return publicPage(res, { status: opened.status, heading: "Not paid", body: opened.sentence,
      sections: [brandCard("Your receipt", `<a href="/store/${escapeHtml(slug)}/orders/${escapeHtml(found.order.id)}?t=${escapeHtml(enc(token))}">Back to your order</a>`)] });
  });

  // -------------------------------------------------------------------------
  // The owner's reconciliation
  // -------------------------------------------------------------------------

  async function scopeFor(req) {
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    return { ok: Boolean(getSupabaseServerConfig()?.ok && org?.organizationId), organizationId: org?.organizationId || null };
  }

  const ownerPage = (res, { status = 200, body, sections = [] }) => res.status(status).type("html").send(layout({
    title: "Payments against Stripe",
    eyebrow: "Business Builder",
    heading: "Your shop's payments, checked against Stripe",
    body,
    sections,
    actions: [linkAction("/business-builder/owner/store", "Your shop"), linkAction("/business-builder", "Business Builder")]
  }));

  const WINDOWS = Object.freeze({ 7: "the last 7 days", 30: "the last 30 days", 90: "the last 90 days" });

  async function shopAccountId(organizationId) {
    const config = getSupabaseServerConfig();
    if (!config?.ok) return { ok: false };
    const stored = await payments.readAccount({ supabaseUrl: config.url, serviceRoleHeaders: () => deps.supabaseHeaders(config) }, organizationId).catch(() => ({ ok: false }));
    if (!stored.ok) return { ok: false };
    return { ok: true, accountId: stored.account?.stripe_account_id || null };
  }

  app.get(RECONCILE_PAGE, requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return ownerPage(res, { status: 503, body: "We could not reach your workspace just now. Nothing here is a statement about your payments." });
    const days = WINDOWS[String(req.query?.days)] ? Number(req.query.days) : 30;
    const since = new Date(Date.now() - days * 86400000);

    if (!checkout.checkoutReadiness({ getEnv }).ok) {
      return ownerPage(res, { body: "Online payment is not switched on for shops on this platform yet, so there is nothing at Stripe to check against. Orders are still recorded on your shop page." });
    }
    const account = await shopAccountId(scope.organizationId);
    if (!account.ok) return ownerPage(res, { status: 503, body: "We could not read which Stripe account your shop uses just now. Nothing here is a statement about your payments." });
    if (!account.accountId) return ownerPage(res, { body: "Your shop has no Stripe account connected, so there are no online payments to check. Connect one under Payment account." });

    const listed = await checkout.listSessions({ getEnv }, { accountId: account.accountId, sinceSeconds: since.getTime() / 1000 });
    if (!listed.ok) {
      return ownerPage(res, { status: 503, body: "Stripe could not be asked for your payments just now. Nothing below would be true without that, so nothing is shown -- try again shortly." });
    }
    const orders = await read(`merchant_orders?select=id,buyer_name,status,payment_state,currency,amount_paid_cents,refunded_cents,payment_intent_id,created_at&organization_id=eq.${enc(scope.organizationId)}&created_at=gte.${enc(since.toISOString())}&order=created_at.desc&limit=1000`);
    if (!orders.ok) return ownerPage(res, { status: 503, body: "We could not read your orders just now. Nothing below would be true without them, so nothing is shown." });

    // A session in the window can be for an order placed just before it. Read
    // those by id, scoped to this organization, rather than call them unknown.
    const have = new Set(orders.rows.map((order) => order.id));
    const missing = [...new Set(listed.sessions
      .filter((session) => session?.metadata?.sonara_kind === pay.KIND && pay.isUuid(session?.metadata?.sonara_order_id) && !have.has(session.metadata.sonara_order_id))
      .map((session) => session.metadata.sonara_order_id))].slice(0, 200);
    let earlier = { ok: true, rows: [] };
    if (missing.length) {
      earlier = await read(`merchant_orders?select=id,buyer_name,status,payment_state,currency,amount_paid_cents,refunded_cents,payment_intent_id,created_at&organization_id=eq.${enc(scope.organizationId)}&id=in.(${missing.map(enc).join(",")})&limit=200`);
      if (!earlier.ok) return ownerPage(res, { status: 503, body: "We could not read some of your orders just now, so the comparison would be incomplete. Nothing is shown." });
    }

    const result = pay.reconcile({ orders: [...orders.rows, ...earlier.rows], sessions: listed.sessions, truncated: listed.truncated });
    const sections = [];
    const notice = { recorded: "Recorded from Stripe's own record.", unchanged: "Stripe's record did not change this order; the reason is below." }[String(req.query?.done || "")];
    if (notice) sections.push(brandCard("What just happened", escapeHtml(notice)));
    sections.push(brandCard("Which period", Object.entries(WINDOWS).map(([value, label]) =>
      value === String(days) ? `<strong>${escapeHtml(label)}</strong>` : `<a href="${RECONCILE_PAGE}?days=${value}">${escapeHtml(label)}</a>`).join(" · ")));

    if (!result.totals.length) {
      sections.push(brandCard("No online payments", `Nothing was paid online through your shop in ${escapeHtml(WINDOWS[days])}.`));
    }
    for (const total of result.totals) {
      sections.push(brandCard(`Totals in ${escapeHtml(total.currency.toUpperCase())}`, [
        `<p>Stripe took ${escapeHtml(money(total.stripeGross, total.currency))} in ${escapeHtml(String(total.payments))} payment${total.payments === 1 ? "" : "s"}, and refunded ${escapeHtml(money(total.stripeRefunded, total.currency))}.</p>`,
        total.stripeFees === null
          ? "<p>Stripe did not report the fee on every payment, so the fee and what you received are not totalled here rather than understated.</p>"
          : `<p>Stripe's fees: ${escapeHtml(money(total.stripeFees, total.currency))}. What reached your Stripe balance: ${escapeHtml(money(total.stripeNet, total.currency))}.</p>`,
        `<p>Recorded here as paid: ${escapeHtml(money(total.recordedPaid, total.currency))}, refunded ${escapeHtml(money(total.recordedRefunded, total.currency))}.</p>`
      ].join("")));
    }
    if (result.truncated) {
      sections.push(brandCard("Not everything was checked", "Stripe had more checkouts in this period than we read at once. Payments we did not reach are marked unverified rather than missing -- choose a shorter period to check them."));
    }
    const problems = result.rows.filter((row) => row.finding !== "matched");
    sections.push(brandCard(problems.length ? `Needs a look (${problems.length})` : "Everything agrees",
      problems.length
        ? problems.map((row) => [
          `<p><strong>${escapeHtml(row.order?.buyer_name || "An order")}</strong> — ${escapeHtml(row.sentence)}`,
          row.stripeAmountCents !== null ? ` Stripe: ${escapeHtml(money(row.stripeAmountCents, row.currency))}.` : "",
          row.order?.amount_paid_cents != null ? ` Recorded: ${escapeHtml(money(row.order.amount_paid_cents, row.currency))}.` : "",
          "</p>",
          row.repairable
            ? `<form method="post" action="/api/business/storefront/reconcile/record"><input type="hidden" name="order_id" value="${escapeHtml(row.orderId)}">`
              + `<input type="hidden" name="session_id" value="${escapeHtml(row.sessionId)}"><input type="hidden" name="days" value="${escapeHtml(String(days))}">`
              + "<button type=\"submit\">Record it from Stripe's record</button></form>"
            : ""
        ].join("")).join("")
        : `<p>Every online payment in ${escapeHtml(WINDOWS[days])} is recorded here for the amount Stripe took, with the same refunds.</p>`));
    const matched = result.rows.length - problems.length;
    sections.push(brandCard("What was compared", `${escapeHtml(String(result.compared))} checkout${result.compared === 1 ? "" : "s"} this shop opened, ${escapeHtml(String(matched))} payment${matched === 1 ? "" : "s"} agreeing. `
      + `${escapeHtml(String(result.notOurs))} other checkout${result.notOurs === 1 ? "" : "s"} on your Stripe account were not opened by this shop and are left alone. Refunds are issued in your Stripe dashboard, never from here.`));
    return ownerPage(res, { body: "Every online payment your shop took, beside Stripe's own record of it -- what was charged, Stripe's fee, what you received, and anything that does not agree.", sections });
  });

  // Thirty a minute per manager and per address. Each press is one Stripe read and
  // at most one write.
  const recordLimiter = createRateLimiter({ name: "business.storefront_reconcile", windowSeconds: 60, maxAttempts: 30, scopes: ["ip", "subject"], subjectFrom: (req) => req.sonaraUser?.id, getSupabaseServerConfig });

  app.post("/api/business/storefront/reconcile/record", requireBusinessManager, recordLimiter, async (req, res) => {
    const back = (params) => res.redirect(303, `${RECONCILE_PAGE}?${new URLSearchParams(params).toString()}`);
    const days = WINDOWS[String(req.body?.days)] ? String(req.body.days) : "30";
    const scope = await scopeFor(req);
    if (!scope.ok) return back({ days, done: "unchanged" });
    const orderId = String(req.body?.order_id || "");
    const sessionId = String(req.body?.session_id || "");
    if (!pay.isUuid(orderId)) return back({ days, done: "unchanged" });

    const found = await shared.orderForCheckout(scope.organizationId, orderId);
    if (!found.ok || !found.order) return back({ days, done: "unchanged" });
    const account = await shopAccountId(scope.organizationId);
    if (!account.ok || !account.accountId) return back({ days, done: "unchanged" });

    // Stripe's own record, read now with the platform key. The form's session id
    // only says which one to read.
    const fetched = await checkout.retrieveSession({ getEnv }, { accountId: account.accountId, sessionId });
    if (!fetched.ok) return back({ days, done: "unchanged" });
    const event = { id: `reconciled:${fetched.session.id}`, type: "checkout.session.completed", account: account.accountId, data: { object: fetched.session } };
    const applied = await shared.applyEvent(event, { ...found.order, stripe_account_id: found.order.stripe_account_id || account.accountId });
    return back({ days, done: applied.ok && applied.action === "pay" ? "recorded" : "unchanged" });
  });
}

/**
 * The webhook's branch for `sonara_kind = merchant_order`. Answers 200 to anything
 * verified it decided not to act on, 503 when the database could not be reached
 * (so Stripe retries).
 */
async function handleMerchantEvent(deps, event, res) {
  const shared = createMerchantPayments(deps);
  const found = await shared.orderForEvent(event);
  if (!found.ok) return res.status(503).json({ ok: false, code: "unreadable" });
  if (!found.order) return res.status(200).json({ ok: true, ignored: "no_order" });
  const applied = await shared.applyEvent(event, found.order);
  if (!applied.ok) return res.status(503).json({ ok: false, code: applied.outcome });
  return res.status(200).json({ ok: true, outcome: applied.outcome });
}

module.exports = registerMerchantPaymentRoutes;
module.exports.createMerchantPayments = createMerchantPayments;
module.exports.handleMerchantEvent = handleMerchantEvent;

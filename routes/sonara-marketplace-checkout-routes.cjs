// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Buying a licence on the Creator Studio marketplace, end to end.
//
//   POST /marketplace/:id/buy                    start a purchase (signed in)
//   GET  /marketplace/orders/:orderId            the buyer's order: what Stripe has confirmed
//   GET  /marketplace/orders/:orderId/download   the purchased file, for that buyer only
//   GET  /account/purchases                      everything this person has bought
//   POST /api/webhooks/stripe-connect            Stripe's word on a payment (createConnectWebhookHandler)
//
// Every decision is lib/sonara-marketplace-orders.cjs; the Stripe call is
// lib/sonara-connected-checkout.cjs. docs/COMMERCE_UPLOAD_READINESS.md is the
// specification.
//
// ## Why the webhook is registered separately
//
// Stripe signs the exact bytes it sent. server.js installs urlencoded and json
// body parsers before any routes module, and a parsed body cannot be verified --
// every signature would fail, every payment would grant nothing, and the buyer
// would have paid for nothing. So the handler is exported and server.js mounts it
// beside the existing Stripe webhooks, with express.raw, ahead of the parsers.
//
// ## What the buyer's form decides
//
// Which listing. Nothing else: the seller's organization, the price, the
// currency, the connected account and the file to deliver all come from the
// server's own reads at the moment of purchase.

const orders = require("../lib/sonara-marketplace-orders.cjs");
const checkout = require("../lib/sonara-connected-checkout.cjs");
const payments = require("../lib/sonara-connected-payments.cjs");
const storage = require("../lib/sonara-file-storage.cjs");
const { siteOrigin } = require("../lib/sonara-site-origin.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml", "requireCustomer",
  "getSupabaseServerConfig", "supabaseHeaders", "getEnv", "createRateLimiter"
];

// Column lists are written out in each query rather than held in a constant:
// scripts/report-unused-selected-columns.mjs cannot read a computed select, and a
// column fetched and never used inside one would be invisible to it.

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
  // `rows` is what return=representation handed back, so a conditional PATCH can
  // tell "changed one row" from "matched nothing" -- the difference between a
  // state transition that happened and one another request already made.
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
 * The Connect webhook. Verify, find the order, decide, transition, record.
 *
 * Answers 400 to a bad signature (Stripe stops), 503 when the database cannot be
 * reached (Stripe retries), and 200 to every verified event whatever it decided
 * -- an event that is genuine and not ours is still delivered.
 */
function createConnectWebhookHandler(deps) {
  const { getEnv, verifyStripeWebhookSignature } = deps;
  if (typeof verifyStripeWebhookSignature !== "function") throw new TypeError("createConnectWebhookHandler requires verifyStripeWebhookSignature");
  const { read, write } = restClient(deps);
  const enc = encodeURIComponent;

  return async function handleConnectWebhook(req, res) {
    const secret = String(getEnv("STRIPE_CONNECT_WEBHOOK_SECRET") || "");
    if (!secret) return res.status(503).json({ ok: false, code: "not_configured" });
    const verified = verifyStripeWebhookSignature(req.body, req.get("stripe-signature"), secret);
    if (!verified?.ok) return res.status(400).json({ ok: false, code: "bad_signature" });

    let event;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, code: "unreadable" });
    }
    if (!/^evt_[A-Za-z0-9]+$/.test(String(event?.id || ""))) return res.status(400).json({ ok: false, code: "unreadable" });
    const object = event.data?.object || {};

    // Find the order the event is about. A checkout event names it; a refund or
    // dispute names the payment intent.
    let found;
    if (String(event.type || "").startsWith("checkout.session.")) {
      const orderId = object.metadata?.sonara_order_id;
      if (object.metadata?.sonara_kind !== "creator_marketplace" || !orders.isUuid(orderId)) {
        return res.status(200).json({ ok: true, ignored: "not_a_marketplace_order" });
      }
      found = await read(`creator_marketplace_orders?select=id,organization_id,listing_id,version_id,buyer_user_id,licence,price_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,state&id=eq.${enc(orderId)}&limit=1`);
    } else if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const intent = String(object.payment_intent || "");
      if (!/^pi_[A-Za-z0-9]{8,}$/.test(intent)) return res.status(200).json({ ok: true, ignored: "no_payment_intent" });
      found = await read(`creator_marketplace_orders?select=id,organization_id,listing_id,version_id,buyer_user_id,licence,price_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,state&payment_intent_id=eq.${enc(intent)}&limit=1`);
    } else {
      return res.status(200).json({ ok: true, ignored: "unhandled_type" });
    }
    if (!found.ok) return res.status(503).json({ ok: false, code: "unreadable" });
    const order = found.rows[0] || null;
    const decision = orders.fulfilmentDecision({ event, order });
    if (!order || decision.action === "ignore") {
      if (order) await recordEvent(order, event, decision.code);
      return res.status(200).json({ ok: true, ignored: decision.code });
    }

    const scope = `id=eq.${enc(order.id)}&organization_id=eq.${enc(order.organization_id)}`;
    const now = new Date().toISOString();
    let outcome = decision.code;

    if (decision.action === "grant") {
      // Conditional: only an open order becomes paid. A replay finds it paid,
      // matches nothing, and falls through to making sure the grant exists.
      const paid = await write(`creator_marketplace_orders?${scope}&state=in.(pending,processing)`, {
        method: "PATCH",
        body: { state: "paid", paid_at: now, payment_intent_id: decision.paymentIntentId, updated_at: now },
        prefer: "return=representation"
      });
      if (!paid.ok) return res.status(503).json({ ok: false, code: "not_saved" });
      // The grant, idempotently -- its primary key is the order id, so a second
      // delivery of the same event cannot grant twice, and a first attempt that
      // failed after marking the order paid is completed by the retry.
      const granted = await write("creator_licence_grants?on_conflict=order_id", {
        method: "POST",
        body: {
          order_id: order.id,
          organization_id: order.organization_id,
          buyer_user_id: order.buyer_user_id,
          version_id: order.version_id,
          licence: order.licence
        },
        prefer: "resolution=ignore-duplicates,return=minimal"
      });
      if (!granted.ok) return res.status(503).json({ ok: false, code: "grant_not_saved" });
      if (order.licence === "exclusive_transfer") {
        // Sold once: off the public catalogue, and marked so the seller cannot put
        // it back on sale by pressing a button.
        await write(`creator_marketplace_entries?listing_id=eq.${enc(order.listing_id)}`, { method: "DELETE" });
        await write(`creator_listings?id=eq.${enc(order.listing_id)}&organization_id=eq.${enc(order.organization_id)}`, {
          method: "PATCH",
          body: { state: "sold_exclusively", updated_at: now }
        });
      }
      outcome = paid.rows.length ? "granted" : "grant_confirmed";
    } else if (decision.action === "processing") {
      await write(`creator_marketplace_orders?${scope}&state=eq.pending`, { method: "PATCH", body: { state: "processing", updated_at: now } });
    } else if (decision.action === "fail") {
      await write(`creator_marketplace_orders?${scope}&state=in.(pending,processing)`, { method: "PATCH", body: { state: "payment_failed", closed_at: now, updated_at: now } });
    } else if (decision.action === "expire") {
      await write(`creator_marketplace_orders?${scope}&state=eq.pending`, { method: "PATCH", body: { state: "expired", closed_at: now, updated_at: now } });
    } else if (decision.action === "refund" || decision.action === "dispute") {
      const state = decision.action === "refund" ? "refunded" : "disputed";
      const from = decision.action === "refund" ? "state=eq.paid" : "state=in.(paid,refunded)";
      const changed = await write(`creator_marketplace_orders?${scope}&${from}`, { method: "PATCH", body: { state, closed_at: now, updated_at: now } });
      if (!changed.ok) return res.status(503).json({ ok: false, code: "not_saved" });
      // The licence ends with the money. Revoked, never deleted.
      await write(`creator_licence_grants?order_id=eq.${enc(order.id)}&organization_id=eq.${enc(order.organization_id)}&revoked_at=is.null`, {
        method: "PATCH",
        body: { revoked_at: now, revoked_reason: state }
      });
    }

    await recordEvent(order, event, outcome);
    return res.status(200).json({ ok: true, outcome });
  };

  // The audit trail: insert-only, keyed on Stripe's event id. A replay is a
  // duplicate here and is ignored; the transitions above are what make it safe.
  async function recordEvent(order, event, outcome) {
    await write("creator_marketplace_payment_events?on_conflict=stripe_event_id", {
      method: "POST",
      body: {
        stripe_event_id: event.id,
        organization_id: order.organization_id,
        order_id: order.id,
        event_type: String(event.type || "").slice(0, 80),
        stripe_account_id: String(event.account || "").slice(0, 80),
        outcome: String(outcome || "").slice(0, 60)
      },
      prefer: "resolution=ignore-duplicates,return=minimal"
    });
  }
}

function registerMarketplaceCheckoutRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerMarketplaceCheckoutRoutes requires ${name}`);
  }
  const { layout, brandCard, linkAction, escapeHtml, requireCustomer, getSupabaseServerConfig, supabaseHeaders, getEnv, createRateLimiter } = deps;
  const { read, write } = restClient(deps);
  const enc = encodeURIComponent;

  const page = (res, { status = 200, heading, body, sections = [] }) => res.status(status).type("html").send(layout({
    title: heading,
    eyebrow: "Creator Studio marketplace",
    heading,
    body,
    sections,
    actions: [linkAction("/account/purchases", "Your purchases"), linkAction("/marketplace", "The marketplace")]
  }));

  const money = (cents, currency) => `${(Number(cents) / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`;

  async function versionAndApprovals(organizationId, versionId) {
    const versions = await read(
      `creator_asset_versions?select=id,asset_id,version_number,source,ai_disclosure,provenance,checksum&id=eq.${enc(versionId)}&organization_id=eq.${enc(organizationId)}&limit=1`
    );
    if (!versions.ok || !versions.rows[0]) return { ok: versions.ok, version: null, approvals: null };
    const row = versions.rows[0];
    const approvals = await read(
      `creator_asset_approvals?select=state,decided_at,decided_by,created_at&asset_version_id=eq.${enc(versionId)}&organization_id=eq.${enc(organizationId)}&order=created_at.asc&limit=100`
    );
    return {
      ok: true,
      version: { id: row.id, assetId: row.asset_id, versionNumber: row.version_number, source: row.source, aiDisclosure: row.ai_disclosure, provenance: row.provenance, checksum: row.checksum },
      approvals: approvals.ok
        ? approvals.rows.map((approval) => ({ state: approval.state, decidedAt: approval.decided_at, decidedBy: approval.decided_by, createdAt: approval.created_at }))
        : null
    };
  }

  async function sellerCanBePaid(organizationId) {
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

  const refuse = (res, sentence, status = 409) => page(res, { status, heading: "Not bought", body: sentence });

  // A press on a new listing opens a Stripe Checkout session on the seller's own
  // account, so a script pressing across listings would fill strangers' Stripe
  // dashboards with abandoned sessions. (Pressing again on the same listing
  // reuses the open order and, through the idempotency key, the same session.)
  // 120 in ten minutes, per person and per address: 720 an hour, clear of the
  // 600/hour floor scripts/verify-subscription-completeness.mjs holds any limit a
  // signed-in person can meet to.
  const buyLimiter = createRateLimiter({
    name: "marketplace_buy",
    windowSeconds: 600,
    maxAttempts: 120,
    scopes: ["ip", "subject"],
    subjectFrom: (req) => req.sonaraUser?.id,
    getSupabaseServerConfig
  });

  app.post("/marketplace/:id/buy", requireCustomer, buyLimiter, async (req, res) => {
    const listingId = String(req.params.id || "");
    if (!orders.isUuid(listingId)) return refuse(res, "That listing reference is not one of ours.", 404);
    const buyerUserId = req.sonaraUser?.id;

    const ready = checkout.checkoutReadiness({ getEnv });
    if (!ready.ok) return refuse(res, "Checkout is not switched on for this marketplace yet. Nothing has been charged.", 503);

    // The one unscoped read: the listing on sale, by its id. Everything after it is
    // scoped by the seller's organization this row names.
    const found = await read(`creator_listings?select=id,organization_id,title,price_cents,currency,licence,state,rights_attested,consent_attested,version_id&id=eq.${enc(listingId)}&state=eq.listed&limit=1`);
    if (!found.ok) return refuse(res, "We could not read that listing just now. Nothing has been charged.", 503);
    const listing = found.rows[0];
    if (!listing) return refuse(res, "This is not on sale right now.", 404);
    // Whose sale this is: the seller's organization, from the listing row read
    // under the filter above -- never from the buyer's request.
    const organizationId = listing.organization_id;

    const [context, pinned, payment] = await Promise.all([
      versionAndApprovals(organizationId, listing.version_id),
      read(`creator_version_files?select=version_id,object_path&version_id=eq.${enc(listing.version_id)}&organization_id=eq.${enc(organizationId)}&limit=1`),
      sellerCanBePaid(organizationId)
    ]);
    if (!context.ok || !pinned.ok) return refuse(res, "We could not check this listing just now. Nothing has been charged.", 503);

    const decision = orders.purchaseDecision({
      listing,
      version: context.version,
      approvals: context.approvals,
      storefrontCurrency: String(listing.currency || "").toLowerCase(),
      versionFile: pinned.rows[0] || null,
      payment,
      buyerUserId
    });
    if (!decision.ok) return refuse(res, decision.sentence);

    // Release an exclusive hold whose checkout has expired and whose expiry event
    // has not arrived yet. Conditional on still being pending and past its time,
    // so a payment completing at this instant is never released.
    if (listing.licence === "exclusive_transfer") {
      await write(
        `creator_marketplace_orders?listing_id=eq.${enc(listingId)}&organization_id=eq.${enc(organizationId)}&state=eq.pending&expires_at=lt.${enc(new Date().toISOString())}`,
        { method: "PATCH", body: { state: "expired", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() } }
      );
    }

    // A buyer who already has an open order for this listing continues it: the
    // order id is the idempotency key, so Stripe hands back the same session.
    const open = await read(
      `creator_marketplace_orders?select=id,organization_id,listing_id,version_id,buyer_user_id,licence,price_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,state,expires_at&listing_id=eq.${enc(listingId)}&organization_id=eq.${enc(organizationId)}&buyer_user_id=eq.${enc(buyerUserId)}&state=in.(pending,processing)&limit=1`
    );
    if (!open.ok) return refuse(res, "We could not check your earlier orders just now. Nothing has been charged.", 503);
    let order = open.rows[0] || null;
    if (order && order.state === "processing") {
      return res.redirect(303, `/marketplace/orders/${enc(order.id)}`);
    }
    // A pending order whose checkout has run out (or is about to) cannot be
    // continued -- Stripe will not open a session that expires in the past. It is
    // closed, conditionally, and a fresh one started.
    if (order && new Date(order.expires_at).getTime() < Date.now() + 120000) {
      await write(`creator_marketplace_orders?id=eq.${enc(order.id)}&organization_id=eq.${enc(organizationId)}&state=eq.pending`, {
        method: "PATCH",
        body: { state: "expired", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      });
      order = null;
    }
    if (!order) {
      const created = await write("creator_marketplace_orders", { method: "POST", body: decision.order, prefer: "return=representation" });
      if (!created.ok) {
        // 409 from a unique index: somebody else holds the exclusive licence.
        if (created.status === 409) return refuse(res, "Somebody else is buying the exclusive licence to this right now. If their checkout lapses it becomes available again. Nothing has been charged.");
        return refuse(res, "The order could not be started. Nothing has been charged.", 503);
      }
      order = created.rows[0];
      if (!order?.id) return refuse(res, "The order could not be started. Nothing has been charged.", 503);
    }

    const origin = siteOrigin(req);
    if (!origin) return refuse(res, "This site does not know its own address, so Stripe would have nowhere to send you back. Nothing has been charged.", 503);
    const session = await checkout.createSession({ getEnv }, {
      accountId: order.stripe_account_id,
      orderId: order.id,
      fields: orders.checkoutFields({ ...decision.order, ...order, expires_at: order.expires_at || decision.order.expires_at }, {
        successUrl: `${origin}/marketplace/orders/${order.id}`,
        cancelUrl: `${origin}/marketplace/${listingId}`
      })
    });
    if (!session.ok) {
      // No checkout, so no hold: an exclusive listing must not stay reserved by an
      // order nobody can pay.
      await write(`creator_marketplace_orders?id=eq.${enc(order.id)}&organization_id=eq.${enc(organizationId)}&state=eq.pending`, {
        method: "PATCH",
        body: { state: "expired", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      });
      return refuse(res, "Stripe's checkout could not be opened just now. Nothing has been charged -- try again shortly.", 503);
    }
    const recorded = await write(`creator_marketplace_orders?id=eq.${enc(order.id)}&organization_id=eq.${enc(organizationId)}`, {
      method: "PATCH",
      body: { checkout_session_id: session.id, updated_at: new Date().toISOString() }
    });
    // Without the session id the webhook could not match the payment to the
    // order; better not to send the buyer to pay at all.
    if (!recorded.ok) return refuse(res, "The order could not be recorded, so you were not sent to pay. Nothing has been charged.", 503);
    return res.redirect(303, session.url);
  });

  async function buyerOrder(req, orderId) {
    const buyer = req.sonaraUser?.id;
    if (!orders.isUuid(orderId) || !orders.isUuid(buyer)) return { ok: true, order: null, grant: null };
    // Scoped by the buyer, never by an id alone -- another person's order id finds
    // nothing, and is answered exactly as one that does not exist.
    const found = await read(`creator_marketplace_orders?select=id,organization_id,listing_id,version_id,buyer_user_id,licence,price_cents,currency,stripe_account_id,checkout_session_id,payment_intent_id,state,title,created_at,paid_at&id=eq.${enc(orderId)}&buyer_user_id=eq.${enc(buyer)}&limit=1`);
    if (!found.ok) return { ok: false };
    const order = found.rows[0] || null;
    if (!order) return { ok: true, order: null, grant: null };
    const grants = await read(`creator_licence_grants?select=order_id,buyer_user_id,version_id,licence,granted_at,revoked_at,revoked_reason&order_id=eq.${enc(order.id)}&buyer_user_id=eq.${enc(buyer)}&limit=1`);
    if (!grants.ok) return { ok: false };
    return { ok: true, order, grant: grants.rows[0] || null };
  }

  app.get("/marketplace/orders/:orderId", requireCustomer, async (req, res) => {
    const found = await buyerOrder(req, String(req.params.orderId || ""));
    if (!found.ok) return page(res, { status: 503, heading: "Your order", body: "We could not read your order just now. That says nothing about whether you have paid -- try again shortly." });
    if (!found.order) return page(res, { status: 404, heading: "No such order", body: "There is no purchase of yours at this address." });
    const { order, grant } = found;
    const allowed = orders.downloadDecision({ order, grant, userId: req.sonaraUser.id });
    const sections = [
      brandCard("What you bought", `${escapeHtml(order.title)} -- ${escapeHtml(money(order.price_cents, order.currency))}, ${escapeHtml(String(order.licence).replace(/_/g, " "))}.`),
      brandCard("Payment", escapeHtml(orders.orderSentence(order))
        + (grant?.granted_at ? ` Licence granted ${escapeHtml(new Date(grant.granted_at).toUTCString())}.` : ""))
    ];
    if (allowed.ok) {
      sections.push(brandCard("Download", `<form method="get" action="/marketplace/orders/${escapeHtml(order.id)}/download"><button type="submit">Download your file</button></form>`
        + "<p>The link opens for two minutes each time you press it, and only for your account.</p>"));
    }
    return page(res, { heading: "Your order", body: "Landing here unlocks nothing by itself. What it shows is what Stripe has confirmed.", sections });
  });

  app.get("/marketplace/orders/:orderId/download", requireCustomer, async (req, res) => {
    const found = await buyerOrder(req, String(req.params.orderId || ""));
    if (!found.ok) return page(res, { status: 503, heading: "Download", body: "We could not check your licence just now. Try again shortly." });
    const allowed = orders.downloadDecision({ order: found.order, grant: found.grant, userId: req.sonaraUser.id });
    if (!allowed.ok) return page(res, { status: allowed.status, heading: "Download", body: allowed.sentence });

    // The file pinned to the version bought -- not the asset's current file.
    const order = found.order;
    const files = await read(`creator_version_files?select=object_path&version_id=eq.${enc(found.grant.version_id)}&organization_id=eq.${enc(order.organization_id)}&limit=1`);
    if (!files.ok) return page(res, { status: 503, heading: "Download", body: "We could not find your file just now. Your licence is unaffected -- try again shortly." });
    const file = files.rows[0];
    if (!file) return page(res, { status: 503, heading: "Download", body: "Your licence stands, but its file cannot be found. The seller has been asked nothing automatically; contact support with this order's address." });
    const signed = await storage.signedUrl(getSupabaseServerConfig(), { organizationId: order.organization_id, path: file.object_path, seconds: allowed.seconds });
    if (!signed.ok) return page(res, { status: 503, heading: "Download", body: "The file store would not open your file just now. Your licence is unaffected -- try again shortly." });
    return res.redirect(303, signed.url);
  });

  app.get("/account/purchases", requireCustomer, async (req, res) => {
    const buyer = req.sonaraUser?.id;
    const found = orders.isUuid(buyer)
      ? await read(`creator_marketplace_orders?select=id,title,price_cents,currency,licence,state,created_at&buyer_user_id=eq.${enc(buyer)}&order=created_at.desc&limit=200`)
      : { ok: false, rows: [] };
    if (!found.ok) return page(res, { heading: "Your purchases", body: "We could not read your purchases just now. That does not mean you have none -- try again shortly." });
    const sections = found.rows.length
      ? [brandCard("Purchases", "<ul>" + found.rows.map((order) =>
        `<li><a href="/marketplace/orders/${escapeHtml(order.id)}">${escapeHtml(order.title)}</a> -- ${escapeHtml(money(order.price_cents, order.currency))}, ${escapeHtml(String(order.state).replace(/_/g, " "))}</li>`).join("") + "</ul>")]
      : [brandCard("Nothing bought yet", "Licences you buy on the marketplace appear here, with their downloads.")];
    return page(res, { heading: "Your purchases", body: "Everything you have bought on the Creator Studio marketplace, and where each payment stands.", sections });
  });
}

module.exports = registerMarketplaceCheckoutRoutes;
module.exports.createConnectWebhookHandler = createConnectWebhookHandler;

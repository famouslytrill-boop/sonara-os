// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// A shop a stranger can buy from, and the owner's side of it.
//
//   GET  /business-builder/owner/store   what is on sale, what is not and why, and the orders
//   POST /api/business/storefront        name the shop, set its currency, open or close it
//   POST /api/business/storefront/publish  give it an address and publish it
//   POST /api/business/orders/status     confirm, fulfil or cancel an order
//   GET  /store/:slug                    the public shop. No account.
//   POST /store/:slug                    place an order, and pay for it on Stripe if the shop
//                                        takes payments online. No account.
//
// The receipt, paying again, and the owner's reconciliation against Stripe are in
// routes/sonara-merchant-payment-routes.cjs.
//
// Every figure is computed in lib/sonara-merchant-storefront.cjs from rows this
// file read. Nothing here prices anything, and in particular **no price comes from
// the request** -- a posted price is a buyer naming their own, and it is the oldest
// bug in online selling.
//
// ## What the owner sees that the visitor does not
//
// What is *not* on sale, and why each one is not. A shop that silently hides a
// variant nobody priced is a shop whose owner never finds out why it looks empty,
// so the owner's page lists the withheld ones with a sentence each while the public
// page simply does not show them.
//
// ## What this does not do
//
//   * **Stores no card.** AGENTS.md forbids storing raw card data or CVV. Payment,
//     when the shop takes it online, happens on Stripe's hosted page, charged to
//     the organization's own connected account (lib/sonara-connected-payments.cjs,
//     business_payment_accounts); card details never reach this application. When
//     online payment is not available the public page says so in words rather than
//     leaving a buyer to assume they have paid.
//   * **Sends nothing.** Alerts are off or explicitly user-controlled by default.
//     Placing an order writes rows; nobody is emailed.
//   * **Moves stock in two places, and nowhere else.** A version linked to a
//     stock item has that stock held when an order is placed
//     (`inventory_order_hold`, 20261006040000), so two buyers cannot both be sold
//     the last one. It comes off the shelf when the owner fulfils a confirmed
//     order (`transition_merchant_order`, 20261006035501, which also writes the
//     stock receipt). Fulfilling or cancelling settles the hold in the same
//     transaction. The database snapshots each line's stock link when the line is
//     inserted; unlinked versions move nothing.

const storefront = require("../lib/sonara-merchant-storefront.cjs");
const merchantPay = require("../lib/sonara-merchant-payments.cjs");
const stock = require("../lib/sonara-inventory-stock.cjs");
const checkout = require("../lib/sonara-connected-checkout.cjs");
const { createMerchantPayments } = require("./sonara-merchant-payment-routes.cjs");

const REQUIRED = [
  "layout", "brandCard", "linkAction", "escapeHtml",
  "requireBusinessManager", "getCustomerPrimaryOrganization",
  "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter", "getEnv"
];

const SHOP_TABLE = "merchant_storefronts";
const PRODUCT_TABLE = "merchant_products";
const VARIANT_TABLE = "merchant_product_variants";
const ORDER_TABLE = "merchant_orders";
const LINE_TABLE = "merchant_order_lines";
const STOCK_ITEM_TABLE = "inventory_items";
const STOCK_HOLD_TABLE = "inventory_reservations";

const PRODUCT_CAP = 300;
const VARIANT_CAP = 600;
const ORDER_CAP = 200;

function registerMerchantStoreRoutes(app, deps = {}) {
  for (const name of REQUIRED) {
    if (!deps[name]) throw new TypeError(`registerMerchantStoreRoutes requires ${name}`);
  }
  const {
    layout, brandCard, linkAction, escapeHtml,
    requireBusinessManager, getCustomerPrimaryOrganization,
    getSupabaseServerConfig, supabaseHeaders, createRateLimiter, getEnv
  } = deps;
  const shopPayments = createMerchantPayments(deps);
  // Whether shops on this platform can take payment online at all. Configuration,
  // read per request; whether *this* shop's Stripe account can take a charge is
  // asked live when an order is paid, not for every visitor.
  const onlinePayment = () => checkout.checkoutReadiness({ getEnv }).ok;

  const enc = encodeURIComponent;
  const OWNER_PAGE = "/business-builder/owner/store";

  async function scopeFor(req) {
    const config = getSupabaseServerConfig();
    const user = req.sonaraUser || req.sonaraCustomer?.user || req.sonaraAccess?.user || req.user || null;
    const org = await getCustomerPrimaryOrganization(user, { autoBootstrap: false }).catch(() => null);
    return {
      ok: Boolean(config?.ok && org?.organizationId),
      config,
      organizationId: org?.organizationId || null,
      userId: user?.id || null
    };
  }

  async function rest(config, path, init = {}) {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: { ...supabaseHeaders(config), ...(init.headers || {}) }
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const body = await response.json().catch(() => null);
    return { ok: Array.isArray(body), rows: Array.isArray(body) ? body : [], status: response.status };
  }

  async function write(config, path, payload, method = "POST", prefer = "return=minimal") {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { ...supabaseHeaders(config), "Content-Type": "application/json", Prefer: prefer },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
    if (!response?.ok) return { ok: false, rows: [], status: response?.status || 0 };
    const body = await response.json().catch(() => null);
    return { ok: true, rows: Array.isArray(body) ? body : [], status: response.status };
  }

  // The catalogue, scoped. Used by both sides: the owner's page passes its own
  // organization, and the public page passes the one it read off the shop.
  //
  // `category` and `sku` were selected here and shown nowhere.
  // report-unused-selected-columns.mjs named them, and they are gone rather than
  // ruled on: grouping a shop by category and showing a SKU are both reasonable
  // things to add, and the time to select the column is when something reads it.
  // `price_cents` and `product_id` stay and are read by
  // lib/sonara-merchant-storefront.cjs rather than by this file, which is recorded
  // in that script's ACCOUNTED with the lines that read them.
  async function readCatalogue(config, organizationId) {
    const orgFilter = `organization_id=eq.${enc(organizationId)}`;
    const products = await rest(config,
      `${PRODUCT_TABLE}?select=id,name,status&${orgFilter}&order=name.asc&limit=${PRODUCT_CAP}`);
    const variants = await rest(config,
      `${VARIANT_TABLE}?select=id,product_id,variant_name,price_cents,currency,status,inventory_item_id&${orgFilter}&order=variant_name.asc&limit=${VARIANT_CAP}`);
    const level = variants.ok ? await readStock(config, organizationId, variants.rows) : null;
    return { ok: products.ok && variants.ok, products: products.rows, variants: variants.rows, stock: level };
  }

  // What is available of each stock item a variant is linked to: on hand less
  // what is held for orders not yet shipped. `undefined` when nothing is linked
  // (there is nothing to read), `null` when a read failed -- storefrontFor then
  // withholds the linked variants rather than offering them blind.
  async function readStock(config, organizationId, variants) {
    const ids = [...new Set(variants.map((variant) => variant.inventory_item_id).filter(Boolean))];
    if (!ids.length) return undefined;
    const orgFilter = `organization_id=eq.${enc(organizationId)}`;
    const list = ids.map(enc).join(",");
    const items = await rest(config, `${STOCK_ITEM_TABLE}?select=id,quantity,status&${orgFilter}&id=in.(${list})&limit=${VARIANT_CAP}`);
    const held = await rest(config, `${STOCK_HOLD_TABLE}?select=inventory_item_id,quantity&${orgFilter}&state=eq.held&inventory_item_id=in.(${list})&limit=5000`);
    if (!items.ok || !held.ok) return null;
    return stock.availabilityFor({ items: items.rows, held: held.rows });
  }

  // ---------------------------------------------------------------------------
  // Forms and notices
  // ---------------------------------------------------------------------------

  const shopForm = (shop) => `
    <form action="/api/business/storefront" method="post">
      <label for="shop-headline">What is the shop called?</label>
      <input id="shop-headline" name="headline" type="text" maxlength="${storefront.NAME_MAX}" value="${escapeHtml(shop?.headline || "")}">
      <label for="shop-intro">Anything a visitor should read first</label>
      <textarea id="shop-intro" name="intro" maxlength="${storefront.NOTE_MAX}" rows="3">${escapeHtml(shop?.intro || "")}</textarea>
      <label for="shop-currency">What currency do you sell in?</label>
      <input id="shop-currency" name="currency" type="text" maxlength="8" value="${escapeHtml(shop?.currency || "usd")}">
      <fieldset>
        <legend>Are you taking orders?</legend>
        <label><input type="radio" name="accepts_orders" value="true"${shop?.accepts_orders !== false ? " checked" : ""}> Yes</label>
        <label><input type="radio" name="accepts_orders" value="false"${shop?.accepts_orders === false ? " checked" : ""}> No — people can look, but not order</label>
      </fieldset>
      <button type="submit">Save the shop</button>
    </form>`;

  const publishForm = (shop) => `
    <form action="/api/business/storefront/publish" method="post">
      <label for="shop-slug">The web address people will use: /store/…</label>
      <input id="shop-slug" name="slug" type="text" value="${escapeHtml(shop?.slug || "")}" maxlength="48" required>
      <fieldset>
        <legend>Open to the public?</legend>
        <label><input type="radio" name="enabled" value="true"${shop?.enabled === true ? " checked" : ""}> Yes, publish it</label>
        <label><input type="radio" name="enabled" value="false"${shop?.enabled !== true ? " checked" : ""}> No, keep it private</label>
      </fieldset>
      <button type="submit">Save the address</button>
    </form>`;

  const orderStatusForm = (order) => `
    <form action="/api/business/orders/status" method="post">
      <input type="hidden" name="order_id" value="${escapeHtml(order.id)}">
      <label for="status-${escapeHtml(order.id)}">Where has this order got to?</label>
      <select id="status-${escapeHtml(order.id)}" name="status">
        ${storefront.ORDER_STATUSES.map((status) =>
          `<option value="${escapeHtml(status)}"${status === order.status ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}
      </select>
      <label for="why-${escapeHtml(order.id)}">If you are cancelling, why? The buyer is owed a reason</label>
      <input id="why-${escapeHtml(order.id)}" name="reason" type="text" maxlength="${storefront.NOTE_MAX}">
      <button type="submit">Save where it has got to</button>
    </form>`;

  const DONE_SENTENCES = Object.freeze({
    shop: "Your shop is saved.",
    published: "Your shop's address is saved.",
    status: "Saved where that order has got to."
  });
  const noticeFor = (query) => {
    const done = DONE_SENTENCES[String(query?.done || "")];
    if (done) return done;
    return storefront.problemSentence(String(query?.problem || "")) || null;
  };
  const back = (params) => `${OWNER_PAGE}?${new URLSearchParams(params).toString()}`;

  // ---------------------------------------------------------------------------
  // The owner's page
  // ---------------------------------------------------------------------------

  app.get(OWNER_PAGE, requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) {
      return res.status(503).type("html").send(layout({
        title: "Your shop",
        eyebrow: "Business Builder",
        heading: "Your shop",
        body: "We could not reach your workspace just now. This is a problem on our side, and it is not telling you that you have nothing for sale.",
        sections: [],
        actions: [linkAction("/business-builder", "Business Builder")]
      }));
    }

    const orgFilter = `organization_id=eq.${enc(scope.organizationId)}`;
    const shops = await rest(scope.config,
      `${SHOP_TABLE}?select=id,slug,enabled,headline,intro,currency,accepts_orders&${orgFilter}&limit=1`);
    const catalogue = await readCatalogue(scope.config, scope.organizationId);
    const orders = await rest(scope.config,
      `${ORDER_TABLE}?select=id,buyer_name,buyer_email,status,payment_state,amount_paid_cents,refunded_cents,subtotal_cents,currency,note,created_at,cancellation_reason&${orgFilter}&order=created_at.desc&limit=${ORDER_CAP}`);
    const fulfillments = await rest(scope.config,
      `merchant_order_fulfillments?select=order_id,fulfilled_at,stock_changes&${orgFilter}&order=fulfilled_at.desc&limit=${ORDER_CAP}`);

    if (!shops.ok || !catalogue.ok || !orders.ok || !fulfillments.ok) {
      return res.status(200).type("html").send(layout({
        title: "Your shop",
        eyebrow: "Business Builder",
        heading: "Your shop",
        body: "We could not read part of your shop just now. Nothing has changed, and this is not a list of what you sell -- try again shortly.",
        sections: [],
        actions: [linkAction("/business-builder", "Business Builder")]
      }));
    }

    const shop = shops.rows[0] || null;
    const window = storefront.shopWindow(shop);
    const split = storefront.storefrontFor({ storefront: shop, products: catalogue.products, variants: catalogue.variants, stock: catalogue.stock });

    const sections = [];
    const fulfillmentByOrder = new Map(fulfillments.rows.map((receipt) => [receipt.order_id, receipt]));
    const fulfillmentEvidence = (order) => {
      const receipt = fulfillmentByOrder.get(order.id);
      if (!receipt) return order.status === "fulfilled" ? "<p>No stock-consumption receipt is recorded for this historical fulfillment.</p>" : "";
      const changes = Array.isArray(receipt.stock_changes) ? receipt.stock_changes : [];
      return `<p>Fulfillment recorded ${escapeHtml(new Date(receipt.fulfilled_at).toUTCString())}.</p>`
        + (changes.length ? "<ul>" + changes.map((change) => `<li>${escapeHtml(change.name)}: ${escapeHtml(change.quantity)} ${escapeHtml(change.unit || "each")} consumed; ${escapeHtml(change.after)} remaining.</li>`).join("") + "</ul>"
          : "<p>This order contained no tracked stock.</p>");
    };
    const notice = noticeFor(req.query);
    if (notice) sections.push(brandCard("What just happened", escapeHtml(notice)));

    sections.push(brandCard("Where your shop stands", [
      `<p>${escapeHtml(window.sentence)}</p>`,
      shop?.slug
        ? `<p>Its address is /store/${escapeHtml(shop.slug)}.</p>`
        : "<p>It has no address yet, so it cannot be published.</p>",
      `<p>${escapeHtml(split.reason)}</p>`
    ].join("")));

    if (split.offered.length) {
      sections.push(brandCard(
        `On sale (${split.offered.length})`,
        "<ul>" + split.offered.map((entry) =>
          `<li>${escapeHtml(entry.product.name)}${entry.variant.variant_name ? ` — ${escapeHtml(entry.variant.variant_name)}` : ""}: `
          + `${escapeHtml(storefront.money(entry.offer.priceCents, entry.offer.currency))}`
          + `${Number.isInteger(entry.available) ? ` — ${escapeHtml(String(entry.available))} available` : ""}</li>`).join("") + "</ul>"
      ));
    }

    // The half a visitor never sees. A shop that hides what it cannot sell is a
    // shop whose owner never finds out why it looks empty, so every withheld
    // variant gets its reason printed here.
    if (split.withheld.length) {
      sections.push(brandCard(
        `Not on sale, and why (${split.withheld.length})`,
        "<p>These are in your catalogue and are not being offered. Each line says what would change that.</p><ul>"
        + split.withheld.map((entry) => `<li>${escapeHtml(entry.reason)}</li>`).join("") + "</ul>"
      ));
    }

    if (orders.rows.length) {
      sections.push(brandCard(
        `Orders (${orders.rows.length})`,
        orders.rows.map((order) => [
          `<p>${escapeHtml(order.buyer_name)} (${escapeHtml(order.buyer_email)}) — ${escapeHtml(order.status)}, `
          + `${escapeHtml(storefront.money(Number(order.subtotal_cents) || 0, order.currency))}`
          // The date, because an owner looking at an order needs to know when it
          // came in. It was selected and shown nowhere until
          // report-unused-selected-columns.mjs said so.
          + `${order.created_at ? `, placed ${escapeHtml(new Date(order.created_at).toUTCString())}` : ", no date recorded"}</p>`,
          `<p>Payment: ${escapeHtml(PAYMENT_STATE_WORDS[order.payment_state] || "not recorded")}`
          + `${Number.isInteger(order.amount_paid_cents) ? ` — ${escapeHtml(storefront.money(order.amount_paid_cents, order.currency))} taken` : ""}`
          + `${Number(order.refunded_cents) > 0 ? `, ${escapeHtml(storefront.money(Number(order.refunded_cents), order.currency))} refunded` : ""}.</p>`,
          order.note ? `<p>They said: ${escapeHtml(order.note)}</p>` : "",
          order.cancellation_reason ? `<p>Cancelled because: ${escapeHtml(order.cancellation_reason)}</p>` : "",
          fulfillmentEvidence(order),
          orderStatusForm(order)
        ].join("")).join("")
      ));
    } else {
      sections.push(brandCard("No orders yet", "Nothing has been ordered. Publishing the shop and giving somebody its address is what starts that."));
    }

    // Said plainly, because a shop owner would otherwise reasonably assume the
    // opposite.
    sections.push(brandCard(
      "How buyers pay",
      onlinePayment()
        ? "When your Stripe account can take charges, a buyer who places an order goes straight to Stripe's checkout and pays your account directly -- SONARA takes no commission, and card details are typed on Stripe's page, never here. "
          + `<a href="/business-builder/owner/store/reconciliation">Check every payment against Stripe</a>. Refunds are issued in your Stripe dashboard and appear here when Stripe reports them.`
        : "Online payment is not switched on for shops on this platform yet, so no card details are typed here or stored. An order records what somebody wants, and you collect the money the way you already do."
    ));
    sections.push(brandCard(
      "Stock and fulfillment",
      "Placing an order holds any linked stock, so the last one cannot be sold twice. Confirm the order, then mark it fulfilled when the goods are handed over: fulfillment takes the stock off the shelf and saves a stock receipt in one transaction, and cancelling first gives the held stock back. Online orders need verified full payment; for offline orders, collect payment separately. Fulfilled orders cannot be cancelled here, and refunds do not put goods back into stock. This shop does not email the buyer."
    ));

    sections.push(brandCard("Name your shop", shopForm(shop)));
    sections.push(brandCard("Its address", publishForm(shop)));

    return res.status(200).type("html").send(layout({
      title: "Your shop",
      eyebrow: "Business Builder",
      heading: "Your shop",
      body: "What is on sale, what is not and why, and every order that has come in. Nothing is public until you publish it.",
      sections,
      actions: [linkAction("/business-builder", "Business Builder"), linkAction("/business-builder/owner/products", "Your products")]
    }));
  });

  // ---------------------------------------------------------------------------
  // Owner writes
  // ---------------------------------------------------------------------------

  // One row per organization, so this is an upsert rather than an insert. Written
  // through on_conflict so two presses do not make "the shop" ambiguous -- the
  // unique index would refuse the second anyway, and this turns that into a save
  // rather than a failure.
  async function upsertShop(scope, patch) {
    const existing = await rest(scope.config,
      `${SHOP_TABLE}?select=id&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!existing.ok) return { ok: false };
    if (existing.rows.length) {
      return write(
        scope.config,
        `${SHOP_TABLE}?id=eq.${enc(existing.rows[0].id)}&organization_id=eq.${enc(scope.organizationId)}`,
        { ...patch, updated_at: new Date().toISOString() },
        "PATCH"
      );
    }
    return write(scope.config, SHOP_TABLE, {
      organization_id: scope.organizationId,
      created_by: scope.userId,
      ...patch
    });
  }

  app.post("/api/business/storefront", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const saved = await upsertShop(scope, {
      headline: String(req.body?.headline || "").trim().slice(0, storefront.NAME_MAX) || null,
      intro: String(req.body?.intro || "").trim().slice(0, storefront.NOTE_MAX) || null,
      currency: String(req.body?.currency || "usd").trim().toLowerCase().slice(0, 8) || "usd",
      // Only an explicit "false" closes it. An absent field leaves it open rather
      // than closing a working shop because a form was posted without the radio.
      accepts_orders: String(req.body?.accepts_orders || "true") !== "false"
    });
    return res.redirect(303, back(saved.ok ? { done: "shop" } : { problem: "save_failed" }));
  });

  app.post("/api/business/storefront/publish", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const slug = String(req.body?.slug || "").trim().toLowerCase();
    if (!storefront.SLUG_PATTERN.test(slug)) return res.redirect(303, back({ problem: "slug_shape" }));

    // Somebody else may hold this address. The unique index would refuse the write
    // anyway; this turns that into a sentence rather than a failed save with no
    // explanation.
    const taken = await rest(scope.config, `${SHOP_TABLE}?select=organization_id&slug=eq.${enc(slug)}&limit=1`);
    if (!taken.ok) return res.redirect(303, back({ problem: "save_failed" }));
    if (taken.rows.length && taken.rows[0].organization_id !== scope.organizationId) {
      return res.redirect(303, back({ problem: "slug_taken" }));
    }

    const saved = await upsertShop(scope, {
      slug,
      // Only an explicit "true" publishes. A posted form missing the radio must not
      // put a shop on a public URL.
      enabled: String(req.body?.enabled || "") === "true"
    });
    return res.redirect(303, back(saved.ok ? { done: "published" } : { problem: "save_failed" }));
  });

  app.post("/api/business/orders/status", requireBusinessManager, async (req, res) => {
    const scope = await scopeFor(req);
    if (!scope.ok) return res.redirect(303, back({ problem: "save_failed" }));

    const orderId = String(req.body?.order_id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!orderId) return res.redirect(303, back({ problem: "order_missing" }));
    if (!storefront.ORDER_STATUSES.includes(status)) return res.redirect(303, back({ problem: "status_unknown" }));

    const owned = await rest(scope.config,
      `${ORDER_TABLE}?select=id&id=eq.${enc(orderId)}&organization_id=eq.${enc(scope.organizationId)}&limit=1`);
    if (!owned.ok || !owned.rows.length) return res.redirect(303, back({ problem: "order_missing" }));

    // The RPC locks the owned order and commits stock, its receipt and status
    // together. No fallback PATCH: that would report fulfillment without stock.
    const response = await fetch(`${scope.config.url}/rest/v1/rpc/transition_merchant_order`, {
      method: "POST",
      headers: { ...supabaseHeaders(scope.config), "Content-Type": "application/json" },
      body: JSON.stringify({
        p_organization_id: scope.organizationId, p_order_id: orderId, p_actor_id: scope.userId,
        p_status: status, p_reason: String(req.body?.reason || "").trim().slice(0, storefront.NOTE_MAX),
        p_require_paid: onlinePayment()
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    const saved = response?.ok && result?.ok === true && result.status === status
      && typeof result.noop === "boolean";
    const knownProblems = ["order_missing", "status_unknown", "status_transition_invalid", "payment_not_ready",
      "order_lines_missing", "inventory_snapshot_missing", "inventory_unavailable", "stock_insufficient"];
    const problem = knownProblems.includes(result?.message) ? result.message : "save_failed";
    return res.redirect(303, back(saved ? { done: "status" } : { problem }));
  });

  // ---------------------------------------------------------------------------
  // The public shop
  // ---------------------------------------------------------------------------

  const publicPage = ({ heading, body, sections = [], status = 200 }) => ({
    status,
    html: layout({
      title: heading,
      eyebrow: "Shop",
      heading,
      body,
      sections,
      actions: [linkAction("/", "SONARA One")]
    })
  });

  const notFound = (res) => {
    const page = publicPage({
      heading: "No such shop",
      body: "This address does not match a published shop. It may never have been published, or the owner may have changed it.",
      status: 404
    });
    return res.status(page.status).type("html").send(page.html);
  };

  const unavailable = (res) => {
    const page = publicPage({
      heading: "We cannot reach this just now",
      body: "This is a problem on our side rather than anything to do with the shop. Nothing has changed -- try again shortly.",
      status: 503
    });
    return res.status(page.status).type("html").send(page.html);
  };

  // One published shop by slug. `enabled=eq.true`: a shop that was never published
  // is not reachable by guessing addresses, and unlike a cancelled event there is
  // nobody holding a link to an unpublished shop who needs to be told anything.
  async function findPublicShop(config, slug) {
    const found = await rest(config,
      `${SHOP_TABLE}?select=id,organization_id,slug,enabled,headline,intro,currency,accepts_orders`
      + `&slug=eq.${enc(slug)}&enabled=eq.true&limit=1`);
    if (!found.ok) return { ok: false, shop: null };
    return { ok: true, shop: found.rows[0] || null };
  }

  const orderForm = (slug, offered) => `
    <form action="/store/${escapeHtml(slug)}" method="post">
      ${offered.map((entry) => `
      <label for="qty-${escapeHtml(entry.variant.id)}">
        ${escapeHtml(entry.product.name)}${entry.variant.variant_name ? ` — ${escapeHtml(entry.variant.variant_name)}` : ""}
        at ${escapeHtml(storefront.money(entry.offer.priceCents, entry.offer.currency))}: how many?
      </label>
      <input id="qty-${escapeHtml(entry.variant.id)}" name="qty_${escapeHtml(entry.variant.id)}" type="number" min="0" max="${Number.isInteger(entry.available) ? Math.min(entry.available, storefront.QUANTITY_MAX) : storefront.QUANTITY_MAX}" value="0">${Number.isInteger(entry.available) ? ` <span>${escapeHtml(String(entry.available))} left</span>` : ""}`).join("")}
      <label for="buyer-name">Your name</label>
      <input id="buyer-name" name="buyer_name" type="text" maxlength="${storefront.NAME_MAX}" required>
      <label for="buyer-email">Your email, so the shop can reach you</label>
      <input id="buyer-email" name="buyer_email" type="email" maxlength="320" required>
      <label for="buyer-note">Anything the shop should know</label>
      <input id="buyer-note" name="note" type="text" maxlength="${storefront.NOTE_MAX}">
      <button type="submit">Place this order</button>
    </form>`;

  // Said on every public shop page and again on the confirmation. A buyer who has
  // just pressed "Place this order" would otherwise reasonably believe they have
  // paid for something.
  const PAYMENT_SENTENCE =
    "Nothing is charged here and no card details are asked for or stored. "
    + "This sends the shop what you want and how to reach you; they will tell you how to pay.";
  const ONLINE_PAYMENT_SENTENCE =
    "If this shop takes payments online, placing the order takes you to Stripe's checkout to pay the shop directly; "
    + "card details are typed on Stripe's page, never here. If it does not, the shop will tell you how to pay.";
  const paymentSentence = () => (onlinePayment() ? ONLINE_PAYMENT_SENTENCE : PAYMENT_SENTENCE);
  const PAYMENT_STATE_WORDS = Object.freeze({
    unpaid: "not paid",
    checkout_open: "checkout open, not paid yet",
    processing: "payment on its way",
    paid: "paid",
    refunded: "refunded",
    disputed: "disputed"
  });

  function shopSections({ slug, split, window, offered }) {
    const sections = [];
    if (!split.ok) {
      sections.push(brandCard("We could not read this shop", split.reason));
      return sections;
    }
    if (!offered.length) {
      sections.push(brandCard("Nothing is on sale here yet", "The shop is open but has nothing priced and active. That is the shop's own doing rather than a fault."));
    } else if (window.open) {
      sections.push(brandCard("What is for sale", orderForm(slug, offered)));
    } else {
      sections.push(brandCard(
        "Not taking orders",
        `${escapeHtml(window.sentence)} ` + "<ul>" + offered.map((entry) =>
          `<li>${escapeHtml(entry.product.name)}${entry.variant.variant_name ? ` — ${escapeHtml(entry.variant.variant_name)}` : ""}: `
          + `${escapeHtml(storefront.money(entry.offer.priceCents, entry.offer.currency))}</li>`).join("") + "</ul>"
      ));
    }
    sections.push(brandCard("How paying works", paymentSentence()));
    return sections;
  }

  async function loadShopPage(config, slug) {
    const found = await findPublicShop(config, slug);
    if (!found.ok) return { ok: false, missing: false };
    if (!found.shop) return { ok: true, missing: true };
    const catalogue = await readCatalogue(config, found.shop.organization_id);
    const split = storefront.storefrontFor({
      storefront: found.shop,
      products: catalogue.ok ? catalogue.products : null,
      stock: catalogue.ok ? catalogue.stock : null,
      variants: catalogue.ok ? catalogue.variants : null
    });
    // `offered` is [] both when nothing is on sale and when the catalogue could not
    // be read, so **it must never be read without `split.ok` beside it**. Both
    // callers check `split.ok` first -- the GET renders split.reason through
    // shopSections, and the POST refuses at line 551 before pricing anything -- and
    // that ordering is the only reason the ambiguity is harmless.
    //
    // Written down because the identical inference was a real defect elsewhere the
    // same day: lib/sonara-creator-approval-graph.cjs treated a missing group as a
    // failed read, and the page told a creator their versions could not be read when
    // the asset simply had none. Here it would fail the safe way -- priceOrder would
    // answer "nothing ordered" rather than claiming something false -- but "safe
    // because of a check in another function" is a reason that is invisible from
    // here, so it is now visible from here.
    return {
      ok: true,
      missing: false,
      shop: found.shop,
      split,
      window: storefront.shopWindow(found.shop),
      offered: split.ok ? split.offered : []
    };
  }

  app.get("/store/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!storefront.SLUG_PATTERN.test(slug)) return notFound(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const loaded = await loadShopPage(config, slug);
    if (!loaded.ok) return unavailable(res);
    if (loaded.missing) return notFound(res);

    const page = publicPage({
      heading: String(loaded.shop.headline || "").trim() || "A shop",
      body: String(loaded.shop.intro || "").trim() || "Everything below is what this shop sells, at the price they set.",
      sections: shopSections({ slug, split: loaded.split, window: loaded.window, offered: loaded.offered })
    });
    return res.status(page.status).type("html").send(page.html);
  });

  // Five an hour from one address. An order form is a write endpoint open to the
  // internet; the ceiling is where a real person buying stays under it and a script
  // does not. Same figure as the booking and RSVP forms, which are the same shape
  // of risk.
  const orderLimiter = createRateLimiter({
    name: "public_store_order",
    windowSeconds: 3600,
    maxAttempts: 5,
    scopes: ["ip"],
    getSupabaseServerConfig
  });

  app.post("/store/:slug", orderLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!storefront.SLUG_PATTERN.test(slug)) return notFound(res);

    const config = getSupabaseServerConfig();
    if (!config?.ok) return unavailable(res);

    const loaded = await loadShopPage(config, slug);
    if (!loaded.ok) return unavailable(res);
    if (loaded.missing) return notFound(res);

    const refuse = (sentence, status) => {
      const page = publicPage({
        heading: String(loaded.shop.headline || "").trim() || "A shop",
        body: sentence,
        sections: shopSections({ slug, split: loaded.split, window: loaded.window, offered: loaded.offered }),
        status
      });
      return res.status(page.status).type("html").send(page.html);
    };

    if (!loaded.window.open) return refuse(loaded.window.sentence, 409);
    if (!loaded.split.ok) return refuse(loaded.split.reason, 503);

    const buyer = storefront.normalizeBuyer(req.body || {});
    if (!buyer.ok) return refuse(storefront.problemSentence(buyer.problems[0]) || "We could not read what you typed.", 400);

    // The prices come from `loaded.offered`, which this server read. The form
    // supplies quantities and nothing else -- a posted price is a buyer naming
    // their own.
    const priced = storefront.priceOrder({
      offered: loaded.offered,
      quantities: storefront.quantitiesFrom(req.body || {}),
      currency: loaded.shop.currency
    });
    if (!priced.ok) return refuse(storefront.problemSentence(priced.problems[0]) || "We could not price that order.", 400);

    // The buyer's key to their receipt. Only its hash is stored; the token itself
    // is in the receipt's address and nowhere else.
    const receiptKey = merchantPay.newBuyerToken();
    const created = await write(config, ORDER_TABLE, {
      organization_id: loaded.shop.organization_id,
      storefront_id: loaded.shop.id,
      buyer_token_hash: receiptKey.hash,
      buyer_name: buyer.buyer.buyerName,
      buyer_email: buyer.buyer.buyerEmail,
      status: "placed",
      subtotal_cents: priced.subtotalCents,
      currency: priced.currency,
      note: buyer.buyer.note
    }, "POST", "return=representation");

    if (!created.ok || !created.rows.length) {
      return refuse("That did not save. Nothing has been ordered and nothing has been charged -- it is worth trying again shortly.", 503);
    }
    const orderId = created.rows[0].id;

    const lines = await write(config, LINE_TABLE, priced.lines.map((line) => ({
      organization_id: loaded.shop.organization_id,
      order_id: orderId,
      variant_id: line.variantId,
      description: line.description,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      line_total_cents: line.lineTotalCents,
      currency: line.currency
    })));

    if (!lines.ok) {
      // The order row exists and its lines do not. Said plainly rather than
      // reported as success: a total with nothing behind it is the kind of record
      // that gets argued about later, and the owner can see the order and ask.
      const page = publicPage({
        heading: String(loaded.shop.headline || "").trim() || "A shop",
        body: "Your order reached the shop but we could not record what was in it. Nothing has been charged. Please contact the shop with what you wanted, and quote your name -- they can see that an order came in.",
        sections: [brandCard("How paying works", PAYMENT_SENTENCE)],
        status: 503
      });
      return res.status(page.status).type("html").send(page.html);
    }

    // Hold the stock, or refuse the order. The stock function is the one that says
    // yes or no -- under the order and item row locks fulfilment also takes, so two
    // buyers cannot both take the last one. A refusal, or a check that could not run, cancels the order rather
    // than leaving a placed order nothing is held for, and no checkout is opened.
    const held = await stock.holdOrderStock(config, supabaseHeaders, { organizationId: loaded.shop.organization_id, orderId });
    if (!held.ok) {
      const short = held.code === "insufficient_stock";
      await write(config, `${ORDER_TABLE}?id=eq.${enc(orderId)}&organization_id=eq.${enc(loaded.shop.organization_id)}`, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: short ? "Sold out before the order could be held." : "The stock check could not run, so the order was not taken.",
        updated_at: new Date().toISOString()
      }, "PATCH");
      return refuse(short ? stock.shortageSentence(held) : storefront.problemSentence("stock_unavailable"), short ? 409 : 503);
    }

    const receiptPath = `/store/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderId)}?t=${encodeURIComponent(receiptKey.token)}`;
    // Paying now, if this platform takes payment online and this shop's Stripe
    // account can be charged. Anything short of a checkout URL leaves the order
    // placed and unpaid, and the buyer is told which and why.
    let payingSentence = PAYMENT_SENTENCE;
    if (onlinePayment()) {
      const fresh = await shopPayments.orderForCheckout(loaded.shop.organization_id, orderId);
      const opened = fresh.ok && fresh.order
        ? await shopPayments.openCheckout({ order: fresh.order, lines: fresh.lines, slug, token: receiptKey.token, req })
        : { ok: false, sentence: "We could not open the payment just now. Nothing has been charged -- you can pay from your receipt." };
      if (opened.ok) return res.redirect(303, opened.url);
      payingSentence = opened.sentence;
    }

    const page = publicPage({
      heading: String(loaded.shop.headline || "").trim() || "A shop",
      body: `Your order is with the shop: ${priced.reason}`,
      sections: [
        brandCard("What you ordered", "<ul>" + priced.lines.map((line) =>
          `<li>${escapeHtml(String(line.quantity))} × ${escapeHtml(line.description)} — `
          + `${escapeHtml(storefront.money(line.lineTotalCents, line.currency))}</li>`).join("") + "</ul>"),
        brandCard("How paying works", escapeHtml(payingSentence)),
        brandCard("Your receipt", `<a href="${escapeHtml(receiptPath)}">Your order and its receipt</a> -- keep this link; it is the only way back to this order.`)
      ]
    });
    return res.status(page.status).type("html").send(page.html);
  });
}

module.exports = registerMerchantStoreRoutes;

"use strict";

// A storefront order paid on the shop's own Stripe account, end to end.
//
// Order -> Stripe Checkout (direct charge, the shop's account) -> signed Connect
// webhook -> paid -> receipt -> refund recorded -> reconciliation against Stripe's
// own record -> repair of a payment whose webhook never arrived.
//
// The buyer's half runs through server.js as deployed: the real order form, the
// real Connect webhook (mounted raw, before the body parsers, dispatched by
// sonara_kind), the real signature check and the runtime tenant guard in front of
// an in-memory Supabase. The owner's reconciliation runs through the real route
// module with only the business-manager middleware replaced, still behind the
// guard. Stripe's API is the one thing stubbed, and every call to it is recorded.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");

const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const SHOP = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "66666666-6666-4666-8666-666666666666";
const VARIANT = "77777777-7777-4777-8777-777777777777";
const ACCOUNT = "acct_shop12345678";
const SECRET = "whsec_localfixture0123456789";
const SUPABASE = "https://project.supabase.co";

const ENV = Object.freeze({
  SUPABASE_URL: SUPABASE,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-placeholder",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_local_fixture_not_a_secret",
  STRIPE_CONNECT_WEBHOOK_SECRET: SECRET,
  NEXT_PUBLIC_SITE_URL: "https://sonara.example"
});

function seed({ chargesEnabled = true } = {}) {
  return {
    merchant_storefronts: [{ id: SHOP, organization_id: ORG, slug: "corner-shop", enabled: true, headline: "The Corner Shop", intro: "Things we make.", currency: "usd", accepts_orders: true }],
    merchant_products: [{ id: PRODUCT, organization_id: ORG, name: "Mug", status: "active" }],
    merchant_product_variants: [{ id: VARIANT, product_id: PRODUCT, organization_id: ORG, variant_name: "Large", price_cents: 1200, currency: "usd", status: "active" }],
    business_payment_accounts: [{ id: "bpa1", organization_id: ORG, stripe_account_id: ACCOUNT, disconnected_at: null, charges_enabled: chargesEnabled, payouts_enabled: true, details_submitted: true, state_checked_at: null }]
  };
}

let app;
let savedEnv;
let savedFetch;
let clientNumber = 0;
const nextClient = () => `198.51.100.${(clientNumber += 1) % 250}`;

function world({ env = {}, chargesEnabled = true, expireFails = false, sessions = [] } = {}) {
  for (const [key, value] of Object.entries({ ...ENV, ...env })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const fake = createFakeSupabase({
    url: SUPABASE,
    ids: "uuid",
    defaults: {
      merchant_orders: { payment_state: "unpaid", checkout_attempts: 0, refunded_cents: 0, status: "placed", created_at: () => new Date().toISOString() },
      merchant_order_lines: { created_at: () => new Date().toISOString() }
    },
    unique: { merchant_order_payment_events: [{ name: "merchant_order_payment_events_pkey", columns: ["stripe_event_id"] }] },
    tables: seed({ chargesEnabled })
  });
  const stripe = [];
  const stored = new Map(sessions.map((session) => [session.id, session]));
  let count = 0;
  async function outside(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url);
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (url.hostname !== "api.stripe.com") throw new Error(`refused a request to ${url.origin}`);
    const body = init.body ? new URLSearchParams(init.body) : null;
    stripe.push({ path: url.pathname, query: url.search, method: init.method || "GET", headers: init.headers || {}, body });
    if (url.pathname === `/v1/accounts/${ACCOUNT}`) return json({ id: ACCOUNT, charges_enabled: chargesEnabled, payouts_enabled: true, details_submitted: true });
    if (url.pathname === "/v1/checkout/sessions" && init.method === "POST") {
      count += 1;
      const id = `cs_test_shop${count}abc`;
      const session = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: "open", metadata: { sonara_order_id: body.get("metadata[sonara_order_id]"), sonara_kind: body.get("metadata[sonara_kind]") } };
      stored.set(id, session);
      return json(session);
    }
    if (url.pathname === "/v1/checkout/sessions" && (init.method || "GET") === "GET") {
      return json({ data: [...stored.values()].filter((session) => session.payment_status), has_more: false });
    }
    const match = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/);
    if (match) {
      const session = stored.get(match[1]);
      if (!session) return json({ error: { message: "No such session" } }, 404);
      if (match[2]) return expireFails ? json({ error: { message: "already complete" } }, 400) : json({ ...session, status: "expired" });
      return json(session);
    }
    return json({ error: { message: "not modelled" } }, 404);
  }
  global.fetch = fake.install(outside);
  return { fake, stripe, stored };
}

function signed(event, secret = SECRET) {
  // Indented, as Stripe sends it -- a compact body survives re-serialisation and
  // would hide a webhook mounted behind express.json.
  const body = JSON.stringify(event, null, 2);
  const timestamp = Math.floor(Date.now() / 1000);
  return { body, header: `t=${timestamp},v1=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}` };
}
const deliver = (event) => {
  const message = signed(event);
  return request(app).post("/api/webhooks/stripe-connect").set("content-type", "application/json")
    .set("stripe-signature", message.header).set("x-forwarded-for", nextClient()).send(message.body);
};

const placeOrder = (form = {}) => request(app).post("/store/corner-shop").type("form").set("accept", "text/html").set("x-forwarded-for", nextClient())
  .send({ [`qty_${VARIANT}`]: "2", buyer_name: "Ada Buyer", buyer_email: "ada@example.com", ...form });

function tokenFrom(location) {
  return new URL(location).searchParams.get("t");
}

function completed(order, overrides = {}, eventOverrides = {}) {
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, "")}`,
    type: "checkout.session.completed",
    account: ACCOUNT,
    data: { object: {
      id: order.checkout_session_id, client_reference_id: order.id,
      metadata: { sonara_order_id: order.id, sonara_kind: "merchant_order" },
      amount_total: order.subtotal_cents, currency: "usd", payment_status: "paid", payment_intent: "pi_shoppay12345678",
      ...overrides
    } },
    ...eventOverrides
  };
}

describe("a storefront order is paid on the shop's own account", function storefrontPayment() {
  this.timeout(30000);

  before(() => {
    savedFetch = global.fetch;
    savedEnv = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
    app = require("../server");
  });
  afterEach(() => { global.fetch = savedFetch; });
  after(() => {
    global.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe("the buyer", () => {
    it("is sent to Stripe on the shop's account for the server's price, with a receipt only they can open", async () => {
      const { fake, stripe } = world();
      const response = await placeOrder({ price_cents: "1", unit_price_cents: "1", subtotal_cents: "1" });
      assert.equal(response.status, 303, response.text);
      assert.match(response.headers.location, /^https:\/\/checkout\.stripe\.com\//);

      const [order] = fake.rows("merchant_orders");
      assert.deepEqual([order.subtotal_cents, order.payment_state, order.stripe_account_id, order.checkout_attempts], [2400, "checkout_open", ACCOUNT, 1]);
      assert.match(order.buyer_token_hash, /^[a-f0-9]{64}$/);
      assert.match(order.checkout_session_id, /^cs_test_/);

      const session = stripe.find((call) => call.path === "/v1/checkout/sessions" && call.method === "POST");
      assert.equal(session.headers["Stripe-Account"], ACCOUNT, "charged on the platform rather than the shop");
      assert.equal(session.headers["Idempotency-Key"], `sonara-merchant-order-${order.id}-1`);
      assert.equal(session.body.get("line_items[0][price_data][unit_amount]"), "1200");
      assert.equal(session.body.get("line_items[0][quantity]"), "2");
      assert.equal(session.body.get("metadata[sonara_kind]"), "merchant_order");
      assert.deepEqual([...session.body.keys()].filter((key) => /application_fee|transfer_data/.test(key)), []);

      // The receipt address carries the token; the database holds only its hash.
      const token = tokenFrom(session.body.get("success_url"));
      assert.equal(crypto.createHash("sha256").update(token).digest("hex"), order.buyer_token_hash);
      assert.ok(!JSON.stringify(fake.rows("merchant_orders")).includes(token), "the raw receipt token was stored");
    });

    it("cannot open somebody else's receipt with a wrong token, and is told nothing about it", async () => {
      const { fake, stripe } = world();
      await placeOrder();
      const [order] = fake.rows("merchant_orders");
      const token = tokenFrom(stripe.find((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").body.get("success_url"));
      const own = await request(app).get(`/store/corner-shop/orders/${order.id}?t=${token}`).set("x-forwarded-for", nextClient());
      assert.equal(own.status, 200);
      assert.match(own.text, /A checkout is open for this order/);
      assert.match(own.text, /Ada Buyer/);
      assert.match(own.text, /Pay 24\.00 USD on Stripe/, "an unpaid receipt offers no way to pay");
      const wrong = await request(app).get(`/store/corner-shop/orders/${order.id}?t=${"x".repeat(32)}`).set("x-forwarded-for", nextClient());
      const missing = await request(app).get(`/store/corner-shop/orders/${crypto.randomUUID()}?t=${token}`).set("x-forwarded-for", nextClient());
      assert.equal(wrong.status, 404);
      assert.equal(missing.status, 404);
      assert.equal(wrong.text, missing.text);
      assert.doesNotMatch(wrong.text, /Ada Buyer/);
    });

    it("is paid by a signed webhook, once, however often it arrives, and the receipt says so", async () => {
      const { fake, stripe } = world();
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      const event = completed(open);
      const first = await deliver(event);
      assert.equal(first.status, 200, first.text);
      assert.equal(first.body.outcome, "paid");
      assert.equal((await deliver(event)).status, 200);

      const [order] = fake.rows("merchant_orders");
      assert.deepEqual([order.payment_state, order.amount_paid_cents, order.payment_intent_id], ["paid", 2400, "pi_shoppay12345678"]);
      assert.ok(order.paid_at);
      assert.equal(fake.rows("merchant_order_payment_events").length, 1, "a replayed event was recorded twice");

      const token = tokenFrom(stripe.find((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").body.get("success_url"));
      const receipt = await request(app).get(`/store/corner-shop/orders/${order.id}?t=${token}`).set("x-forwarded-for", nextClient());
      assert.match(receipt.text, /Paid\. This page is your receipt/);
      assert.match(receipt.text, /pi_shoppay12345678/);
      assert.doesNotMatch(receipt.text, /Pay 24\.00 USD on Stripe/, "a paid receipt still offers to take the money again");
    });

    for (const [why, overrides, eventOverrides] of [
      ["from another Stripe account", {}, { account: "acct_someoneelse99" }],
      ["for a different amount", { amount_total: 100 }, {}],
      ["for another order", { client_reference_id: "88888888-8888-4888-8888-888888888888" }, {}],
      ["that has not been paid", { payment_status: "unpaid" }, {}]
    ]) {
      it(`is not marked paid by a genuinely signed event ${why}`, async () => {
        const { fake } = world();
        await placeOrder();
        const [open] = fake.rows("merchant_orders");
        assert.equal((await deliver(completed(open, overrides, eventOverrides))).status, 200);
        assert.notEqual(fake.rows("merchant_orders")[0].payment_state, "paid");
      });
    }

    it("retries a failed payment audit write while keeping the payment idempotent", async () => {
      const { fake } = world();
      await placeOrder();
      const [order] = fake.rows("merchant_orders");
      const event = completed(order);
      const inner = global.fetch;
      let failures = 0;
      global.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === "string" ? input : input.url);
        if (!failures && url.pathname === "/rest/v1/merchant_order_payment_events" && init.method === "POST") {
          failures += 1;
          return { ok: false, status: 503, json: async () => [], text: async () => "unavailable" };
        }
        return inner(input, init);
      };
      assert.equal((await deliver(event)).status, 503);
      assert.equal(failures, 1);
      assert.equal(fake.rows("merchant_orders")[0].payment_state, "paid");
      assert.equal(fake.rows("merchant_order_payment_events").length, 0);
      assert.equal((await deliver(event)).status, 200);
      assert.equal(fake.rows("merchant_order_payment_events").length, 1);
      assert.equal(fake.rows("merchant_orders")[0].amount_paid_cents, order.subtotal_cents);
    });

    it("sees a partial refund and then a full one recorded, and a late smaller one changes nothing", async () => {
      const { fake } = world();
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      await deliver(completed(open));
      const refund = (amount, refunded, id) => deliver({ id, type: "charge.refunded", account: ACCOUNT, data: { object: { payment_intent: "pi_shoppay12345678", amount_refunded: amount, refunded } } });
      await refund(1000, false, "evt_partialshop1");
      assert.deepEqual([fake.rows("merchant_orders")[0].payment_state, fake.rows("merchant_orders")[0].refunded_cents], ["paid", 1000]);
      await refund(2400, true, "evt_fullshop1");
      assert.deepEqual([fake.rows("merchant_orders")[0].payment_state, fake.rows("merchant_orders")[0].refunded_cents], ["refunded", 2400]);
      await refund(1000, false, "evt_lateshop1");
      assert.equal(fake.rows("merchant_orders")[0].refunded_cents, 2400, "an older refund event shrank what was refunded");
    });

    it("can pay again after the checkout expires, as a new attempt with its own key", async () => {
      const { fake, stripe } = world();
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      const token = tokenFrom(stripe.find((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").body.get("success_url"));
      await deliver({ id: "evt_expiredshop1", type: "checkout.session.expired", account: ACCOUNT, data: { object: { id: open.checkout_session_id, client_reference_id: open.id, metadata: { sonara_order_id: open.id, sonara_kind: "merchant_order" } } } });
      assert.equal(fake.rows("merchant_orders")[0].payment_state, "unpaid");
      const again = await request(app).post(`/store/corner-shop/orders/${open.id}/pay`).type("form").send({ t: token }).set("x-forwarded-for", nextClient());
      assert.equal(again.status, 303);
      const keys = stripe.filter((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").map((call) => call.headers["Idempotency-Key"]);
      assert.deepEqual(keys, [`sonara-merchant-order-${open.id}-1`, `sonara-merchant-order-${open.id}-2`]);
    });

    it("expires a checkout about to run out before opening another, and opens none if the old one was paid", async () => {
      const { fake, stripe } = world({ expireFails: true });
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      const token = tokenFrom(stripe.find((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").body.get("success_url"));
      // Nearly expired, and Stripe says it cannot be expired because it completed.
      await fetch(`${SUPABASE}/rest/v1/merchant_orders?id=eq.${open.id}&organization_id=eq.${ORG}`, { method: "PATCH", headers: {}, body: JSON.stringify({ checkout_expires_at: new Date(Date.now() + 30000).toISOString() }) });
      const response = await request(app).post(`/store/corner-shop/orders/${open.id}/pay`).type("form").send({ t: token }).set("x-forwarded-for", nextClient());
      assert.equal(response.status, 503);
      assert.ok(stripe.some((call) => call.path.endsWith("/expire")), "the old checkout was never expired");
      assert.equal(stripe.filter((call) => call.method === "POST" && call.path === "/v1/checkout/sessions").length, 1, "a second checkout was opened while the first could still be paid");
    });

    it("places the order but charges nothing when online payment is off, and says how to pay instead", async () => {
      const { fake, stripe } = world({ env: { STRIPE_CONNECT_WEBHOOK_SECRET: undefined } });
      const response = await placeOrder();
      assert.equal(response.status, 200);
      assert.match(response.text, /Nothing is charged here/);
      assert.match(response.text, /Your order and its receipt/);
      assert.equal(fake.rows("merchant_orders")[0].payment_state, "unpaid");
      assert.deepEqual(stripe, []);
    });

    it("places the order but opens no checkout when the shop's Stripe account cannot take charges", async () => {
      const { fake, stripe } = world({ chargesEnabled: false });
      const response = await placeOrder();
      assert.equal(response.status, 200);
      assert.match(response.text, /cannot take payments online right now/);
      assert.equal(fake.rows("merchant_orders").length, 1);
      assert.ok(!stripe.some((call) => call.path === "/v1/checkout/sessions"));
    });
  });

  describe("the tenant guard's side of it", () => {
    const tenantGuard = require("../lib/sonara-tenant-guard.cjs");
    const ID = "33333333-3333-4333-8333-333333333333";
    const allowed = (pathAndQuery) => tenantGuard.inspect("GET", `${SUPABASE}/rest/v1/${pathAndQuery}`).allowed;

    // Found by falsification: with the receipt's token filter removed, a bare
    // by-id read of an order matched the webhook's exemption and the guard let it
    // through. Both webhook lookups now need the event's connected account too.
    it("refuses a bare read of an order by id, on either kind of sale", () => {
      for (const table of ["merchant_orders", "creator_marketplace_orders"]) {
        assert.equal(allowed(`${table}?select=id,organization_id&id=eq.${ID}&limit=1`), false, `${table} by id alone was allowed`);
        assert.equal(allowed(`${table}?select=id,organization_id&payment_intent_id=eq.pi_shoppay12345678&limit=1`), false, `${table} by payment intent alone was allowed`);
        assert.equal(allowed(`${table}?select=id,organization_id&id=eq.${ID}&stripe_account_id=eq.not-an-account&limit=1`), false);
      }
    });

    it("allows the webhook's lookups with the connected account, and the receipt's with the token hash", () => {
      assert.equal(allowed(`merchant_orders?select=id,organization_id&id=eq.${ID}&stripe_account_id=eq.${ACCOUNT}&limit=1`), true);
      assert.equal(allowed(`creator_marketplace_orders?select=id,organization_id&payment_intent_id=eq.pi_shoppay12345678&stripe_account_id=eq.${ACCOUNT}&limit=1`), true);
      assert.equal(allowed(`merchant_orders?select=id,organization_id&id=eq.${ID}&buyer_token_hash=eq.${"a".repeat(64)}&limit=1`), true);
      assert.equal(allowed(`merchant_orders?select=id,organization_id,buyer_email&id=eq.${ID}&buyer_token_hash=eq.${"a".repeat(64)}&limit=1`), false, "the receipt lookup may read only id and organization_id");
    });
  });

  describe("the owner's reconciliation", () => {
    const registerMerchantPaymentRoutes = require("../routes/sonara-merchant-payment-routes.cjs");

    function ownerApp({ organizationOk = true } = {}) {
      const owner = express();
      owner.use(express.urlencoded({ extended: false }));
      registerMerchantPaymentRoutes(owner, {
        layout: ({ heading, body, sections = [] }) => `<h1>${heading}</h1><p>${body}</p>${sections.join("")}`,
        brandCard: (title, body) => `<section><h2>${title}</h2>${body}</section>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
        requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: "99999999-9999-4999-8999-999999999999" }; next(); },
        getCustomerPrimaryOrganization: async () => (organizationOk ? { ok: true, organizationId: ORG } : { ok: false }),
        getSupabaseServerConfig: () => ({ ok: true, url: SUPABASE, serviceRoleKey: "service-role-placeholder" }),
        supabaseHeaders: (config, { prefer } = {}) => ({ apikey: "service-role-placeholder", ...(prefer ? { Prefer: prefer } : {}) }),
        getEnv: (name) => process.env[name] || "",
        createRateLimiter: () => (req, res, next) => next()
      });
      return owner;
    }

    const paidSession = (order, overrides = {}) => ({
      id: order.checkout_session_id, metadata: { sonara_order_id: order.id, sonara_kind: "merchant_order" }, client_reference_id: order.id,
      payment_status: "paid", status: "complete", amount_total: order.subtotal_cents, currency: "usd",
      payment_intent: { id: "pi_shoppay12345678", latest_charge: { amount_refunded: 0, balance_transaction: { fee: 100, net: 2300, currency: "usd" } } },
      ...overrides
    });

    it("shows gross, Stripe's fee and the net, and agrees when everything does", async () => {
      const { fake, stored } = world();
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      await deliver(completed(open));
      stored.set(open.checkout_session_id, paidSession(open));
      const response = await request(ownerApp()).get("/business-builder/owner/store/reconciliation");
      assert.equal(response.status, 200, response.text);
      assert.match(response.text, /Everything agrees/);
      assert.match(response.text, /Stripe took 24\.00 USD in 1 payment/);
      assert.match(response.text, /Stripe's fees: 1\.00 USD\. What reached your Stripe balance: 23\.00 USD/);
      assert.match(response.text, /Recorded here as paid: 24\.00 USD/);
    });

    it("finds a payment whose webhook never arrived, and records it only from Stripe's own record", async () => {
      const { fake, stored, stripe } = world();
      await placeOrder();
      const [open] = fake.rows("merchant_orders");
      stored.set(open.checkout_session_id, paidSession(open));
      const page = await request(ownerApp()).get("/business-builder/owner/store/reconciliation");
      assert.match(page.text, /Needs a look \(1\)/);
      assert.match(page.text, /Stripe took this payment and this order does not show it as paid/);
      assert.match(page.text, /Record it from Stripe's record/);

      const recorded = await request(ownerApp()).post("/api/business/storefront/reconcile/record").type("form").send({ order_id: open.id, session_id: open.checkout_session_id, days: "30" });
      assert.equal(recorded.status, 303);
      assert.match(recorded.headers.location, /done=recorded/);
      const [order] = fake.rows("merchant_orders");
      assert.deepEqual([order.payment_state, order.amount_paid_cents, order.payment_intent_id], ["paid", 2400, "pi_shoppay12345678"]);
      assert.equal(fake.rows("merchant_order_payment_events")[0].stripe_event_id, `reconciled:${open.checkout_session_id}`);
      assert.ok(stripe.some((call) => call.method === "GET" && call.path === `/v1/checkout/sessions/${open.checkout_session_id}`), "the repair did not read Stripe's own record");
    });

    it("will not record a payment Stripe does not show as paid, or one for another order", async () => {
      const { fake, stored } = world();
      await placeOrder();
      await placeOrder({ buyer_name: "Someone Else", buyer_email: "else@example.com" });
      const [first, second] = fake.rows("merchant_orders");
      stored.set(first.checkout_session_id, paidSession(first, { payment_status: "unpaid", status: "open" }));
      stored.set(second.checkout_session_id, paidSession(second));
      const unpaid = await request(ownerApp()).post("/api/business/storefront/reconcile/record").type("form").send({ order_id: first.id, session_id: first.checkout_session_id });
      assert.match(unpaid.headers.location, /done=unchanged/);
      const crossed = await request(ownerApp()).post("/api/business/storefront/reconcile/record").type("form").send({ order_id: first.id, session_id: second.checkout_session_id });
      assert.match(crossed.headers.location, /done=unchanged/);
      assert.ok(fake.rows("merchant_orders").every((order) => order.payment_state !== "paid"), "an order was marked paid on another order's payment or an unpaid one");
    });

    it("shows nothing, rather than agreement, when Stripe cannot be asked", async () => {
      world({ env: { STRIPE_SECRET_KEY: "sk_test_placeholder_not_a_real_key" } });
      const response = await request(ownerApp()).get("/business-builder/owner/store/reconciliation");
      assert.doesNotMatch(response.text, /Everything agrees/);
    });

    it("answers 503 and claims nothing when it cannot tell whose shop this is", async () => {
      world();
      const response = await request(ownerApp({ organizationOk: false })).get("/business-builder/owner/store/reconciliation");
      assert.equal(response.status, 503);
      assert.doesNotMatch(response.text, /Everything agrees/);
    });
  });
});

"use strict";

// Buying a licence on the marketplace, through the real server.
//
// Listing -> buy -> Stripe Checkout on the seller's account -> signed webhook ->
// licence grant -> private download -> refund -> revoked. Every step is driven
// through server.js as deployed: the real requireCustomer, the real Stripe
// signature check, the webhook mounted ahead of the body parsers, and the
// runtime tenant guard in front of an in-memory Supabase. Only Stripe's API and
// the file store are stubbed, and every call to them is recorded so the test
// can assert what was ASKED as well as what came back.
//
// tests/a-sale-is-a-licence-delivered.test.js checks each decision alone. This
// file exists because a correct decision behind a broken route is still a buyer
// who paid for nothing -- and the commonest way for that to happen here is one
// this file cannot miss: the webhook parsed by express.json before its
// signature is checked, so every genuine payment fails verification.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const request = require("supertest");

const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");

const SELLER = "aaaaaaaa-0000-4000-8000-00000000000a";
const BUYER = "cccccccc-0000-4000-8000-00000000000c";
const OTHER_BUYER = "dddddddd-0000-4000-8000-00000000000d";
const LISTING = "11111111-1111-4111-8111-111111111111";
const EXCLUSIVE = "44444444-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "acct_seller12345678";
const SECRET = "whsec_localfixture0123456789";
const PINNED_PATH = `${SELLER}/versions/pinned-a-track.wav`;

const ENV = Object.freeze({
  SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-placeholder",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
  SONARA_CUSTOMER_FUNDS_MODE: "connect_direct_reviewed", STRIPE_CONNECT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_local_fixture_not_a_secret",
  STRIPE_CONNECT_WEBHOOK_SECRET: SECRET,
  NEXT_PUBLIC_SITE_URL: "https://sonara.example"
});

const OPEN = (row) => ["pending", "processing"].includes(row.state);
const UNIQUE = Object.freeze({
  // The two partial unique indexes from the migration, declared so the fake
  // enforces them. scripts/verify-migration-replay.mjs proves the real ones exist.
  creator_marketplace_orders: [
    { name: "creator_marketplace_orders_exclusive_once", columns: ["listing_id"], where: (row) => row.licence === "exclusive_transfer" && ["pending", "processing", "paid"].includes(row.state) },
    { name: "creator_marketplace_orders_one_pending", columns: ["listing_id", "buyer_user_id"], where: OPEN }
  ],
  creator_licence_grants: [{ name: "creator_licence_grants_pkey", columns: ["order_id"] }],
  creator_marketplace_payment_events: [{ name: "creator_marketplace_payment_events_pkey", columns: ["stripe_event_id"] }]
});

function listingRow(id, licence, price) {
  return {
    id, organization_id: SELLER, title: `Work ${licence}`, price_cents: price, currency: "usd", licence,
    state: "listed", rights_attested: true, consent_attested: null, version_id: VERSION
  };
}

function seed() {
  return {
    creator_listings: [listingRow(LISTING, "commercial_single", 2500), listingRow(EXCLUSIVE, "exclusive_transfer", 90000)],
    creator_marketplace_entries: [
      { listing_id: LISTING, title: "Work commercial_single", price_cents: 2500, currency: "usd", licence: "commercial_single" },
      { listing_id: EXCLUSIVE, title: "Work exclusive_transfer", price_cents: 90000, currency: "usd", licence: "exclusive_transfer" }
    ],
    creator_asset_versions: [{ id: VERSION, organization_id: SELLER, asset_id: "a1", version_number: 1, source: "uploaded", ai_disclosure: null, provenance: { involves_person: false }, checksum: null }],
    creator_asset_approvals: [{ asset_version_id: VERSION, organization_id: SELLER, state: "approved", decided_at: "2026-10-01T00:00:00Z", decided_by: "u2", created_at: "2026-10-01T00:00:00Z" }],
    creator_version_files: [{ version_id: VERSION, organization_id: SELLER, object_path: PINNED_PATH, filename: "a-track.wav", bytes: 1024 }],
    business_payment_accounts: [{ id: "bpa1", organization_id: SELLER, stripe_account_id: ACCOUNT, disconnected_at: null, charges_enabled: true, payouts_enabled: true, details_submitted: true, state_checked_at: null }]
  };
}

let app;
let savedEnv;
let savedFetch;

function world({ env = {} } = {}) {
  for (const [key, value] of Object.entries({ ...ENV, ...env })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const fake = createFakeSupabase({
    url: ENV.SUPABASE_URL,
    ids: "uuid",
    unique: UNIQUE,
    users: { "token-buyer": { id: BUYER, email: "buyer@example.com" }, "token-other": { id: OTHER_BUYER, email: "other@example.com" } },
    tables: seed()
  });
  const stripe = [];
  const storage = [];
  let sessions = 0;
  // Behind the fake: Stripe's API and the file store. Anything else is refused,
  // so nothing in this file can reach a real service.
  async function outside(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url);
    const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (url.hostname === "api.stripe.com") {
      stripe.push({ path: url.pathname, method: init.method || "GET", headers: init.headers || {}, body: init.body ? new URLSearchParams(init.body) : null });
      if (url.pathname === `/v1/accounts/${ACCOUNT}`) return json({ id: ACCOUNT, charges_enabled: true, payouts_enabled: true, details_submitted: true });
      if (url.pathname === "/v1/checkout/sessions") {
        sessions += 1;
        const id = `cs_test_session${sessions}abc`;
        return json({ id, url: `https://checkout.stripe.com/c/pay/${id}` });
      }
      return json({ error: { message: "not modelled" } }, 404);
    }
    if (url.origin === ENV.SUPABASE_URL && url.pathname.startsWith("/storage/v1/")) {
      storage.push({ path: url.pathname, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
      if (url.pathname.startsWith("/storage/v1/object/sign/")) {
        return json({ signedURL: `${url.pathname.replace("/storage/v1", "")}?token=signed` });
      }
      return json({});
    }
    throw new Error(`buying-a-licence-end-to-end refused a request to ${url.origin}`);
  }
  global.fetch = fake.install(outside);
  return { fake, stripe, storage };
}

function signed(event, secret = SECRET) {
  // Indented, as Stripe sends it. A compact body would survive being parsed and
  // re-serialised byte for byte, and a webhook mounted behind express.json would
  // then pass this file while failing every real delivery -- which is exactly
  // what happened when this was first written, and the falsification caught it.
  const body = JSON.stringify(event, null, 2);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { body, header: `t=${timestamp},v1=${signature}` };
}

function deliver(event, { secret, header } = {}) {
  const message = signed(event, secret);
  return request(app)
    .post("/api/webhooks/stripe-connect")
    .set("content-type", "application/json")
    .set("stripe-signature", header || message.header)
    .send(message.body);
}

function paidEvent(order, overrides = {}, eventOverrides = {}) {
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, "")}`,
    type: "checkout.session.completed",
    account: ACCOUNT,
    data: { object: {
      id: order.checkout_session_id, client_reference_id: order.id,
      metadata: { sonara_order_id: order.id, sonara_kind: "creator_marketplace" },
      amount_total: order.price_cents, currency: order.currency, payment_status: "paid", payment_intent: "pi_test12345678",
      ...overrides
    } },
    ...eventOverrides
  };
}

const buy = (listingId, token = "token-buyer", form = {}) => request(app)
  .post(`/marketplace/${listingId}/buy`).set("accept", "text/html").set("Authorization", `Bearer ${token}`).type("form").send(form);
const asBuyer = (path, token = "token-buyer") => request(app).get(path).set("accept", "text/html").set("Authorization", `Bearer ${token}`);

describe("buying a licence, end to end", function endToEnd() {
  this.timeout(30000);

  before(() => {
    savedFetch = global.fetch;
    savedEnv = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
    app = require("../server");
  });

  afterEach(() => {
    global.fetch = savedFetch;
  });

  after(() => {
    global.fetch = savedFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rate-limits both the webhook and the buy button, before either does any work", () => {
    const handlersFor = (method, routePath) => {
      const layer = app._router.stack.find((candidate) => candidate.route?.path === routePath && candidate.route.methods[method]);
      assert.ok(layer, `${method.toUpperCase()} ${routePath} is not registered; this check has gone blind`);
      return layer.route.stack.map((entry) => entry.handle.name);
    };
    const webhook = handlersFor("post", "/api/webhooks/stripe-connect");
    assert.equal(webhook[0], "rateLimitMiddleware", `the webhook's first handler is ${webhook[0]}`);
    const buying = handlersFor("post", "/marketplace/:id/buy");
    const limiter = buying.indexOf("rateLimitMiddleware");
    assert.ok(limiter > 0 && limiter < buying.length - 1, `buy handlers: ${buying.join(", ")}`);
  });

  // CodeQL's js/missing-rate-limiting recognises a short list of npm packages and
  // has no model for lib/sonara-rate-limit.cjs, so its alert on the webhook stays
  // open (SECURITY_NOTES.md). These are what stand in for it: the real limiter on
  // the real routes, with the database counter answering for itself.
  describe("the rate limits refuse, not merely exist", () => {
    function counter(answer) {
      const consumed = [];
      const inner = global.fetch;
      global.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        if (url === `${ENV.SUPABASE_URL}/rest/v1/rpc/sonara_consume_rate_limit`) {
          const body = JSON.parse(init.body);
          consumed.push(body);
          const row = answer(body);
          return { ok: true, status: 200, json: async () => [row], text: async () => JSON.stringify([row]) };
        }
        return inner(input, init);
      };
      return consumed;
    }
    const REFUSE = () => ({ allowed: false, remaining: 0, retry_after_seconds: 42 });
    const ALLOW = () => ({ allowed: true, remaining: 10, retry_after_seconds: 0 });

    it("answers a refused webhook 429 before verifying, reading or granting anything", async () => {
      const { fake } = world();
      await buy(LISTING);
      const [order] = fake.rows("creator_marketplace_orders");
      fake.reset();
      const consumed = counter(REFUSE);
      const response = await deliver(paidEvent(order));
      assert.equal(response.status, 429);
      assert.equal(response.headers["retry-after"], "42");
      assert.equal(consumed.length, 1);
      assert.match(consumed[0].p_bucket_key, /^stripe_connect_webhook:ip:[0-9a-f]{32}$/);
      assert.deepEqual([consumed[0].p_window_seconds, consumed[0].p_max_attempts], [60, 600]);
      assert.deepEqual(fake.queries.filter((query) => !query.table.startsWith("rpc:")), [], "a refused webhook still read the database");
      assert.deepEqual(fake.rows("creator_licence_grants"), []);
      assert.equal(fake.rows("creator_marketplace_orders")[0].state, "pending");
    });

    it("answers a refused buy 429 and opens no checkout, counting the person as well as the address", async () => {
      const { fake, stripe } = world();
      const consumed = counter(REFUSE);
      const response = await buy(LISTING);
      assert.equal(response.status, 429);
      assert.equal(response.headers["retry-after"], "42");
      assert.match(consumed[0].p_bucket_key, /^marketplace_buy:ip:/);
      assert.deepEqual([consumed[0].p_window_seconds, consumed[0].p_max_attempts], [600, 120]);
      assert.deepEqual(fake.rows("creator_marketplace_orders"), []);
      assert.deepEqual(stripe, [], "a refused buy still reached Stripe");
    });

    it("counts both buckets on an allowed buy, and goes on to Stripe", async () => {
      const { fake } = world();
      const consumed = counter(ALLOW);
      const response = await buy(LISTING);
      assert.equal(response.status, 303);
      assert.deepEqual(consumed.map((call) => call.p_bucket_key.split(":").slice(0, 2).join(":")), ["marketplace_buy:ip", "marketplace_buy:subject"]);
      assert.equal(fake.rows("creator_marketplace_orders").length, 1);
    });
  });

  it("sends the buyer to Stripe's checkout on the seller's account, at the listing's price", async () => {
    const { fake, stripe } = world();
    // What a buyer's form might try to decide. None of it may matter.
    const response = await buy(LISTING, "token-buyer", { price_cents: "1", organization_id: OTHER_BUYER, stripe_account_id: "acct_attacker1234" });
    assert.equal(response.status, 303, response.text);
    assert.match(response.headers.location, /^https:\/\/checkout\.stripe\.com\//);

    const [order] = fake.rows("creator_marketplace_orders");
    assert.ok(order, "no order was recorded for a checkout that was opened");
    assert.deepEqual(
      [order.organization_id, order.buyer_user_id, order.price_cents, order.stripe_account_id, order.state, order.version_id],
      [SELLER, BUYER, 2500, ACCOUNT, "pending", VERSION]
    );
    assert.match(order.checkout_session_id, /^cs_test_/, "the session id was not recorded, so the webhook could never match it");

    const session = stripe.find((call) => call.path === "/v1/checkout/sessions");
    assert.ok(session, "Stripe was never asked to open a checkout");
    assert.equal(session.headers["Stripe-Account"], ACCOUNT);
    assert.equal(session.headers["Idempotency-Key"], `sonara-marketplace-order-${order.id}`);
    assert.equal(session.body.get("line_items[0][price_data][unit_amount]"), "2500");
    assert.equal(session.body.get("metadata[sonara_order_id]"), order.id);
    assert.equal(session.body.get("success_url"), `https://sonara.example/marketplace/orders/${order.id}`);
    assert.deepEqual([...session.body.keys()].filter((key) => /application_fee|transfer_data/.test(key)), []);
  });

  it("unlocks nothing on the success page before Stripe confirms the payment", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    const page = await asBuyer(`/marketplace/orders/${order.id}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /Waiting for Stripe to confirm/);
    assert.doesNotMatch(page.text, /Download your file/);
    const download = await asBuyer(`/marketplace/orders/${order.id}/download`);
    assert.equal(download.status, 409);
    assert.deepEqual(fake.rows("creator_licence_grants"), []);
  });

  it("grants the licence from a signed webhook, once, however often it arrives, and delivers the pinned file", async () => {
    const { fake, storage } = world();
    await buy(LISTING);
    const [pending] = fake.rows("creator_marketplace_orders");
    const event = paidEvent(pending);

    const first = await deliver(event);
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.outcome, "granted");
    const replay = await deliver(event);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.outcome, "grant_confirmed");

    const [order] = fake.rows("creator_marketplace_orders");
    assert.equal(order.state, "paid");
    assert.ok(order.paid_at, "paid without saying when");
    assert.equal(order.payment_intent_id, "pi_test12345678");
    const grants = fake.rows("creator_licence_grants");
    assert.equal(grants.length, 1, `a replayed webhook granted ${grants.length} times`);
    assert.deepEqual([grants[0].order_id, grants[0].buyer_user_id, grants[0].version_id], [order.id, BUYER, VERSION]);
    assert.equal(fake.rows("creator_marketplace_payment_events").length, 1, "the audit trail recorded a replay as a second event");

    const page = await asBuyer(`/marketplace/orders/${order.id}`);
    assert.match(page.text, /Download your file/);
    const download = await asBuyer(`/marketplace/orders/${order.id}/download`);
    assert.equal(download.status, 303);
    assert.match(download.headers.location, /token=signed/);
    const sign = storage.find((call) => call.path.startsWith("/storage/v1/object/sign/"));
    assert.ok(sign.path.endsWith(`/${PINNED_PATH}`), `delivered ${sign.path} rather than the version's pinned file`);
    assert.equal(sign.body.expiresIn, 120);
  });

  it("completes a grant whose first write failed, when Stripe retries", async () => {
    // The state a crash between the two writes leaves behind: paid, no grant.
    const second = world();
    await buy(LISTING);
    const [open] = second.fake.rows("creator_marketplace_orders");
    await fetch(`${ENV.SUPABASE_URL}/rest/v1/creator_marketplace_orders?id=eq.${open.id}&organization_id=eq.${SELLER}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "paid", paid_at: new Date().toISOString(), payment_intent_id: "pi_test12345678" })
    });
    assert.equal(second.fake.rows("creator_marketplace_orders")[0].state, "paid");
    assert.deepEqual(second.fake.rows("creator_licence_grants"), []);
    const retried = await deliver(paidEvent(open));
    assert.equal(retried.status, 200);
    assert.equal(retried.body.outcome, "grant_confirmed");
    assert.equal(second.fake.rows("creator_licence_grants").length, 1, "a buyer who paid was left with no licence after Stripe's retry");
  });

  function failWriteOnce(table, method) {
    const inner = global.fetch;
    let failures = 0;
    global.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      if (!failures && url.pathname === `/rest/v1/${table}` && init.method === method) {
        failures += 1;
        return { ok: false, status: 503, json: async () => [], text: async () => "unavailable" };
      }
      return inner(input, init);
    };
    return () => assert.equal(failures, 1, "the intended write was never reached");
  }

  for (const [type, object, state] of [
    ["checkout.session.completed", { payment_status: "unpaid" }, "processing"],
    ["checkout.session.async_payment_failed", {}, "payment_failed"],
    ["checkout.session.expired", {}, "expired"]
  ]) {
    it(`retries ${type} when its order transition cannot be saved`, async () => {
      const { fake } = world();
      await buy(LISTING);
      const [order] = fake.rows("creator_marketplace_orders");
      const reached = failWriteOnce("creator_marketplace_orders", "PATCH");
      const event = paidEvent(order, object, { type });
      assert.equal((await deliver(event)).status, 503);
      reached();
      assert.equal(fake.rows("creator_marketplace_orders")[0].state, "pending");
      assert.equal((await deliver(event)).status, 200);
      assert.equal(fake.rows("creator_marketplace_orders")[0].state, state);
      assert.equal(fake.rows("creator_marketplace_payment_events").length, 1);
    });
  }

  for (const [type, object, state] of [
    ["charge.refunded", { refunded: true }, "refunded"],
    ["charge.dispute.created", {}, "disputed"]
  ]) {
    it(`blocks delivery and repairs a failed revocation on retry of ${type}`, async () => {
      const { fake, storage } = world();
      await buy(LISTING);
      const [order] = fake.rows("creator_marketplace_orders");
      await deliver(paidEvent(order));
      const reached = failWriteOnce("creator_licence_grants", "PATCH");
      const event = { id: "evt_revokeRetry", type, account: ACCOUNT, data: { object: { payment_intent: "pi_test12345678", ...object } } };
      assert.equal((await deliver(event)).status, 503);
      reached();
      assert.equal(fake.rows("creator_marketplace_orders")[0].state, state);
      assert.ok(!fake.rows("creator_licence_grants")[0].revoked_at);
      const before = storage.length;
      assert.equal((await asBuyer(`/marketplace/orders/${order.id}/download`)).status, 410);
      assert.equal(storage.length, before, "a closed order received a signed URL");
      assert.equal((await deliver(event)).status, 200);
      assert.ok(fake.rows("creator_licence_grants")[0].revoked_at);
      assert.equal(fake.rows("creator_licence_grants")[0].revoked_reason, state);
      assert.equal(fake.rows("creator_marketplace_payment_events").filter((row) => row.stripe_event_id === event.id).length, 1);
    });
  }

  it("requires paid status even when repairing a grant for an already paid order", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    await fetch(`${ENV.SUPABASE_URL}/rest/v1/creator_marketplace_orders?id=eq.${order.id}&organization_id=eq.${SELLER}`, {
      method: "PATCH", body: JSON.stringify({ state: "paid" })
    });
    assert.equal((await deliver(paidEvent(order, { payment_status: "unpaid" }))).status, 200);
    assert.equal(fake.rows("creator_licence_grants").length, 0);
  });

  it("retries a failed audit write without issuing a second licence", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    const reached = failWriteOnce("creator_marketplace_payment_events", "POST");
    const event = paidEvent(order);
    assert.equal((await deliver(event)).status, 503);
    reached();
    assert.equal(fake.rows("creator_licence_grants").length, 1);
    assert.equal(fake.rows("creator_marketplace_payment_events").length, 0);
    assert.equal((await deliver(event)).status, 200);
    assert.equal(fake.rows("creator_licence_grants").length, 1);
    assert.equal(fake.rows("creator_marketplace_payment_events").length, 1);
  });

  for (const [table, method] of [["creator_marketplace_entries", "DELETE"], ["creator_listings", "PATCH"]]) {
    it(`repairs an exclusive listing after a failed ${table} write`, async () => {
      const { fake } = world();
      await buy(EXCLUSIVE);
      const [order] = fake.rows("creator_marketplace_orders");
      const reached = failWriteOnce(table, method);
      const event = paidEvent(order);
      assert.equal((await deliver(event)).status, 503);
      reached();
      assert.equal((await deliver(event)).status, 200);
      assert.equal(fake.rows("creator_listings").find((row) => row.id === EXCLUSIVE).state, "sold_exclusively");
      assert.ok(!fake.rows("creator_marketplace_entries").some((row) => row.listing_id === EXCLUSIVE));
      assert.equal(fake.rows("creator_licence_grants").length, 1);
    });
  }

  it("refuses a forged signature, and one made with another secret, before reading anything", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    fake.reset();
    const forged = await deliver(paidEvent(order), { header: "t=1,v1=" + "0".repeat(64) });
    assert.equal(forged.status, 400);
    const wrongSecret = await deliver(paidEvent(order), { secret: "whsec_someoneelses0123456789" });
    assert.equal(wrongSecret.status, 400);
    // The rate limiter's own counter is the one call allowed before the
    // signature; no table may be read.
    assert.ok(fake.queries.some((query) => query.table === "rpc:sonara_consume_rate_limit"), "the limiter never ran; this check has gone blind");
    assert.deepEqual(fake.queries.filter((query) => !query.table.startsWith("rpc:")), [], "an unverified webhook reached the database");
    assert.equal(fake.rows("creator_marketplace_orders")[0].state, "pending");
  });

  for (const [why, overrides, eventOverrides] of [
    ["from another seller's connected account", {}, { account: "acct_someoneelse99" }],
    ["for a different amount", { amount_total: 1 }, {}],
    ["for a different checkout session", { id: "cs_test_unrelated123" }, {}],
    ["that has not been paid yet", { payment_status: "unpaid" }, {}]
  ]) {
    it(`grants nothing for a genuinely signed event ${why}`, async () => {
      const { fake } = world();
      await buy(LISTING);
      const [order] = fake.rows("creator_marketplace_orders");
      const response = await deliver(paidEvent(order, overrides, eventOverrides));
      assert.equal(response.status, 200);
      assert.deepEqual(fake.rows("creator_licence_grants"), []);
      assert.notEqual(fake.rows("creator_marketplace_orders")[0].state, "paid");
    });
  }

  for (const changed of [
    { organization_id: OTHER_BUYER },
    { version_id: "99999999-9999-4999-8999-999999999999" },
    { licence: "exclusive_transfer" }
  ]) {
    it("refuses private delivery when the grant snapshot differs in " + Object.keys(changed)[0], async () => {
      const { fake, storage } = world();
      await buy(LISTING);
      const [order] = fake.rows("creator_marketplace_orders");
      await deliver(paidEvent(order));
      await fetch(ENV.SUPABASE_URL + "/rest/v1/creator_licence_grants?order_id=eq." + order.id + "&organization_id=eq." + SELLER, {
        method: "PATCH", body: JSON.stringify(changed)
      });
      const before = storage.length;
      const download = await asBuyer("/marketplace/orders/" + order.id + "/download");
      assert.equal(download.status, 409);
      assert.equal(storage.length, before, "a different grant authorized private storage");
      const receipt = await asBuyer("/marketplace/orders/" + order.id);
      assert.match(receipt.text, /licence does not match this purchase/);
      assert.doesNotMatch(receipt.text, /Download your file/);
    });
  }

  it("shows another buyer nothing, and answers them as if the order did not exist", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    await deliver(paidEvent(order));
    const page = await asBuyer(`/marketplace/orders/${order.id}`, "token-other");
    assert.equal(page.status, 404);
    const download = await asBuyer(`/marketplace/orders/${order.id}/download`, "token-other");
    assert.equal(download.status, 404);
    const missing = await asBuyer(`/marketplace/orders/${crypto.randomUUID()}/download`, "token-other");
    assert.equal(download.text.replace(/[0-9a-f-]{36}/g, ""), missing.text.replace(/[0-9a-f-]{36}/g, ""));
    const purchases = await asBuyer("/account/purchases", "token-other");
    assert.doesNotMatch(purchases.text, /Work commercial_single/);
    const own = await asBuyer("/account/purchases");
    assert.match(own.text, /Work commercial_single/);
  });

  it("ends the licence when the seller refunds in full, and records rather than deletes", async () => {
    const { fake } = world();
    await buy(LISTING);
    const [order] = fake.rows("creator_marketplace_orders");
    await deliver(paidEvent(order));
    const partial = await deliver({ id: "evt_partialrefund1", type: "charge.refunded", account: ACCOUNT, data: { object: { payment_intent: "pi_test12345678", refunded: false } } });
    assert.equal(partial.status, 200);
    assert.equal((await asBuyer(`/marketplace/orders/${order.id}/download`)).status, 303, "a partial refund took the work back");

    const full = await deliver({ id: "evt_fullrefund1", type: "charge.refunded", account: ACCOUNT, data: { object: { payment_intent: "pi_test12345678", refunded: true } } });
    assert.equal(full.status, 200);
    assert.equal(fake.rows("creator_marketplace_orders")[0].state, "refunded");
    const [grant] = fake.rows("creator_licence_grants");
    assert.ok(grant, "the grant was deleted rather than revoked");
    assert.equal(grant.revoked_reason, "refunded");
    const download = await asBuyer(`/marketplace/orders/${order.id}/download`);
    assert.equal(download.status, 410);
    // A replay of the original payment must not revive it.
    await deliver(paidEvent(order));
    assert.equal(fake.rows("creator_marketplace_orders")[0].state, "refunded");
    assert.equal((await asBuyer(`/marketplace/orders/${order.id}/download`)).status, 410);
    assert.equal(fake.rows("creator_marketplace_payment_events").length, 4);
  });

  it("sells an exclusive licence once: a second buyer cannot start, and the sale takes it off the catalogue", async () => {
    const { fake, stripe } = world();
    assert.equal((await buy(EXCLUSIVE)).status, 303);
    const sessionsBefore = stripe.filter((call) => call.path === "/v1/checkout/sessions").length;
    const second = await buy(EXCLUSIVE, "token-other");
    assert.equal(second.status, 409);
    assert.match(second.text, /Somebody else is buying the exclusive licence/);
    assert.equal(stripe.filter((call) => call.path === "/v1/checkout/sessions").length, sessionsBefore, "a second checkout was opened for an exclusive licence");
    assert.equal(fake.rows("creator_marketplace_orders").length, 1);

    const [order] = fake.rows("creator_marketplace_orders");
    await deliver(paidEvent(order));
    assert.ok(!fake.rows("creator_marketplace_entries").some((entry) => entry.listing_id === EXCLUSIVE), "a sold exclusive licence is still on the public catalogue");
    assert.equal(fake.rows("creator_listings").find((listing) => listing.id === EXCLUSIVE).state, "sold_exclusively");
    assert.ok(fake.rows("creator_marketplace_entries").some((entry) => entry.listing_id === LISTING), "the sale removed a different listing");
  });

  it("continues a buyer's open checkout rather than opening a second one", async () => {
    const { fake } = world();
    const first = await buy(LISTING);
    const again = await buy(LISTING);
    assert.equal(again.status, 303);
    assert.equal(fake.rows("creator_marketplace_orders").length, 1);
    assert.ok(first.headers.location && again.headers.location);
  });

  it("opens no checkout, and records no order, when no payment could be verified", async () => {
    const { fake, stripe } = world({ env: { STRIPE_CONNECT_WEBHOOK_SECRET: undefined } });
    const response = await buy(LISTING);
    assert.equal(response.status, 503);
    assert.match(response.text, /Nothing has been charged/);
    assert.deepEqual(fake.rows("creator_marketplace_orders"), []);
    assert.deepEqual(stripe, []);
    const webhook = await deliver({ id: "evt_x1", type: "checkout.session.completed", account: ACCOUNT, data: { object: {} } });
    assert.equal(webhook.status, 503);
  });

  it("sends a signed-out visitor to sign in and records nothing", async () => {
    const { fake, stripe } = world();
    const response = await request(app).post(`/marketplace/${LISTING}/buy`).set("accept", "text/html");
    assert.equal(response.status, 303);
    assert.equal(response.headers.location, "/login");
    assert.deepEqual(fake.rows("creator_marketplace_orders"), []);
    assert.deepEqual(stripe, []);
  });

  it("refuses to sell a version with no pinned file", async () => {
    const { fake, stripe } = world();
    await fetch(`${ENV.SUPABASE_URL}/rest/v1/creator_version_files?version_id=eq.${VERSION}&organization_id=eq.${SELLER}`, { method: "DELETE" });
    const response = await buy(LISTING);
    assert.equal(response.status, 409);
    assert.match(response.text, /not pinned a file/);
    assert.deepEqual(fake.rows("creator_marketplace_orders"), []);
    assert.ok(!stripe.some((call) => call.path === "/v1/checkout/sessions"));
  });
});

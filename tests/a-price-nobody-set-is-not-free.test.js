"use strict";

// A shop that sells a zero-priced thing gives stock away.
//
// Business Builder could hold products and variants with prices. It could not put
// them in front of a stranger — no route, no address, nowhere to say what the shop
// is called. That is the gap public_booking_pages filled for appointments, and this
// is the same shape.
//
// The invariant it exists for: **an unreadable price is not free.**
// `merchant_product_variants.price_cents` is `not null default 0`, so zero is
// indistinguishable between "this is free" and "nobody has set a price yet". That
// default was right for the catalogue and is dangerous at the till. CLAUDE.md
// records the version that already shipped here: `Number(null)` is `0` and finite,
// which made unpriced services read as free across twenty-three columns.
//
// Three more, each with a way of going quiet:
//
// **A total is never taken from the request.** `priceOrder` takes the offers the
// server read and quantities from the form. A posted price is a buyer naming their
// own, and it is the oldest bug in online selling.
//
// **A line not on sale refuses the order rather than being dropped.** Quietly
// removing it would charge somebody for less than they asked for and call it their
// order.
//
// **Two currencies do not add up.** There is no exchange rate here, and inventing
// one makes a figure wrong by a factor rather than by a rounding.
//
// And two things this must never start doing: hold a card (AGENTS.md forbids
// storing raw card data or CVV — taking money runs through the organization's own
// connected account) or send anything.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerMerchantStoreRoutes = require("../routes/sonara-merchant-store-routes.cjs");
const shopLib = require("../lib/sonara-merchant-storefront.cjs");

const ORG = "a1a1a1a1-0000-4000-8000-00000000001a";
const OTHER_ORG = "a2a2a2a2-0000-4000-8000-00000000002a";
const USER = "b2b2b2b2-0000-4000-8000-00000000002b";
const SHOP = "c3c3c3c3-0000-4000-8000-00000000003c";
const ORDER = "e5e5e5e5-0000-4000-8000-00000000005e";
const OWNER_PAGE = "/business-builder/owner/store";
const SLUG = "the-corner-shop";

const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20261002120000_a_storefront_a_stranger_can_buy_from.sql");
const ROUTES = path.join(__dirname, "..", "routes", "sonara-merchant-store-routes.cjs");
const MODULE = path.join(__dirname, "..", "lib", "sonara-merchant-storefront.cjs");

const product = (overrides = {}) => ({ id: "p1", name: "Mug", category: "Kitchen", description: null, status: "active", ...overrides });
const variant = (overrides = {}) => ({ id: "v1", product_id: "p1", variant_name: "Large", sku: null, price_cents: 1200, currency: "usd", status: "active", ...overrides });
const shopRow = (overrides = {}) => ({
  id: SHOP, organization_id: ORG, slug: SLUG, enabled: true,
  headline: "The Corner Shop", intro: "Things we make.", currency: "usd", accepts_orders: true, ...overrides
});

function buildApp({
  shops = [shopRow()],
  products = [product()],
  variants = [variant()],
  orders = [],
  shopsOk = true, productsOk = true, variantsOk = true, ordersOk = true,
  writeOk = true, orderInsertReturns = [{ id: ORDER }], lineWriteOk = true,
  organization = ORG,
  configOk = true
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const calls = [];
  global.fetch = async (url, init) => {
    const href = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    calls.push({ href, method, body: init?.body ? JSON.parse(init.body) : null });

    if (method === "GET") {
      if (href.includes("/merchant_storefronts")) return { ok: shopsOk, status: shopsOk ? 200 : 500, json: async () => shops };
      if (href.includes("/merchant_product_variants")) return { ok: variantsOk, status: variantsOk ? 200 : 500, json: async () => variants };
      if (href.includes("/merchant_products")) return { ok: productsOk, status: productsOk ? 200 : 500, json: async () => products };
      if (href.includes("/merchant_orders")) return { ok: ordersOk, status: ordersOk ? 200 : 500, json: async () => orders };
      return { ok: true, status: 200, json: async () => [] };
    }
    if (href.includes("/merchant_order_lines")) {
      return { ok: lineWriteOk, status: lineWriteOk ? 201 : 500, json: async () => [] };
    }
    if (href.includes("/merchant_orders") && method === "POST") {
      return { ok: writeOk, status: writeOk ? 201 : 500, json: async () => orderInsertReturns };
    }
    return { ok: writeOk, status: writeOk ? 201 : 500, json: async () => [] };
  };

  registerMerchantStoreRoutes(app, {
    layout: ({ title, heading, body, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, ""),
    requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: USER }; return next(); },
    getCustomerPrimaryOrganization: async () => (organization ? { ok: true, organizationId: organization } : { ok: false }),
    getSupabaseServerConfig: () => (configOk ? { ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" } : { ok: false }),
    supabaseHeaders: () => ({ apikey: "server-only" }),
    createRateLimiter: () => (req, res, next) => next()
  });
  return { app, calls };
}

const writes = (calls, table) => calls.filter((call) => call.method === "POST" && call.href.includes(`/${table}`));
const patches = (calls, table) => calls.filter((call) => call.method === "PATCH" && call.href.includes(`/${table}`));

describe("a price nobody set is not free", () => {
  let savedFetch;
  beforeEach(() => { savedFetch = global.fetch; });
  afterEach(() => { global.fetch = savedFetch; });

  describe("the schema it writes to", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");

    it("reads a migration that is actually there", () => {
      assert.ok(sql.length > 4000, `the storefront migration is ${sql.length} bytes; these assertions have gone blind`);
    });

    it("publishes nobody on deploy", () => {
      assert.match(sql, /enabled boolean not null default false/);
      assert.match(sql, /slug text,/);
    });

    it("names one shop per organization and one shop per address", () => {
      assert.match(sql, /create unique index if not exists merchant_storefronts_organization_key/);
      assert.match(sql, /create unique index if not exists merchant_storefronts_slug_key/);
    });

    it("keeps a line's money and quantity always present", () => {
      for (const required of [
        "unit_price_cents integer not null check (unit_price_cents >= 0)",
        "line_total_cents integer not null check (line_total_cents >= 0)",
        "quantity integer not null check (quantity between 1 and 999)",
        "subtotal_cents integer not null check (subtotal_cents >= 0)"
      ]) {
        assert.ok(sql.includes(required), `the migration is missing: ${required}`);
      }
    });

    it("holds no card anywhere in the schema", () => {
      // The schema half only: the do-block names '%card%' in order to assert no
      // such column exists, and the header quotes AGENTS.md on card data.
      const schema = sql.split("do $$")[0];
      assert.ok(schema.length > 2000, "the split on do $$ has stopped working");
      assert.doesNotMatch(schema.replace(/^--.*$/gm, ""), /\b(card_number|cardnumber|cvv|payment_token|card_token)/i);
    });

    it("grants no delete on any of the three", () => {
      for (const table of ["merchant_storefronts", "merchant_orders", "merchant_order_lines"]) {
        assert.ok(sql.includes(`create table if not exists public.${table}`), `${table} is not created`);
        assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*${table}`, "i"), `${table} grants DELETE`);
      }
    });
  });

  describe("what may be sold", () => {
    it("offers an active variant at a positive price", () => {
      const offer = shopLib.offerFor(product(), variant(), "usd");
      assert.equal(offer.ok, true);
      assert.equal(offer.priceCents, 1200);
      assert.match(offer.reason, /12\.00 USD/);
    });

    // The whole reason this module exists.
    it("refuses a variant priced at zero, and says zero means unpriced", () => {
      const offer = shopLib.offerFor(product(), variant({ price_cents: 0 }), "usd");
      assert.equal(offer.ok, false);
      assert.equal(offer.code, shopLib.NOT_OFFERED.price_not_set);
      assert.match(offer.reason, /zero here means nobody has filled it in rather than that it is free/);
    });

    it("refuses a price it could not read, and says so differently from zero", () => {
      for (const price of [null, undefined, "", "lots", -5, 12.5]) {
        const offer = shopLib.offerFor(product(), variant({ price_cents: price }), "usd");
        assert.equal(offer.ok, false, `price ${JSON.stringify(price)} was offered`);
        assert.equal(offer.code, shopLib.NOT_OFFERED.price_unreadable, `price ${JSON.stringify(price)} was classed as unpriced rather than unreadable`);
      }
      // The two reasons are different sentences, because they are different
      // problems and the owner fixes them differently.
      const unreadable = shopLib.offerFor(product(), variant({ price_cents: null }), "usd");
      const unpriced = shopLib.offerFor(product(), variant({ price_cents: 0 }), "usd");
      assert.notEqual(unreadable.reason, unpriced.reason);
      assert.match(unreadable.reason, /has not been priced at zero -- it has not been read/);
    });

    it("refuses a draft or archived product, and an inactive variant", () => {
      for (const status of ["draft", "inactive", "archived", ""]) {
        assert.equal(shopLib.offerFor(product({ status }), variant(), "usd").code, shopLib.NOT_OFFERED.product_not_active);
        assert.equal(shopLib.offerFor(product(), variant({ status }), "usd").code, shopLib.NOT_OFFERED.variant_not_active);
      }
    });

    it("refuses to convert a currency it has no rate for", () => {
      const offer = shopLib.offerFor(product(), variant({ currency: "gbp" }), "usd");
      assert.equal(offer.ok, false);
      assert.equal(offer.code, shopLib.NOT_OFFERED.currency_mismatch);
      assert.match(offer.reason, /no exchange rate here to convert it with/);
    });
  });

  describe("the shop, split in two", () => {
    it("keeps what it cannot sell, with a reason each", () => {
      const split = shopLib.storefrontFor({
        storefront: shopRow(),
        products: [product()],
        variants: [variant(), variant({ id: "v2", variant_name: "Small", price_cents: 0 })]
      });
      assert.equal(split.ok, true);
      assert.equal(split.offered.length, 1);
      assert.equal(split.withheld.length, 1, "a variant it cannot sell was dropped rather than reported");
      assert.equal(split.withheld[0].code, shopLib.NOT_OFFERED.price_not_set);
      assert.ok(split.withheld[0].reason, "a withheld variant carries no reason, so the owner cannot fix it");
    });

    it("reports a failed read rather than an empty shop", () => {
      for (const broken of [{ products: null }, { variants: null }]) {
        const split = shopLib.storefrontFor({ storefront: shopRow(), products: [product()], variants: [variant()], ...broken });
        assert.equal(split.ok, false);
        assert.match(split.reason, /does not mean the shop is empty/);
      }
    });

    it("withholds a variant whose product did not come back rather than pricing it", () => {
      const split = shopLib.storefrontFor({ storefront: shopRow(), products: [], variants: [variant()] });
      assert.equal(split.offered.length, 0);
      assert.equal(split.withheld.length, 1);
      assert.match(split.withheld[0].reason, /could not be read/);
    });
  });

  describe("pricing an order", () => {
    const offered = shopLib.storefrontFor({ storefront: shopRow(), products: [product()], variants: [variant()] }).offered;

    it("totals from the price it read, not from anything posted", () => {
      const priced = shopLib.priceOrder({ offered, quantities: { v1: "3" }, currency: "usd" });
      assert.equal(priced.ok, true);
      assert.equal(priced.subtotalCents, 3600);
      assert.equal(priced.lines[0].unitPriceCents, 1200);
      // priceOrder takes no price argument at all, which is the structural half of
      // this guarantee: there is no parameter a caller could pass one through.
      assert.ok(!/unit_price|unitPrice.*=.*body|price.*req\./.test(shopLib.priceOrder.toString()));
    });

    it("refuses the whole order when one line is not on sale", () => {
      const priced = shopLib.priceOrder({ offered, quantities: { v1: "1", v2: "1" }, currency: "usd" });
      assert.equal(priced.ok, false);
      assert.deepEqual([...priced.problems], ["not_on_sale"]);
      assert.equal(priced.lines.length, 0, "it priced the lines it liked and dropped the rest");
      assert.match(shopLib.problemSentence("not_on_sale"), /none of it has been placed/);
    });

    it("refuses an unusable quantity rather than rounding it", () => {
      for (const quantity of ["0.5", "-1", "nine", String(shopLib.QUANTITY_MAX + 1)]) {
        const priced = shopLib.priceOrder({ offered, quantities: { v1: quantity }, currency: "usd" });
        assert.equal(priced.ok, false, `quantity ${quantity} was accepted`);
        assert.ok(priced.problems.includes("quantity_unusable"));
      }
    });

    it("says nothing was ordered rather than placing an empty order", () => {
      const priced = shopLib.priceOrder({ offered, quantities: {}, currency: "usd" });
      assert.equal(priced.ok, false);
      assert.deepEqual([...priced.problems], ["nothing_ordered"]);
    });

    it("refuses when the shop could not be read", () => {
      const priced = shopLib.priceOrder({ offered: null, quantities: { v1: "1" } });
      assert.equal(priced.ok, false);
      assert.deepEqual([...priced.problems], ["shop_unreadable"]);
    });

    it("counts in integer cents, so no float reaches a total", () => {
      const priced = shopLib.priceOrder({
        offered: shopLib.storefrontFor({
          storefront: shopRow(),
          products: [product()],
          variants: [variant({ price_cents: 1 })]
        }).offered,
        quantities: { v1: "3" },
        currency: "usd"
      });
      assert.equal(priced.subtotalCents, 3);
      assert.ok(Number.isInteger(priced.subtotalCents));
      assert.equal(shopLib.money(3, "usd"), "0.03 USD");
    });

    it("drops a blank or zero box rather than refusing a mostly-empty form", () => {
      // A shop page has a box against every line. Refusing the form because most
      // of them are empty would make a shop with twelve things unusable.
      assert.deepEqual(shopLib.quantitiesFrom({ qty_v1: "2", qty_v2: "0", qty_v3: "", other: "x" }), { v1: "2" });
    });
  });

  describe("whether the shop is open", () => {
    it("tells an unpublished shop apart from a closed one", () => {
      assert.equal(shopLib.shopWindow({ enabled: false }).code, "not_published");
      assert.equal(shopLib.shopWindow({ enabled: true, accepts_orders: false }).code, "not_taking_orders");
      assert.equal(shopLib.shopWindow({ enabled: true, accepts_orders: true }).code, "open");
      assert.equal(shopLib.shopWindow(null).code, "no_storefront");
    });

    it("treats a missing flag as closed rather than open", () => {
      // `!== true` rather than falsiness: an absent column must not open a shop.
      assert.equal(shopLib.shopWindow({}).open, false);
      assert.equal(shopLib.shopWindow({ enabled: true }).open, false);
    });
  });

  describe("the public shop", () => {
    it("renders a published shop and offers the form", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`/store/${SLUG}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /The Corner Shop/);
      assert.match(response.text, new RegExp(`action="/store/${SLUG}"`));
      assert.match(response.text, /12\.00 USD/);
    });

    it("404s an unpublished shop, a missing one, and a malformed address", async () => {
      assert.equal((await request(buildApp({ shops: [] }).app).get(`/store/${SLUG}`)).status, 404);
      const malformed = buildApp();
      assert.equal((await request(malformed.app).get("/store/NOT_A_SLUG")).status, 404);
      assert.equal(malformed.calls.length, 0, "a malformed address reached the database");
    });

    it("shows nothing that is not on sale, and gives no reason to a stranger", async () => {
      const { app } = buildApp({ variants: [variant(), variant({ id: "v2", variant_name: "Unpriced", price_cents: 0 })] });
      const response = await request(app).get(`/store/${SLUG}`);
      assert.ok(!response.text.includes("Unpriced"), "a variant nobody priced was shown to a buyer");
      assert.ok(!response.text.includes("nobody has filled it in"), "a stranger was shown the owner's reason");
    });

    it("says it is closed rather than offering a form that fails", async () => {
      const { app } = buildApp({ shops: [shopRow({ accepts_orders: false })] });
      const response = await request(app).get(`/store/${SLUG}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /not taking orders/i);
      assert.ok(!response.text.includes(`action="/store/${SLUG}"`), "a closed shop offered an order form");
      // And it still shows what they sell, because that is still true.
      assert.match(response.text, /12\.00 USD/);
    });

    it("tells a buyer nothing is charged and no card is asked for", async () => {
      const { app } = buildApp();
      const response = await request(app).get(`/store/${SLUG}`);
      assert.match(response.text, /Nothing is charged here and no card details are asked for or stored/);
    });

    it("says it could not read the shop rather than that the shop is empty", async () => {
      const { app } = buildApp({ productsOk: false });
      const response = await request(app).get(`/store/${SLUG}`);
      assert.equal(response.status, 200);
      assert.match(response.text, /does not mean the shop is empty/);
    });
  });

  describe("placing an order", () => {
    const buyer = { buyer_name: "Dale", buyer_email: "dale@example.com" };

    it("records the order and its lines at the price the server read", async () => {
      const { app, calls } = buildApp();
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "2" });
      assert.equal(response.status, 200);

      const order = writes(calls, "merchant_orders")[0].body;
      assert.equal(order.subtotal_cents, 2400);
      assert.equal(order.status, "placed");
      assert.equal(order.organization_id, ORG);
      assert.equal(order.currency, "usd");

      const lines = writes(calls, "merchant_order_lines")[0].body;
      assert.equal(lines.length, 1);
      assert.equal(lines[0].unit_price_cents, 1200);
      assert.equal(lines[0].line_total_cents, 2400);
      assert.equal(lines[0].quantity, 2);
      assert.equal(lines[0].order_id, ORDER);
    });

    // The oldest bug in online selling.
    it("ignores a price posted in the form", async () => {
      const { app, calls } = buildApp();
      await request(app).post(`/store/${SLUG}`).type("form").send({
        ...buyer, qty_v1: "1",
        price_cents: "1", unit_price_cents: "1", subtotal_cents: "1", line_total_cents: "1"
      });
      const order = writes(calls, "merchant_orders")[0].body;
      assert.equal(order.subtotal_cents, 1200, "a posted total reached the order");
      assert.equal(writes(calls, "merchant_order_lines")[0].body[0].unit_price_cents, 1200);
    });

    it("refuses the whole order when it contains something not on sale", async () => {
      const { app, calls } = buildApp({ variants: [variant(), variant({ id: "v2", price_cents: 0 })] });
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1", qty_v2: "1" });
      assert.equal(response.status, 400);
      assert.match(response.text, /none of it has been placed/);
      assert.equal(writes(calls, "merchant_orders").length, 0, "it placed a partial order");
    });

    it("refuses an empty order and a bad email, writing nothing", async () => {
      const empty = buildApp();
      const a = await request(empty.app).post(`/store/${SLUG}`).type("form").send(buyer);
      assert.equal(a.status, 400);
      assert.equal(writes(empty.calls, "merchant_orders").length, 0);

      const bad = buildApp();
      const b = await request(bad.app).post(`/store/${SLUG}`).type("form").send({ buyer_name: "Dale", buyer_email: "nope", qty_v1: "1" });
      assert.equal(b.status, 400);
      assert.match(b.text, /does not look like an email/);
      assert.equal(writes(bad.calls, "merchant_orders").length, 0);
    });

    it("refuses when the shop is closed, with 409 and no write", async () => {
      const { app, calls } = buildApp({ shops: [shopRow({ accepts_orders: false })] });
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1" });
      assert.equal(response.status, 409);
      assert.equal(writes(calls, "merchant_orders").length, 0);
    });

    it("writes the shop's organization, never one named in the request", async () => {
      const { app, calls } = buildApp({ shops: [shopRow({ organization_id: OTHER_ORG })] });
      await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1", organization_id: ORG });
      assert.equal(writes(calls, "merchant_orders")[0].body.organization_id, OTHER_ORG);
    });

    it("says so plainly when the order saved and its lines did not", async () => {
      // A total with nothing behind it is the kind of record that gets argued
      // about later. Reporting success would be the lie.
      const { app } = buildApp({ lineWriteOk: false });
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1" });
      assert.equal(response.status, 503);
      assert.match(response.text, /could not record what was in it/);
      assert.match(response.text, /Nothing has been charged/);
    });

    it("says nothing was ordered when the order row itself failed", async () => {
      const { app, calls } = buildApp({ writeOk: false });
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1" });
      assert.equal(response.status, 503);
      assert.match(response.text, /Nothing has been ordered and nothing has been charged/);
      assert.equal(writes(calls, "merchant_order_lines").length, 0, "it wrote lines against an order that does not exist");
    });

    it("tells the buyer again that nothing was charged", async () => {
      const { app } = buildApp();
      const response = await request(app).post(`/store/${SLUG}`).type("form").send({ ...buyer, qty_v1: "1" });
      assert.match(response.text, /Nothing is charged here and no card details are asked for or stored/);
    });
  });

  describe("the owner's page", () => {
    it("lists what is not on sale, with the reason", async () => {
      const { app } = buildApp({ variants: [variant(), variant({ id: "v2", variant_name: "Unpriced", price_cents: 0 })] });
      const response = await request(app).get(OWNER_PAGE);
      assert.equal(response.status, 200);
      assert.match(response.text, /Not on sale, and why/);
      assert.match(response.text, /nobody has filled it in/);
      assert.match(response.text, /Unpriced/);
    });

    it("tells the owner a read failed rather than that they sell nothing", async () => {
      for (const failure of [{ shopsOk: false }, { productsOk: false }, { variantsOk: false }, { ordersOk: false }]) {
        const { app } = buildApp(failure);
        const response = await request(app).get(OWNER_PAGE);
        assert.equal(response.status, 200);
        assert.match(response.text, /could not read part of your shop/, `${Object.keys(failure)[0]} rendered as empty`);
      }
    });

    it("scopes every owner read to the organization", async () => {
      const { app, calls } = buildApp();
      await request(app).get(OWNER_PAGE);
      const reads = calls.filter((call) => call.method === "GET");
      assert.ok(reads.length >= 4, `only ${reads.length} reads; this assertion has gone blind`);
      for (const read of reads) assert.ok(read.href.includes(`organization_id=eq.${ORG}`), `unscoped read: ${read.href}`);
    });

    it("refuses everything when the workspace cannot be resolved", async () => {
      for (const broken of [{ organization: null }, { configOk: false }]) {
        const { app, calls } = buildApp(broken);
        assert.equal((await request(app).get(OWNER_PAGE)).status, 503);
        assert.equal(calls.filter((call) => call.method === "GET").length, 0, "it read the database with no workspace");
      }
    });

    it("publishes only on an explicit yes", async () => {
      const yes = buildApp({ shops: [] });
      await request(yes.app).post("/api/business/storefront/publish").type("form").send({ slug: SLUG, enabled: "true" });
      assert.equal(writes(yes.calls, "merchant_storefronts")[0].body.enabled, true);

      // A posted form with the radio missing must not put a shop on a public URL.
      const missing = buildApp({ shops: [] });
      await request(missing.app).post("/api/business/storefront/publish").type("form").send({ slug: SLUG });
      assert.equal(writes(missing.calls, "merchant_storefronts")[0].body.enabled, false);
    });

    it("refuses a malformed address and one another organization holds", async () => {
      const bad = buildApp();
      const a = await request(bad.app).post("/api/business/storefront/publish").type("form").send({ slug: "NOT A SLUG" });
      assert.match(a.headers.location, /problem=slug_shape/);
      assert.equal(bad.calls.length, 0);

      const taken = buildApp({ shops: [{ organization_id: OTHER_ORG }] });
      const b = await request(taken.app).post("/api/business/storefront/publish").type("form").send({ slug: SLUG, enabled: "true" });
      assert.match(b.headers.location, /problem=slug_taken/);
      assert.equal(writes(taken.calls, "merchant_storefronts").length, 0);
      assert.equal(patches(taken.calls, "merchant_storefronts").length, 0);
    });

    it("updates the one shop rather than making a second", async () => {
      const { app, calls } = buildApp({ shops: [{ id: SHOP }] });
      await request(app).post("/api/business/storefront").type("form").send({ headline: "New Name" });
      assert.equal(writes(calls, "merchant_storefronts").length, 0, "it inserted a second shop");
      const patch = patches(calls, "merchant_storefronts")[0];
      assert.equal(patch.body.headline, "New Name");
      assert.ok(patch.href.includes(`organization_id=eq.${ORG}`), "the update was authorised by id alone");
    });

    it("carries the organization filter on the order status write", async () => {
      const { app, calls } = buildApp({ orders: [{ id: ORDER }] });
      await request(app).post("/api/business/orders/status").type("form").send({ order_id: ORDER, status: "cancelled", reason: "Out of stock." });
      const patch = patches(calls, "merchant_orders")[0];
      assert.ok(patch.href.includes(`organization_id=eq.${ORG}`), "an id alone authorised a write");
      assert.equal(patch.body.status, "cancelled");
      assert.equal(patch.body.cancellation_reason, "Out of stock.");
      assert.equal(calls.filter((call) => call.method === "DELETE").length, 0);
    });

    it("refuses a status it does not recognise, and an order it does not own", async () => {
      const unknown = buildApp({ orders: [{ id: ORDER }] });
      const a = await request(unknown.app).post("/api/business/orders/status").type("form").send({ order_id: ORDER, status: "posted" });
      assert.match(a.headers.location, /problem=status_unknown/);
      assert.equal(patches(unknown.calls, "merchant_orders").length, 0);

      const missing = buildApp({ orders: [] });
      const b = await request(missing.app).post("/api/business/orders/status").type("form").send({ order_id: ORDER, status: "confirmed" });
      assert.match(b.headers.location, /problem=order_missing/);
      assert.equal(patches(missing.calls, "merchant_orders").length, 0);
    });

    it("tells the owner it takes no payment and changes no stock", async () => {
      const { app } = buildApp();
      const response = await request(app).get(OWNER_PAGE);
      assert.match(response.text, /does not take payment/);
      assert.match(response.text, /does not change your stock counts/);
    });
  });

  describe("it holds no card and sends nothing", () => {
    const sources = [fs.readFileSync(ROUTES, "utf8"), fs.readFileSync(MODULE, "utf8")];

    it("reads sources worth measuring", () => {
      for (const source of sources) assert.ok(source.length > 3000, "a source file is too short; this check has gone blind");
    });

    it("names no card field and no charge path", () => {
      for (const source of sources) {
        for (const forbidden of ["card_number", "cardNumber", "cvv", "payment_token", "paymentIntent", "charges.create", "stripe.charges"]) {
          assert.ok(!source.includes(forbidden), `${forbidden} appears in the store path; no card data may be handled here`);
        }
      }
    });

    it("calls no send path", () => {
      for (const source of sources) {
        for (const forbidden of ["sendEmail", "sendSms", "sendPush", "notification_preferences", "push_subscriptions", "resend", "twilio"]) {
          assert.ok(!source.includes(forbidden), `${forbidden} appears; placing an order must not message anybody`);
        }
      }
    });

    it("decrements no stock", () => {
      for (const source of sources) {
        assert.ok(!source.includes("inventory_items"), "the store path touches inventory; nothing here decrements stock and implying it does would be a false claim");
      }
    });
  });

  describe("it is reachable", () => {
    it("is registered in server.js, so its tables are not orphans", () => {
      const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
      assert.ok(server.includes("sonara-merchant-store-routes.cjs"), "server.js does not require the store routes");
      assert.match(server, /registerMerchantStoreRoutes\(app,/, "server.js requires the module but never calls it");
    });

    it("refuses to register without every dependency it uses", () => {
      const required = ["layout", "brandCard", "linkAction", "escapeHtml", "requireBusinessManager", "getCustomerPrimaryOrganization", "getSupabaseServerConfig", "supabaseHeaders", "createRateLimiter"];
      for (const missing of required) {
        const deps = Object.fromEntries(required.filter((name) => name !== missing).map((name) => [name, () => {}]));
        assert.throws(() => registerMerchantStoreRoutes(express(), deps), new RegExp(missing), `registering without ${missing} did not throw`);
      }
    });

    it("rate-limits the public write", () => {
      const source = fs.readFileSync(ROUTES, "utf8");
      assert.match(source, /createRateLimiter\(\{[\s\S]{0,200}public_store_order/);
      assert.match(source, /app\.post\("\/store\/:slug", orderLimiter/);
    });
  });
});

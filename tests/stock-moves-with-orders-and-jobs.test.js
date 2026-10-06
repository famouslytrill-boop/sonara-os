"use strict";

// Stock that moves with orders and jobs: the application's side.
//
// The moves are two PostgreSQL functions (20261006030000), and their behaviour --
// holds, shortages, fulfilment, release, retries, job use and return, tenancy,
// and two buyers racing for the last item in two real sessions -- is proven by
// scripts/verify-migration-replay.mjs against PostgreSQL. This file proves the
// routes use them correctly: what is offered, what is refused before anything is
// written, that an order is held before any checkout opens, that a refusal
// cancels the order rather than leaving it placed with nothing held, that the
// owner's status changes move stock first and change the status only if it moved,
// and that a job's material moves the count and says so.
//
// The stock function's answers are scripted here and every call is recorded, so
// these tests assert what the route ASKED for. Re-implementing the SQL in
// JavaScript would only test the copy.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const stock = require("../lib/sonara-inventory-stock.cjs");
const storefront = require("../lib/sonara-merchant-storefront.cjs");

const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const SHOP = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "66666666-6666-4666-8666-666666666666";
const LINKED = "77777777-7777-4777-8777-777777777777";
const PLAIN = "78787878-7777-4777-8777-777777777777";
const ITEM = "99999999-9999-4999-8999-999999999999";
const USER = "12121212-1212-4212-8212-121212121212";
const SUPABASE = "https://project.supabase.co";

describe("stock moves with orders and jobs", () => {
  describe("what is available", () => {
    it("is on hand less what is held, never below zero, and nothing from an inactive item", () => {
      const levels = stock.availabilityFor({
        items: [
          { id: "a", quantity: 5, status: "active" },
          { id: "b", quantity: 2, status: "active" },
          { id: "c", quantity: 9, status: "archived" },
          { id: "d", quantity: null, status: "active" }
        ],
        held: [{ inventory_item_id: "a", quantity: 3 }, { inventory_item_id: "b", quantity: 4 }, { inventory_item_id: "a", quantity: "1" }]
      });
      assert.deepEqual({ ...levels.get("a") }, { onHand: 5, held: 4, available: 1, active: true });
      assert.equal(levels.get("b").available, 0);
      assert.equal(levels.get("c").available, 0);
      assert.equal(levels.get("d").onHand, null, "an unrecorded count read as zero");
      assert.equal(levels.get("d").available, 0);
    });
  });

  describe("what the shop offers", () => {
    const product = { id: PRODUCT, name: "Mug", status: "active" };
    const linked = { id: LINKED, product_id: PRODUCT, variant_name: "Large", price_cents: 1200, currency: "usd", status: "active", inventory_item_id: ITEM };
    const plain = { id: PLAIN, product_id: PRODUCT, variant_name: "Small", price_cents: 800, currency: "usd", status: "active", inventory_item_id: null };
    const offer = (level) => storefront.storefrontFor({ storefront: { currency: "usd" }, products: [product], variants: [linked, plain], stock: level });

    it("offers a linked version with what is available, and an unlinked one as before", () => {
      const split = offer(new Map([[ITEM, { onHand: 5, held: 2, available: 3, active: true }]]));
      assert.deepEqual(split.offered.map((entry) => [entry.variant.id, entry.available]), [[LINKED, 3], [PLAIN, null]]);
    });

    it("withholds a sold-out version and tells the owner why, with the figures", () => {
      const split = offer(new Map([[ITEM, { onHand: 2, held: 2, available: 0, active: true }]]));
      assert.deepEqual(split.offered.map((entry) => entry.variant.id), [PLAIN]);
      assert.equal(split.withheld[0].code, "sold_out");
      assert.match(split.withheld[0].reason, /sold out: 2 on hand, 2 held/);
    });

    it("withholds a linked version when stock could not be read, rather than offering it blind", () => {
      for (const level of [null, new Map()]) {
        const split = offer(level);
        assert.deepEqual(split.offered.map((entry) => entry.variant.id), [PLAIN]);
        assert.equal(split.withheld[0].code, "stock_unreadable");
      }
    });

    it("leaves stock out of it entirely for a caller that does not track it", () => {
      assert.equal(offer(undefined).offered.length, 2);
    });

    it("refuses an order for more than is available before anything is written", () => {
      const split = offer(new Map([[ITEM, { onHand: 5, held: 2, available: 3, active: true }]]));
      assert.deepEqual(storefront.priceOrder({ offered: split.offered, quantities: { [LINKED]: 4 }, currency: "usd" }).problems, ["more_than_available"]);
      assert.equal(storefront.priceOrder({ offered: split.offered, quantities: { [LINKED]: 3 }, currency: "usd" }).ok, true);
    });
  });

  describe("calling the stock functions", () => {
    it("never calls one with an id that is not one", async () => {
      const calls = [];
      const fetchImpl = async () => { calls.push(1); return { ok: true, json: async () => ({ ok: true, code: "reserved" }) }; };
      const config = { ok: true, url: SUPABASE };
      for (const args of [{ organizationId: "x", orderId: SHOP, action: "reserve" }, { organizationId: ORG, orderId: "", action: "reserve" }, { organizationId: ORG, orderId: SHOP, action: "delete" }]) {
        assert.equal((await stock.orderStock(config, () => ({}), args, fetchImpl)).ok, false);
      }
      assert.equal((await stock.materialStock(config, () => ({}), { organizationId: ORG, materialId: "nope" }, fetchImpl)).ok, false);
      assert.equal(calls.length, 0);
    });

    it("reads a reply that is not { ok, code } as a failure, not as nothing to move", async () => {
      const config = { ok: true, url: SUPABASE };
      for (const body of [null, [], {}, { ok: "true", code: "reserved" }, { ok: true }]) {
        const result = await stock.orderStock(config, () => ({}), { organizationId: ORG, orderId: SHOP, action: "reserve" }, async () => ({ ok: true, json: async () => body }));
        assert.equal(result.ok, false, JSON.stringify(body));
      }
      const refused = await stock.orderStock(config, () => ({}), { organizationId: ORG, orderId: SHOP, action: "reserve" }, async () => ({ ok: false, status: 404, json: async () => ({}) }));
      assert.equal(refused.ok, false);
    });
  });

  describe("the shop and the owner, through the routes", () => {
    let savedFetch;
    beforeEach(() => { savedFetch = global.fetch; });
    afterEach(() => { global.fetch = savedFetch; });

    function world({ quantity = 5, held = [], stockAnswer, failStockRead = false } = {}) {
      const answers = [];
      const fake = createFakeSupabase({
        url: SUPABASE,
        ids: "uuid",
        defaults: { merchant_orders: { payment_state: "unpaid", checkout_attempts: 0, refunded_cents: 0, status: "placed", created_at: () => new Date().toISOString() } },
        tables: {
          merchant_storefronts: [{ id: SHOP, organization_id: ORG, slug: "corner-shop", enabled: true, headline: "The Corner Shop", intro: "", currency: "usd", accepts_orders: true }],
          merchant_products: [{ id: PRODUCT, organization_id: ORG, name: "Mug", status: "active" }],
          merchant_product_variants: [{ id: LINKED, product_id: PRODUCT, organization_id: ORG, variant_name: "Large", price_cents: 1200, currency: "usd", status: "active", inventory_item_id: ITEM }],
          inventory_items: [{ id: ITEM, organization_id: ORG, name: "Mug", quantity, status: "active" }],
          inventory_reservations: held.map((quantityHeld) => ({ organization_id: ORG, inventory_item_id: ITEM, quantity: quantityHeld, state: "held" }))
        },
        rpc: {
          inventory_order_stock: (body) => {
            answers.push(body);
            return typeof stockAnswer === "function" ? stockAnswer(body) : (stockAnswer || { ok: true, code: "reserved", held: 1, untracked: 0 });
          }
        }
      });
      const inner = async (input) => { throw new Error(`refused a request to ${String(input)}`); };
      global.fetch = fake.install(inner);
      if (failStockRead) {
        const installed = global.fetch;
        global.fetch = async (input, init) => (String(input).includes("/rest/v1/inventory_items") ? { ok: false, status: 500, json: async () => ({}) } : installed(input, init));
      }
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      require("../routes/sonara-merchant-store-routes.cjs")(app, {
        layout: ({ heading, body, sections = [] }) => `<h1>${heading}</h1><p>${body}</p>${sections.join("")}`,
        brandCard: (title, body) => `<section><h2>${title}</h2>${body}</section>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
        requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: USER }; next(); },
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
        getSupabaseServerConfig: () => ({ ok: true, url: SUPABASE, serviceRoleKey: "service-role-placeholder" }),
        supabaseHeaders: (config, { prefer } = {}) => ({ apikey: "service-role-placeholder", ...(prefer ? { Prefer: prefer } : {}) }),
        createRateLimiter: () => (req, res, next) => next(),
        getEnv: () => ""
      });
      return { app, fake, answers };
    }

    const order = (app, quantity) => request(app).post("/store/corner-shop").type("form")
      .send({ [`qty_${LINKED}`]: String(quantity), buyer_name: "Ada", buyer_email: "ada@example.com" });

    it("shows how many are left and will not let the form ask for more", async () => {
      const { app } = world({ quantity: 5, held: [2] });
      const page = await request(app).get("/store/corner-shop");
      assert.match(page.text, /max="3"/);
      assert.match(page.text, /3 left/);
    });

    it("hides a sold-out version from the shop and tells the owner it is sold out", async () => {
      const { app } = world({ quantity: 2, held: [2] });
      const page = await request(app).get("/store/corner-shop");
      assert.doesNotMatch(page.text, /qty_/);
      const owner = await request(app).get("/business-builder/owner/store");
      assert.match(owner.text, /sold out: 2 on hand, 2 held/);
    });

    it("offers nothing linked when the stock read fails, and says so to the owner", async () => {
      const { app } = world({ failStockRead: true });
      const page = await request(app).get("/store/corner-shop");
      assert.doesNotMatch(page.text, /qty_/);
      const owner = await request(app).get("/business-builder/owner/store");
      assert.match(owner.text, /could not read, so it is not being offered/);
    });

    it("holds the stock for an order, for the right business and order, before anything else", async () => {
      const { app, fake, answers } = world();
      const response = await order(app, 2);
      assert.equal(response.status, 200, response.text);
      const [placed] = fake.rows("merchant_orders");
      assert.deepEqual(answers, [{ p_organization_id: ORG, p_order_id: placed.id, p_action: "reserve" }]);
      assert.equal(placed.status, "placed");
    });

    it("refuses more than is available without writing an order or asking the stock function", async () => {
      const { app, fake, answers } = world({ quantity: 5, held: [4] });
      const response = await order(app, 2);
      assert.equal(response.status, 400);
      assert.match(response.text, /more than the shop has left/);
      assert.deepEqual(fake.rows("merchant_orders"), []);
      assert.deepEqual(answers, []);
    });

    it("cancels the order with its reason when the stock function refuses, and charges nothing", async () => {
      const { app, fake } = world({ stockAnswer: { ok: false, code: "insufficient_stock", shortages: [{ name: "Mug", needed: 2, available: 1 }] } });
      const response = await order(app, 2);
      assert.equal(response.status, 409);
      assert.match(response.text, /Mug: only 1 left/);
      assert.match(response.text, /Nothing has been charged/);
      const [cancelled] = fake.rows("merchant_orders");
      assert.equal(cancelled.status, "cancelled", "a refused order was left placed with nothing held");
      assert.match(cancelled.cancellation_reason, /Sold out before the order could be held/);
    });

    it("cancels the order when the stock check cannot run, rather than taking it unheld", async () => {
      const { app, fake } = world({ stockAnswer: () => ({ not: "a reply" }) });
      const response = await order(app, 1);
      assert.equal(response.status, 503);
      assert.match(response.text, /could not check the shop's stock/);
      assert.equal(fake.rows("merchant_orders")[0].status, "cancelled");
    });

    const setStatus = (app, orderId, status) => request(app).post("/api/business/orders/status").type("form").send({ order_id: orderId, status });
    const seedOrder = (fake, status) => {
      fake.rows("merchant_orders");
      return fetch(`${SUPABASE}/rest/v1/merchant_orders`, {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ organization_id: ORG, storefront_id: SHOP, buyer_name: "Ada", buyer_email: "ada@example.com", status, subtotal_cents: 1200, currency: "usd" })
      }).then((response) => response.json()).then((rows) => rows[0].id);
    };

    it("takes stock off the shelf before marking an order fulfilled, and says what moved", async () => {
      const { app, fake, answers } = world({ stockAnswer: { ok: true, code: "consumed", consumed: 1, unreserved: 0, untracked: 0 } });
      const id = await seedOrder(fake, "confirmed");
      const response = await setStatus(app, id, "fulfilled");
      assert.match(response.headers.location, /done=status&stock=fulfil&moved=1/);
      assert.deepEqual(answers.map((body) => body.p_action), ["fulfil"]);
      assert.equal(fake.rows("merchant_orders")[0].status, "fulfilled");
      const page = await request(app).get(response.headers.location);
      assert.match(page.text, /Stock taken off the shelf for 1 line\./);
    });

    it("leaves the order where it was when the stock could not move", async () => {
      const { app, fake } = world({ stockAnswer: { ok: false, code: "rejected" } });
      const id = await seedOrder(fake, "confirmed");
      const response = await setStatus(app, id, "fulfilled");
      assert.match(response.headers.location, /problem=stock_not_moved/);
      assert.equal(fake.rows("merchant_orders")[0].status, "confirmed", "the order said fulfilled while its stock had not moved");
    });

    it("gives held stock back when an order is cancelled, and holds it again when it is reinstated", async () => {
      const { app, fake, answers } = world({ stockAnswer: (body) => (body.p_action === "release" ? { ok: true, code: "released", released: 1, untracked: 0 } : { ok: true, code: "reserved", held: 1, untracked: 0 }) });
      const id = await seedOrder(fake, "placed");
      await setStatus(app, id, "cancelled");
      await setStatus(app, id, "placed");
      assert.deepEqual(answers.map((body) => body.p_action), ["release", "reserve"]);
      assert.equal(fake.rows("merchant_orders")[0].status, "placed");
    });

    it("will not reinstate a cancelled order the stock can no longer cover", async () => {
      const { app, fake } = world({ stockAnswer: { ok: false, code: "insufficient_stock", shortages: [{ name: "Mug", available: 0 }] } });
      const id = await seedOrder(fake, "cancelled");
      const response = await setStatus(app, id, "confirmed");
      assert.match(response.headers.location, /problem=stock_short/);
      assert.equal(fake.rows("merchant_orders")[0].status, "cancelled");
    });

    it("moves no stock for a change that does not ship, cancel or reinstate", async () => {
      const { app, fake, answers } = world();
      const id = await seedOrder(fake, "placed");
      await setStatus(app, id, "confirmed");
      assert.deepEqual(answers, []);
    });
  });

  describe("a job's material, through the record routes", () => {
    const WORK_ORDER = "13131313-1313-4313-8313-131313131313";
    let savedFetch;
    beforeEach(() => { savedFetch = global.fetch; });
    afterEach(() => { global.fetch = savedFetch; });

    function jobs({ answer }) {
      const answers = [];
      const fake = createFakeSupabase({
        url: SUPABASE,
        ids: "uuid",
        tables: {
          business_work_orders: [{ id: WORK_ORDER, organization_id: ORG, title: "Rewire the shop", status: "in_progress" }],
          inventory_items: [{ id: ITEM, organization_id: ORG, name: "Cable (m)", quantity: 10, status: "active" }]
        },
        rpc: { inventory_material_stock: (body) => { answers.push(body); return answer; } }
      });
      global.fetch = fake.install(async (input) => { throw new Error(`refused ${String(input)}`); });
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());
      const authenticate = (req, res, next) => { req.sonaraUser = { id: USER }; next(); };
      require("../routes/sonara-last9-routes.cjs")(app, {
        layout: ({ heading, body, sections = [] }) => `<h1>${heading}</h1><p>${body}</p>${sections.join("")}`,
        brandCard: (title, body) => `<article><h2>${title}</h2>${body}</article>`,
        linkAction: (href, label) => `<a href="${href}">${label}</a>`,
        escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
        requireCustomer: authenticate,
        requireBusinessManager: authenticate,
        requireWorkspaceAccess: () => authenticate,
        getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
        getSupabaseServerConfig: () => ({ ok: true, url: SUPABASE, serviceRoleKey: "service-role-placeholder" })
      });
      return { app, fake, answers };
    }

    const useMaterial = (app, status) => request(app).post("/api/business/work-order-materials").type("form").set("accept", "text/html")
      .send({ work_order_id: WORK_ORDER, inventory_item_id: ITEM, quantity_used: "12", material_status: status });

    it("records material used on a job against its stock item, and says the count went below zero", async () => {
      const { app, fake, answers } = jobs({ answer: { ok: true, code: "consumed", quantity: 12, onHand: -2 } });
      const response = await useMaterial(app, "used");
      assert.equal(response.status, 303, response.text);
      const [material] = fake.rows("business_work_order_materials");
      // Picked from inventory with no typed description: refused as
      // missing_required on every save until the line filled its name from the item.
      assert.ok(material, "the material line was not saved");
      assert.equal(material.description, "Cable (m)");
      assert.deepEqual(answers, [{ p_organization_id: ORG, p_material_id: material.id }]);
      assert.match(response.headers.location, /line=saved&stock=consumed&qty=12&on_hand=-2/);
      const page = await request(app).get(response.headers.location);
      assert.match(page.text, /Taken from stock: 12\. On hand is now -2 -- below zero/);
    });

    it("keeps the line when the count could not move, and says so rather than staying silent", async () => {
      const { app, fake } = jobs({ answer: { garbled: true } });
      const response = await useMaterial(app, "used");
      assert.match(response.headers.location, /line=saved&stock=not_moved/);
      assert.equal(fake.rows("business_work_order_materials").length, 1);
      const page = await request(app).get(response.headers.location);
      assert.match(page.text, /the stock count could not be updated just now/);
    });

    it("says what a refused line was refused for, which the page used to leave unsaid", async () => {
      const { app } = jobs({ answer: { ok: true, code: "consumed" } });
      const page = await request(app).get(`/business-builder/owner/work-orders/${WORK_ORDER}?problem=inventory_item_id_not_yours`);
      assert.match(page.text, /does not belong to this workspace/);
    });
  });
});

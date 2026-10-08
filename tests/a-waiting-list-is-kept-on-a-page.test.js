"use strict";

// The waiting list and bookable resources were stored by two JSON endpoints and
// shown nowhere. These tests drive the page a manager uses: its own forms,
// posted as a browser posts them, and what the page then shows.
//
// Offering an opening records it and tells nobody. The page has to say that
// next to the button, because "Offered" read on its own means "told".

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const request = require("supertest");
const { createFakeSupabase } = require("./helpers/fake-supabase.cjs");
const registerOperationsExpansionRoutes = require("../routes/sonara-operations-expansion-routes.cjs");
const { escapeHtml } = require("../lib/sonara-shell.cjs");

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const USER = "22222222-2222-4222-8222-222222222222";
const PAGE = "/business-builder/owner/waitlist";

function buildApp(fake, organizationId = ORG) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  registerOperationsExpansionRoutes(app, {
    requireBusinessManager: (req, res, next) => { req.sonaraUser = { id: USER }; next(); },
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId }),
    getSupabaseServerConfig: () => ({ ok: true, url: fake.url, serviceRoleKey: "server-only" }),
    supabaseHeaders: () => ({ apikey: "server-only", Authorization: "Bearer server-only" }),
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml
  });
  return app;
}

const browser = (app, url, fields) => request(app).post(url).type("form").set("accept", "text/html").send(fields);
const open = (app, url = PAGE) => request(app).get(url).set("accept", "text/html");

describe("a business keeps its waiting list on a page", () => {
  let fake;
  let savedFetch;

  function start(tables = {}) {
    fake = createFakeSupabase({
      users: {},
      tables,
      ids: "uuid",
      defaults: {
        business_bookings: { created_at: () => new Date().toISOString() },
        business_assets: { created_at: () => new Date().toISOString() }
      }
    });
    savedFetch = global.fetch;
    global.fetch = fake.install(savedFetch);
    return buildApp(fake);
  }

  afterEach(() => {
    if (savedFetch) global.fetch = savedFetch;
    savedFetch = null;
  });

  it("adds a resource and a waiting customer from the page, and lists both", async () => {
    const app = start();
    const before = await open(app);
    assert.equal(before.status, 200);
    assert.ok(before.text.includes('action="/api/business/reservation-resources"'), "the page has no way to add a bookable resource");
    assert.ok(before.text.includes('action="/api/business/waitlist"'), "the page has no way to add somebody to the waiting list");
    assert.match(before.text, /Nobody is waiting\./);

    const resource = await browser(app, "/api/business/reservation-resources", { back: PAGE, name: "Window table", resource_type: "furniture", capacity: "4" });
    assert.equal(resource.status, 303, `adding a resource answered ${resource.status}: ${resource.text.slice(0, 200)}`);
    assert.equal(resource.headers.location, `${PAGE}?done=resource`);
    const [asset] = fake.rows("business_assets");
    assert.equal(asset.organization_id, ORG);
    assert.equal(asset.metadata.bookable, true);
    assert.equal(asset.metadata.capacity, 4);

    const withResource = await open(app);
    assert.ok(withResource.text.includes(`name="resource_ids" value="${asset.id}"`), "the waiting-list form does not offer the resource just added");

    // One ticked box arrives as a string, not an array.
    const added = await browser(app, "/api/business/waitlist", { back: PAGE, customer_name: "Priya", customer_phone: "07700 900123", party_size: "3", preferred_start: "2026-10-09T18:00", resource_ids: asset.id });
    assert.equal(added.headers.location, `${PAGE}?done=waitlist`, `adding answered ${added.status}`);
    const [entry] = fake.rows("business_bookings");
    assert.equal(entry.status, "requested");
    assert.equal(entry.metadata.waitlist, true);
    assert.equal(entry.metadata.party_size, 3);
    assert.deepEqual(entry.metadata.resource_ids, [asset.id], "a single ticked resource was dropped");

    const listed = await open(app, `${PAGE}?done=waitlist`);
    assert.match(listed.text, /Added to the waiting list\./);
    assert.match(listed.text, /Priya/);
    assert.match(listed.text, /Window table/, "the entry does not say what it is waiting for");
    assert.ok(listed.text.includes(`href="/business-builder/owner/bookings/${entry.id}"`), "the entry has no way to confirm or cancel it");
  });

  it("refuses an entry nobody could be reached on, and says why", async () => {
    const app = start();
    const refused = await browser(app, "/api/business/waitlist", { back: PAGE, party_size: "2" });
    assert.equal(refused.headers.location, `${PAGE}?problem=waitlist_contact_required`);
    assert.equal(fake.rows("business_bookings").length, 0);
    const shown = await open(app, refused.headers.location);
    assert.match(shown.text, /a name, an email or a phone number/);
  });

  it("marks an opening offered and says the customer was not told", async () => {
    const id = crypto.randomUUID();
    const app = start({ business_bookings: [{ id, organization_id: ORG, customer_name: "Sam", status: "requested", created_at: "2026-10-01T09:00:00Z", metadata: { waitlist: true, waitlist_state: "waiting", party_size: 2 } }] });
    const shown = await open(app);
    assert.ok(shown.text.includes(`action="/api/business/waitlist/${id}/offer"`), "the waiting entry has no offer button");
    assert.match(shown.text, /does not send the customer anything/, "the page does not say offering tells nobody");

    const offered = await browser(app, `/api/business/waitlist/${id}/offer`, { back: PAGE });
    assert.equal(offered.headers.location, `${PAGE}?done=offer`);
    assert.equal(fake.rows("business_bookings")[0].metadata.waitlist_state, "offered");
    const after = await open(app, offered.headers.location);
    assert.match(after.text, /has not been told/);
    assert.ok(!after.text.includes(`action="/api/business/waitlist/${id}/offer"`), "an entry already offered is offered again");
  });

  it("does not offer another business's entry", async () => {
    const id = crypto.randomUUID();
    const app = start({ business_bookings: [{ id, organization_id: OTHER_ORG, customer_name: "Elsewhere", status: "requested", metadata: { waitlist: true, waitlist_state: "waiting" } }] });
    const refused = await browser(app, `/api/business/waitlist/${id}/offer`, { back: PAGE });
    assert.equal(refused.headers.location, `${PAGE}?problem=waitlist_entry_not_found`);
    assert.equal(fake.rows("business_bookings")[0].metadata.waitlist_state, "waiting");
    const listed = await open(app);
    assert.doesNotMatch(listed.text, /Elsewhere/, "another business's waiting customer was listed");
  });

  it("does not show a list it could not read as empty", async () => {
    const app = start();
    const installed = global.fetch;
    global.fetch = async (input, init = {}) => {
      if (String(typeof input === "string" ? input : input?.url).includes("/rest/v1/business_bookings?")) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return installed(input, init);
    };
    const shown = await open(app);
    assert.match(shown.text, /could not read these just now/);
    assert.doesNotMatch(shown.text, /Nobody is waiting/, "a failed read was shown as nobody waiting");
  });

  it("still answers an API client with JSON", async () => {
    const app = start();
    // Unknown resources cannot be discarded silently and then advertised as
    // a successful booking. First prove the new fail-closed API contract.
    const invalid = await request(app).post("/api/business/waitlist")
      .send({ customerEmail: "a@example.com", resourceIds: ["not-a-uuid"] });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "invalid_resource_ids");
    assert.equal(fake.rows("business_bookings").length, 0);
    // An ordinary valid JSON client can still create a waiting entry.
    const created = await request(app).post("/api/business/waitlist").send({ customerEmail: "a@example.com" });
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    assert.deepEqual(fake.rows("business_bookings")[0].metadata.resource_ids, []);
    const listed = await request(app).get("/api/business/waitlist");
    assert.equal(listed.body.waitlist.length, 1);
    const refused = await request(app).post("/api/business/reservation-resources").send({});
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, "resource_name_required");
  });
});

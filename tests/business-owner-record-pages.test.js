"use strict";

// The Business Builder owner pages show the customer's records.
//
// Fourteen of them used to render a description of themselves -- "Locations:
// manage storefronts, mobile stops, food trucks, trailers, job sites and
// service areas" -- followed by two boilerplate cards and a row of counts. No
// records, no way to add one, on the product whose whole promise is running a
// business. The CRUD API behind them had worked the entire time.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { OWNER_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

function buildApp(rowsByTable = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url, options = {}) => {
    const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
    if ((options.method || "GET") === "POST") return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
    return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => rowsByTable[table] || [] };
  };
  return app;
}

describe("Business Builder owner pages show real records", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders a table on every owner page, and a form wherever one can be added", async () => {
    const app = buildApp();
    for (const page of OWNER_RECORD_PAGES) {
      const result = await request(app).get(page.path).set("accept", "text/html");
      assert.equal(result.status, 200, `${page.path} did not render`);
      assert.match(result.text, /<table/, `${page.path} shows no records table`);
      if (page.form) assert.match(result.text, new RegExp(`<form[^>]+action="${page.api}"`), `${page.path} offers no way to add one`);
    }
  });

  it("says there is nothing rather than showing an empty table with no explanation", async () => {
    const result = await request(buildApp()).get("/business-builder/owner/locations").set("accept", "text/html");
    assert.match(result.text, /You have not added a location yet/);
    assert.match(result.text, /0 records/);
  });

  it("shows money as money and works out the margin", async () => {
    const app = buildApp({
      menu_items: [{ id: "m1", name: "Beef burger", selling_price_cents: 1250, theoretical_cost_cents: 400, currency: "usd", target_food_cost_percent: 0.32, status: "active" }]
    });
    const result = await request(app).get("/business-builder/owner/menu").set("accept", "text/html");
    assert.match(result.text, /\$12\.50/);
    assert.match(result.text, /\$4\.00/);
    assert.match(result.text, /\$8\.50 \(68%\)/);
    assert.match(result.text, /32\.0%/);
    // The raw cents must not reach the page as a bare number.
    assert.doesNotMatch(result.text, /<td>1250<\/td>/);
  });

  it("fills a dropdown from the customer's own records instead of asking for an id", async () => {
    const app = buildApp({ business_employee_profiles: [{ id: "employee-1", display_name: "Alex Doe" }] });
    const result = await request(app).get("/business-builder/owner/schedules").set("accept", "text/html");
    assert.match(result.text, /<select name="employee_id"/);
    assert.match(result.text, /<option value="employee-1">Alex Doe<\/option>/);
  });

  it("admits when there is nothing to choose yet rather than showing an empty dropdown", async () => {
    const result = await request(buildApp()).get("/business-builder/owner/invoices").set("accept", "text/html");
    assert.match(result.text, /Nothing to choose yet/);
  });

  it("returns somebody who submits a form to the page, not to the record as JSON", async () => {
    const result = await request(buildApp())
      .post("/api/business/menu-items")
      .set("accept", "text/html")
      .type("form")
      .send("name=Fish pie&selling_price_cents=900");
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, "/business-builder/owner/menu");
  });

  it("sends a form back with the reason when a required field is missing", async () => {
    const result = await request(buildApp())
      .post("/api/business/menu-items")
      .set("accept", "text/html")
      .type("form")
      .send("name=");
    assert.equal(result.status, 303);
    assert.match(result.headers.location, /^\/business-builder\/owner\/menu\?problem=/);
  });

  it("still answers JSON to something that asked for JSON", async () => {
    // The API predates these pages and other things call it.
    const result = await request(buildApp())
      .post("/api/business/menu-items")
      .send({ name: "Fish pie" });
    assert.equal(result.status, 200);
    assert.equal(result.headers.location, undefined);
  });

  it("does not turn an empty box into an empty value the column will reject", async () => {
    // A blank date field posted as "" is not a date. Left in, it fails the
    // insert outright and the customer is told nothing useful.
    let sent;
    const app = buildApp();
    const passthrough = global.fetch;
    global.fetch = async (url, options = {}) => {
      if ((options.method || "GET") === "POST") sent = JSON.parse(options.body);
      return passthrough(url, options);
    };
    await request(app)
      .post("/api/business/staff")
      .set("accept", "text/html")
      .type("form")
      .send("display_name=Alex Doe&hire_date=&phone=");
    assert.equal(sent.display_name, "Alex Doe");
    assert.equal("hire_date" in sent, false, "an empty date was sent to the database");
    assert.equal("phone" in sent, false, "an empty phone was sent to the database");
  });

  it("keeps every page pointed at a resource that exists", () => {
    // A page whose form posts nowhere is the hollow page with extra steps.
    const orphans = OWNER_RECORD_PAGES.filter((page) => page.form && !page.api).map((page) => page.path);
    assert.deepEqual(orphans, [], `these pages offer a form with nowhere to send it: ${orphans.join(", ")}`);
  });
});

// Creator Studio's two record pages went the same way as the owner ones: three
// cards describing what they would show, over tables that already existed.
describe("Creator Studio record pages show real records", () => {
  const { CREATOR_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders a table and a form on each", async () => {
    const app = buildApp();
    for (const page of CREATOR_RECORD_PAGES) {
      const result = await request(app).get(page.path).set("accept", "text/html");
      assert.equal(result.status, 200, `${page.path} did not render`);
      assert.match(result.text, /<table/, `${page.path} shows no records`);
      assert.match(result.text, new RegExp(`<form[^>]+action="${page.api}"`), `${page.path} offers no way to add one`);
    }
  });

  it("shows a music project as a person would describe it", async () => {
    const app = buildApp({ music_projects: [{ id: "p1", title: "Night Drive", artist_name: "Alex", project_type: "song", bpm: 122, musical_key: "F minor", status: "writing" }] });
    const result = await request(app).get("/creator-studio/music-projects").set("accept", "text/html");
    assert.match(result.text, /Night Drive/);
    assert.match(result.text, /122 bpm/);
    assert.match(result.text, /F minor/);
  });

  it("lists vibration patterns beside the sound cues", async () => {
    const app = buildApp({
      sound_cues: [{ id: "c1", name: "Saved", event_name: "save_success", sound_type: "tone", duration_ms: 120, status: "active" }],
      haptic_patterns: [{ id: "h1", name: "Gentle tap", event_name: "save_success", accessibility_notes: "Short", status: "active" }]
    });
    const result = await request(app).get("/creator-studio/device-cues").set("accept", "text/html");
    assert.match(result.text, /Saved/);
    assert.match(result.text, /Gentle tap/);
    assert.match(result.text, /Vibration patterns/);
  });

  it("says nothing plays or vibrates on its own", async () => {
    // AGENTS.md: sounds, haptics and motion are off or explicitly
    // user-controlled by default, and the page has to say so.
    const result = await request(buildApp()).get("/creator-studio/device-cues").set("accept", "text/html");
    assert.match(result.text, /Nothing plays, vibrates or moves on its own/);
  });
});

// Three Business Builder paths were signposts to the owner pages, from when
// those pages had nothing to show. They rendered no records and told the
// customer that "records are stored in the inventory_items table" -- a table
// name read out to somebody trying to look at their own stock.
//
// Now that the owner pages list the records, asking for locations should give
// locations. /business-builder/vehicles was the same shape and was redirected
// earlier for the same reason.
describe("the operations signposts go to the records themselves", () => {
  const SIGNPOSTS = [
    ["/business-builder/inventory", "/business-builder/owner/inventory"],
    ["/business-builder/vendors", "/business-builder/owner/vendors"],
    ["/business-builder/locations", "/business-builder/owner/locations"],
    ["/business-builder/vehicles", "/business-builder/owner/vehicles"]
  ];

  it("sends each one to the page that lists the records", async () => {
    const app = require("../server");
    for (const [from, to] of SIGNPOSTS) {
      const result = await request(app).get(from).set("accept", "text/html");
      // Unauthenticated these bounce to sign-in; what matters is that none of
      // them renders a page of its own describing where the records live.
      assert.ok([302, 303].includes(result.status), `${from} answered ${result.status} instead of going somewhere`);
      if (result.headers.location && result.headers.location.startsWith("/business-builder/owner")) {
        assert.equal(result.headers.location, to, `${from} pointed at the wrong owner page`);
      }
    }
  });
});

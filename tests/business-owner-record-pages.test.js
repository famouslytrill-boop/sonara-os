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
      // A form usually posts to the page's own endpoint. Clocking in posts to
      // /api/business/time-entries/start instead, because the server stamps the
      // time -- a form that let somebody type their own clock-in time would be
      // a different feature. So the assertion is that the form posts where the
      // page says it does, which is the property that matters either way.
      if (page.form) {
        const action = page.form.action || page.api;
        assert.match(result.text, new RegExp(`<form[^>]+action="${action}"`), `${page.path} offers no way to add one`);
      }
    }
  });

  it("lets somebody clock in and clock out", async () => {
    // Both endpoints have worked the whole time. This page listed the entries
    // and offered no form at all, so a business could read its timesheets and
    // never record one -- the feature was reachable only by an API client. The
    // exemption list carried both as "NOT YET EXAMINED".
    const app = buildApp({
      employee_time_entries: [
        { id: "t-open", status: "open", clock_in_at: "2026-08-12T09:00:00Z", clock_out_at: null, break_minutes: 0 },
        { id: "t-done", status: "submitted", clock_in_at: "2026-08-11T09:00:00Z", clock_out_at: "2026-08-11T17:00:00Z", break_minutes: 30 }
      ],
      business_employee_profiles: [{ id: "e-1", display_name: "Sam" }]
    });
    const result = await request(app).get("/business-builder/owner/time").set("accept", "text/html");
    assert.equal(result.status, 200);

    // Clock in posts to /start, not to the list endpoint: the server stamps the
    // time, and a form accepting a typed clock-in time is a different feature.
    assert.match(result.text, /<form[^>]+action="\/api\/business\/time-entries\/start"/, "there is no way to clock in");
    assert.doesNotMatch(result.text, /<form[^>]+action="\/api\/business\/time-entries"/, "clocking in is posting to the list endpoint, which does not stamp the time");

    // Clock out takes the entry in the body, so the row carries a hidden id
    // rather than a path parameter.
    assert.match(result.text, /<form[^>]+action="\/api\/business\/time-entries\/stop"/, "there is no way to clock out");
    assert.match(result.text, /name="id" value="t-open"/, "the open entry does not offer a clock-out");

    // And a finished shift says so instead of offering a button that would fail.
    assert.match(result.text, /Already clocked out/);
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

  it("does not tell a customer their cue will play, because it will not", async () => {
    // AGENTS.md: sounds, haptics and motion are off or explicitly
    // user-controlled by default, and the page has to say so. It did, and it
    // also said "a cue only runs when something you do asks for it" -- which
    // says a cue runs. Nothing reads sound_cues or haptic_patterns anywhere in
    // the runtime; the sound and vibration the app makes come from a hardcoded
    // map of five kinds in public/sensory-device-client.js.
    const result = await request(buildApp()).get("/creator-studio/device-cues").set("accept", "text/html");
    assert.match(result.text, /does not make it play/);
    assert.match(result.text, /stay off until you turn them on/);
    assert.doesNotMatch(result.text, /a cue only runs when/, "the page is back to promising playback");
  });

  // The form under an `also` block is new machinery, and the failure it can
  // have is the one that shipped on every record form once already: a payload
  // naming a column that is not there is rejected by PostgREST, and every stub
  // in the suite accepts it, so the button works and nothing saves.
  it("asks an also-block form only for columns that exist", () => {
    const { CREATOR_RECORD_PAGES, ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
    const { tableColumns } = require("../lib/sonara-migration-columns.cjs");
    const blocks = [...CREATOR_RECORD_PAGES, ...ALL_OWNER_PAGES].flatMap((page) => (page.also || []).map((side) => ({ page, side })));
    assert.ok(blocks.length >= 1, "no also blocks found; this check has gone blind");
    const withForms = blocks.filter(({ side }) => side.form);
    assert.ok(withForms.length >= 1, "no also block declares a form; this check would pass on nothing");

    const wrong = [];
    for (const { side } of withForms) {
      const columns = tableColumns(side.table);
      if (!columns) {
        wrong.push(`${side.table} is not in the migrations`);
        continue;
      }
      // Without an endpoint the form renders no action a customer can press.
      if (!side.form.action && !side.api) wrong.push(`${side.table} has a form and no endpoint`);
      if (!columns.has("organization_id")) wrong.push(`${side.table} has no organization_id, so it cannot be tenant scoped`);
      for (const field of side.form.fields) {
        if (!columns.has(field.name)) wrong.push(`${side.table} has no column ${field.name}`);
      }
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  // Four booleans shown as one column of what is on. The trap is the one this
  // repository keeps finding in a different shape: absent is not false. A row
  // whose columns did not come back would otherwise render "Nothing", telling a
  // customer their profile uses no sound on the strength of columns nobody read.
  it("does not report a missing toggle as a toggle that is off", () => {
    const { CREATOR_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
    const cues = CREATOR_RECORD_PAGES.find((entry) => entry.path === "/creator-studio/device-cues");
    const profiles = (cues.also || []).find((side) => side.table === "sensory_feedback_profiles");
    assert.ok(profiles, "no feedback profiles block; this check has gone blind");
    const uses = profiles.columns.find((column) => column.label === "Uses");
    assert.ok(uses, "no Uses column");

    assert.equal(uses.value({}), "Not set", "a row with none of the columns read as all four off");
    assert.equal(uses.value({ sound_enabled: null, vibration_enabled: null, motion_enabled: null, location_enabled: null }), "Not set");
    assert.equal(uses.value({ sound_enabled: false, vibration_enabled: false, motion_enabled: false, location_enabled: false }), "Nothing", "all four off is an answer and must say so");
    assert.equal(uses.value({ sound_enabled: true, vibration_enabled: false, motion_enabled: false, location_enabled: false }), "sound");
    assert.equal(uses.value({ sound_enabled: true, vibration_enabled: true, motion_enabled: false, location_enabled: false }), "sound, vibration");
  });

  // A boolean rendered as "true"/"false" is the schema talking to the customer.
  it("offers the toggles as yes and no, not as true and false", async () => {
    const result = await request(buildApp()).get("/creator-studio/device-cues").set("accept", "text/html");
    assert.match(result.text, /name="sound_enabled"/, "the profile form did not render");
    const control = result.text.slice(result.text.indexOf('name="sound_enabled"'));
    const select = control.slice(0, control.indexOf("</select>"));
    assert.match(select, /<option value="false">No</);
    assert.match(select, /<option value="true">Yes</);
  });

  // The inverse of the selected-but-unused defect, and the one that shipped
  // silently rather than loudly.
  //
  // A record page hand-writes two things that have to agree: `select`, the
  // columns it asks Supabase for, and `columns`, the accessors that read them.
  // A column read but not asked for is `undefined` on every row, so the page
  // renders its fallback -- "Not set", "None", "Not recorded" -- for every
  // record forever. It looks like a working page over a column nobody filled
  // in, which is indistinguishable from the truth by eye.
  //
  // Four record pages were hand-written in one day when this was added, each
  // with its own select string, and nothing compared the two.
  it("asks for every column its pages actually render", () => {
    const pages = require("../lib/sonara-owner-record-pages.cjs");
    const findings = [];
    let reads = 0;

    const examine = (label, select, columns) => {
      // A page selecting "*" gets everything and cannot have this fault.
      if (!select || select === "*" || !Array.isArray(columns)) return;
      const asked = new Set(String(select).split(",").map((entry) => entry.trim()));
      for (const column of columns) {
        if (typeof column.value !== "function") continue;
        for (const match of column.value.toString().matchAll(/\brow\.([a-z0-9_]+)/g)) {
          reads += 1;
          if (!asked.has(match[1])) findings.push(`${label}: column "${column.label}" reads row.${match[1]}, which its select does not ask for`);
        }
      }
    };

    for (const value of Object.values(pages)) {
      if (!Array.isArray(value)) continue;
      for (const page of value) {
        if (!page || !page.path) continue;
        examine(page.path, page.select, page.columns);
        for (const child of pages.childrenOf(page)) examine(`${page.path} → ${child.table}`, child.select, child.columns);
        for (const side of page.also || []) examine(`${page.path} → ${side.table}`, side.select, side.columns);
      }
    }

    assert.ok(reads >= 200, `only ${reads} column reads examined; this check has gone blind`);
    assert.deepEqual(findings, [], `these columns render their fallback on every row:\n  ${findings.join("\n  ")}`);
  });

  // The other half, and the half that would rot silently: the copy above is
  // only honest while nothing reads these tables. If somebody builds the
  // consumer, this fails and says which file to look at -- rather than leaving
  // a page telling customers their cues do nothing after they started working.
  it("still has no consumer for the tables that copy is about", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.join(__dirname, "..");
    const files = [path.join(root, "server.js")];
    for (const directory of ["routes", "lib", "public"]) {
      for (const name of fs.readdirSync(path.join(root, directory))) {
        if (/\.(cjs|js|mjs)$/.test(name)) files.push(path.join(root, directory, name));
      }
    }
    assert.ok(files.length > 50, `only ${files.length} runtime files read; this check has gone blind`);

    // The record page writes and lists them, which is the surface the copy is
    // about. Anything else naming them is a consumer.
    const surface = new Set(["sonara-owner-record-pages.cjs", "sonara-last9-routes.cjs", "sonara-tenant-scoped-tables.cjs", "sonara-database-contract.cjs"]);
    const consumers = [];
    for (const file of files) {
      if (surface.has(path.basename(file))) continue;
      const source = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/gm, "$1 ");
      if (/\b(sound_cues|haptic_patterns)\b/.test(source)) consumers.push(path.relative(root, file));
    }
    assert.deepEqual(consumers, [], "something reads these now, so /creator-studio/device-cues must stop saying nothing does");
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

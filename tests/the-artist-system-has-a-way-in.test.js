"use strict";

// The five artist-system tables, reached the way a customer reaches them.
//
// Migration 016 created eight tables with row level security and indexes.
// routes/creator-artist-system-routes.cjs was the only code that read five of
// them, and `server.js` never required it -- so its pages 404ed, the tables
// were never written in production, and the orphan report counted them as used
// because a file existed that would have used them had anything loaded it.
//
// That is the failure this guards against, and it is not "a table is unread".
// It is a table whose only route is unreachable, which looks identical from the
// inside. So this asserts through Express: the pages render, their forms point
// at endpoints that exist, the artist picker is filled from real rows, and a
// save reaches the right table.
//
// The write assertions matter as much as the reads. A page that lists a table
// and cannot create a row would clear the orphan report -- the table is
// queried -- while leaving no way to put anything in it, which is the same
// quiet success this codebase keeps finding.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-artist-system",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-artist-system"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { CREATOR_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const { ORPHAN_TABLES } = require("../lib/sonara-orphan-tables.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "artist@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";
const ARTIST_ID = "55555555-5555-4555-8555-555555555555";
const ARTIST_NAME = "Nova Ray";

// The five tables migration 016 left without a way in.
const ARTIST_SYSTEM_TABLES = [
  "creator_artist_profiles",
  "creator_sonic_profiles",
  "creator_album_cycles",
  "creator_prompt_blueprints",
  "creator_video_treatments"
];

const PAGES = CREATOR_RECORD_PAGES.filter((page) => ARTIST_SYSTEM_TABLES.includes(page.table));
const CHILD_PAGES = PAGES.filter((page) => page.table !== "creator_artist_profiles");

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });

// Enough of a body to satisfy every one of the five forms at once, so one
// submission can be sent at each endpoint and only the required fields of that
// endpoint decide whether it saves.
const FULL_BODY = Object.freeze({
  artist_profile_id: ARTIST_ID,
  artist_name: ARTIST_NAME,
  artist_key: "nova",
  name: "Night mix",
  profile_key: "night",
  title: "First light",
  slug: "first-light",
  blueprint_key: "hook",
  prompt_template: "warm keys, brushed drums"
});

const writes = [];

function stubFetch() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (method !== "GET") {
      writes.push({ table, payload: JSON.parse(options.body || "{}") });
      return json([{ id: "new" }], 201);
    }
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Artist Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    // One artist exists, so the pickers on the four child pages have something
    // real to be filled from.
    if (table === "creator_artist_profiles") {
      return json([{ id: ARTIST_ID, artist_name: ARTIST_NAME, artist_key: "nova", public_description: "Late-night soul", status: "active" }]);
    }
    return json([]);
  };
}

const get = (path) => request(app).get(path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
const post = (path, body) =>
  request(app).post(path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).type("form").send(body).redirects(0);

describe("the artist system has a way in", () => {
  let realFetch;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("has a page for each of the five tables", () => {
    assert.deepEqual(
      PAGES.map((page) => page.table).sort(),
      [...ARTIST_SYSTEM_TABLES].sort(),
      "a table lost its page; the assertions below would then be checking four things and reading as five"
    );
    for (const page of PAGES) assert.ok(page.api, `${page.path} has no endpoint, so it can list rows and never create one`);
  });

  it("is not listed as an orphan any more, and the register is still able to list one", () => {
    for (const table of ARTIST_SYSTEM_TABLES) {
      assert.ok(!ORPHAN_TABLES.includes(table), `${table} is built and still recorded as unused`);
    }
    // The register being empty is the finished state, so this cannot assert on
    // its length. What it can assert is that the pages are the reason -- if the
    // register were emptied without building anything, these would not exist.
    assert.equal(PAGES.length, 5);
  });

  it("catalogues every page, so none of them is reachable only by typing the URL", () => {
    const catalogued = new Set(ROUTE_REGISTRY.map((record) => record.route));
    for (const page of PAGES) assert.ok(catalogued.has(page.path), `${page.path} is not in the route registry`);
  });

  it("renders each page with a form pointing at an endpoint that exists", async function render() {
    this.timeout(30000);
    const registered = new Set();
    (function walk(stack) {
      for (const layer of stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) registered.add(`${method.toUpperCase()} ${layer.route.path}`);
        } else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    })(app._router.stack);

    for (const page of PAGES) {
      const response = await get(page.path);
      assert.equal(response.status, 200, `${page.path} answered ${response.status}`);
      const html = String(response.text || "");
      assert.ok(html.includes(`action="${page.api}"`), `${page.path} renders no form posting to ${page.api}`);
      assert.ok(registered.has(`POST ${page.api}`), `${page.api} is on the page and is not a registered route -- the exact shape of the deleted module`);
      assert.match(html, new RegExp(page.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${page.path} does not render its own title`);
    }
  });

  it("fills the artist picker from real records rather than showing it empty", async function render() {
    this.timeout(30000);
    for (const page of CHILD_PAGES) {
      const html = String((await get(page.path)).text || "");
      assert.ok(
        html.includes(`<option value="${ARTIST_ID}">${ARTIST_NAME}</option>`),
        `${page.path} does not offer the artist that exists`
      );
      assert.ok(
        !/Nothing to choose yet/.test(html),
        `${page.path} tells a customer with an artist to go and add one -- the renderer is passing an empty picker`
      );
    }
  });

  it("saves to the table the page is about, and sends the customer back to it", async function save() {
    this.timeout(30000);
    for (const page of PAGES) {
      writes.length = 0;
      const response = await post(page.api, FULL_BODY);
      assert.equal(response.status, 303, `${page.api} answered ${response.status} instead of returning the customer to their page`);
      assert.equal(response.headers.location, page.path, `${page.api} redirected to ${response.headers.location}`);
      assert.deepEqual(writes.map((write) => write.table), [page.table], `${page.api} wrote ${writes.map((w) => w.table).join(",") || "nothing"}`);
      assert.equal(writes[0].payload.organization_id, ORGANIZATION_ID, `${page.api} saved a row scoped to nobody`);
    }
  });

  it("refuses a child record with no artist, rather than saving a row nothing owns", async function refuse() {
    this.timeout(30000);
    for (const page of CHILD_PAGES) {
      writes.length = 0;
      const response = await request(app)
        .post(page.api)
        .set("Accept", "application/json")
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .type("form")
        .send({ ...FULL_BODY, artist_profile_id: "" })
        .redirects(0);
      // artist_profile_id is nullable in migration 016, so the database would
      // take this row -- and every page lists by artist, so nobody would ever
      // see it again.
      assert.equal(writes.length, 0, `${page.api} saved a record belonging to no artist`);
      assert.ok(response.status >= 400 || response.status === 303, `${page.api} answered ${response.status}`);
      if (response.status !== 303) assert.equal(response.body.code, "missing_required");
    }
  });

  it("keeps the jsonb and array columns out of the forms", () => {
    // A text input posting into a jsonb or text[] column produces either a
    // failed insert or a shape nothing can read back. The columns are real and
    // are left to a later editor built for them.
    const unsafe = ["private_backstory", "voice_identity", "genre_blend", "writing_rules", "visual_rules", "prompt_rules", "keys_allowed", "scene_plan", "shot_rules", "required_fields", "metadata"];
    for (const page of PAGES) {
      for (const field of page.form?.fields || []) {
        assert.ok(!unsafe.includes(field.name), `${page.path} offers ${field.name}, which is a jsonb or array column`);
      }
    }
  });

  it("links the pages to each other, so none of them is a dead end", async function nav() {
    this.timeout(30000);
    for (const page of PAGES) {
      const html = String((await get(page.path)).text || "");
      for (const other of PAGES) {
        if (other.path === page.path) continue;
        assert.ok(html.includes(`href="${other.path}"`), `${page.path} does not link to ${other.path}`);
      }
    }
  });
});

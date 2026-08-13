"use strict";

// Every JSON GET, with the database answering nothing.
//
// The companion to tests/no-page-lies-when-the-database-is-down.test.js: that
// one reads rendered HTML, this one reads what a consumer of the API is told.
// Four endpoints returned `ok: true` with an empty list while every read was
// failing -- `/api/business-builder/records`, the two other studios' equivalents,
// and `/api/business-builder/checklist`.
//
// They were not careless. They put the real outcome in a second field, `saved`,
// and left `ok` meaning "the request was handled". That is a defensible
// convention and it is not the one the rest of this API uses: 68 other JSON GETs
// answer a failed read with `ok: false` or a 4xx. And `createChecklistItem`
// returns `ok: false` for the same two setup conditions the read beside it
// reported as `ok: true`, so one file answered one question two ways depending
// on whether you were reading or writing.
//
// A field called ok is read as ok.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-api-outage",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-api-outage"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "api-outage@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const unreachable = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

function stubFetch() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Outage Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    return unreachable();
  };
}

// Endpoints whose answer does not come from the customer's records, so an empty
// or static result while the database is down is the correct answer rather than
// a claim about anything. Readiness reports are here on purpose: several of them
// carry a per-table `ok: false`, which is the honest shape.
const NOT_ABOUT_CUSTOMER_RECORDS = /\/(manifest|readiness|health|framework|catalog|discovery|definitions|providers|status|public|ai-integrations|requested-repositories|huggingface|open-source)$/;

function listRows(body) {
  for (const key of ["rows", "records", "items", "data"]) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return null;
}

describe("no endpoint reports success on a failed read", () => {
  let realFetch;
  const findings = [];
  let checked = 0;

  before(async function crawl() {
    this.timeout(180000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();

    const routes = new Set();
    (function walk(stack) {
      for (const layer of stack) {
        if (layer.route) {
          const path = layer.route.path;
          if (Object.keys(layer.route.methods).includes("get") && path.startsWith("/api/") && !path.includes(":")) routes.add(path);
        } else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
      }
    })(app._router.stack);

    for (const route of routes) {
      if (NOT_ABOUT_CUSTOMER_RECORDS.test(route)) continue;
      const response = await request(app).get(route).set("Accept", "application/json").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
      let body;
      try { body = JSON.parse(response.text || "{}"); } catch { continue; }

      // Every non-excluded endpoint counts, not only the ones that answer with
      // a list. The first version skipped anything without a rows/records/items
      // field, which was 63 of 67 -- so it asserted over four endpoints while
      // reading as though it covered the API. /api/growth/metrics was in the
      // skipped group and was answering ok: true over a response in which every
      // figure was null.
      checked += 1;
      const reportsFailure = response.status >= 400 || body.ok === false;
      if (reportsFailure) continue;

      const rows = listRows(body);
      if (rows && rows.length === 0) {
        findings.push(`${route} answered ok:${body.ok} with an empty list: ${JSON.stringify(body).slice(0, 140)}`);
      } else if (!rows) {
        findings.push(`${route} answered ok:${body.ok} and reported no failure at all: ${JSON.stringify(body).slice(0, 140)}`);
      }
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("checked enough endpoints to be measuring something", () => {
    assert.ok(checked >= 50, `only ${checked} endpoints reached; the crawl has gone blind`);
  });

  it("says the read failed, one way or another, on every endpoint about a customer's records", () => {
    assert.deepEqual(
      findings,
      [],
      `these endpoints report success and an empty list while every read is failing:\n  ${findings.join("\n  ")}\n\n` +
        "Set ok to what actually happened. A consumer reads that field, not the one beside it."
    );
  });

  // The read and the write in the same file disagreed about the same two
  // conditions. This is the assertion that they no longer do.
  it("answers a setup problem the same way whether reading or writing", () => {
    const source = require("node:fs")
      .readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8")
      .replace(/^\s*\/\/.*$/gm, "");
    const listing = source.slice(source.indexOf("async function listChecklistItems"), source.indexOf("async function createChecklistItem"));
    assert.ok(listing.length > 200, "listChecklistItems was not found; this check has gone blind");
    assert.doesNotMatch(listing, /ok: true, saved: false/, "the read still claims success while reporting it saved nothing");
    assert.match(listing, /code: "records_unavailable"/, "a failed read must be distinguishable from setup never having been done");
  });
});

"use strict";

// A records page whose read failed rendered nothing.
//
// `workspaceRecordCards` returned "" for three different situations: a page
// with no records section, a read that failed, and a read that could not even
// be attempted. The reasoning written above it is sound and is kept -- "a
// records list that cannot load should leave the tool usable rather than take
// the page down with it".
//
// What was wrong is the choice of "" for the failure. "" is also what a page
// with no records section looks like, so a customer who had twenty invoices saw
// the form and nothing underneath it. On a page titled Records, an empty page
// is not the absence of a statement. It says the records are gone.
//
// The nearby renderers already got this right for the case they could see:
// `renderRecordCards` on a genuinely empty list says "Nothing saved yet. Use
// the form above and it will appear here." That sentence is correct after a
// successful read and false after a failed one, and nothing distinguished them.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-records-page",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-records-page"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { renderRecordsUnavailable } = require("../lib/sonara-module-crud.cjs");

const USER = { id: "55555555-5555-4555-8555-555555555555", email: "records@example.com" };
const ORGANIZATION_ID = "66666666-6666-4666-8666-666666666666";
const COOKIE = `${CUSTOMER_SESSION_COOKIE || "sonara_customer_session"}=stub`;

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const unreachable = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

// Every table this customer's session needs answers; `recordTables` are the ones
// holding their saved work, and `recordsAnswer` decides what those do.
function stubFetch(recordsAnswer) {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Records Ltd" }]);
    if (table === "user_roles") return json([{ role: "customer" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    if (table === "billing_subscriptions") return json([]);
    // The customer's own saved work.
    return recordsAnswer === "failed" ? unreachable() : json(recordsAnswer);
  };
}

function open(path, recordsAnswer) {
  global.fetch = stubFetch(recordsAnswer);
  return request(app).get(path).set("Accept", "text/html").set("Cookie", COOKIE).redirects(0);
}

// One page of each shape: the saved-outputs list, and a list backed by an
// editable resource. They take different code paths to the same "" .
const PAGES = ["/business-builder/records/free", "/growth-studio/leads"];

describe("an empty records page is not a claim about the records", () => {
  let originalFetch;
  before(() => { Object.assign(process.env, SUPABASE_ENV); });
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });
  after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  for (const path of PAGES) {
    it(`says so on ${path} when the records could not be read`, async () => {
      const response = await open(path, "failed");
      assert.equal(response.status, 200, "the page must stay up; the list failing is not the page failing");
      assert.match(response.text, /could not load/i, "the page rendered no records and no reason");
      assert.doesNotMatch(response.text, /Nothing saved yet/i, "an outage was reported as an empty list");
    });

    // Without this the assertion above would pass against a page that says
    // "could not load" unconditionally, which would be a worse lie in the
    // commoner direction.
    it(`still says nothing is saved yet on ${path} when the read succeeded and found none`, async () => {
      const response = await open(path, []);
      assert.equal(response.status, 200);
      assert.match(response.text, /Nothing saved yet/i);
      assert.doesNotMatch(response.text, /could not load/i);
    });
  }

  it("stays quiet for a customer who has no workspace yet", () => {
    // Not a failure, and the page has its own setup card. A "we could not load"
    // banner on a brand-new account would be its own false statement.
    assert.equal(renderRecordsUnavailable({ code: "setup_required" }), "");
    assert.equal(renderRecordsUnavailable({ code: "organization_setup_required" }), "");
    assert.equal(renderRecordsUnavailable({ code: "customer_auth_required" }), "");
  });

  it("names what could not be loaded when it knows", () => {
    assert.match(renderRecordsUnavailable({ noun: "lead", code: "read_failed" }), /your saved leads/);
    assert.match(renderRecordsUnavailable({ code: "read_failed" }), /your saved records/);
  });

  it("does not tell the customer their work is gone", () => {
    const card = renderRecordsUnavailable({ noun: "lead", code: "read_failed" });
    assert.match(card, /nothing has been deleted/i);
    assert.doesNotMatch(card, /empty|none|no leads/i);
  });
});

"use strict";

// "You can export it at any time from your data page."
//
// That is /legal/terms, about the customer's own records. The export covered
// **30** tables and the product keeps **51**. Missing: every Growth Studio
// record — leads, campaigns, audience groups, contact history, conversions —
// and every line item inside a record, including what is on an invoice and what
// has been paid against it.
//
// The sharpest of those was `growth_contact_consents`: the record proving
// somebody agreed to be contacted. A business that leaves without it loses the
// basis on which it contacts its own customers.
//
// The cause was ordinary. EXPORTABLE was assembled by hand from two of the
// three page collections, and nothing compared it against the third or against
// the children. So this derives the full set the same way the product does and
// requires the export to carry all of it — a record type that ships with a page
// is in the export the day it ships, or this fails.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-export",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-export"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { ALL_OWNER_PAGES, CREATOR_RECORD_PAGES, childrenOf } = require("../lib/sonara-owner-record-pages.cjs");
const { GROWTH_RECORD_PAGES } = require("../lib/sonara-growth-record-pages.cjs");
const { GROWTH_TABLES } = require("../lib/sonara-growth-tables.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "export@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

// Every table the product gives a customer a page for. Derived here the same
// way the route derives it, so the two cannot drift apart without one of the
// assertions below noticing.
const KEPT_FOR_CUSTOMERS = [...new Set([
  ...ALL_OWNER_PAGES.map((page) => page.table),
  ...ALL_OWNER_PAGES.flatMap((page) => childrenOf(page).map((spec) => spec.table)),
  ...CREATOR_RECORD_PAGES.map((page) => page.table),
  ...GROWTH_RECORD_PAGES.map((page) => GROWTH_TABLES[page.tableKey])
].filter(Boolean))];

// Tables a customer would specifically go looking for after deciding to leave.
const MUST_BE_THERE = [
  "customers",
  "customer_invoices",
  "customer_invoice_lines",
  "customer_invoice_payments",
  "growth_leads",
  "growth_contact_consents",
  "growth_campaigns",
  "recipe_ingredients",
  "creator_artist_profiles"
];

const json = (body, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
const dead = () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });

function stubFetch(unreadable = new Set()) {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Export Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    if (unreadable.has(table)) return dead();
    return json([{ id: "r1", organization_id: ORGANIZATION_ID }]);
  };
}

const download = (unreadable) => {
  global.fetch = stubFetch(unreadable);
  return request(app).get("/account/data/export").set("Accept", "application/json").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
};

describe("the export covers every record the product keeps", () => {
  let realFetch;

  before(() => { Object.assign(process.env, SUPABASE_ENV); realFetch = global.fetch; });
  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("knows what the product keeps, rather than measuring an empty set", () => {
    assert.ok(KEPT_FOR_CUSTOMERS.length >= 45, `only ${KEPT_FOR_CUSTOMERS.length} customer record tables derived; this check has gone blind`);
    for (const table of MUST_BE_THERE) {
      assert.ok(KEPT_FOR_CUSTOMERS.includes(table), `${table} is not in the derived set, so the assertions below would pass over it`);
    }
  });

  it("leaves out none of them", async function covers() {
    this.timeout(60000);
    const response = await download(new Set());
    assert.equal(response.status, 200);
    const body = JSON.parse(response.text);
    const missing = KEPT_FOR_CUSTOMERS.filter((table) => !Object.prototype.hasOwnProperty.call(body.records, table));
    assert.deepEqual(
      missing,
      [],
      `the export leaves out ${missing.length} record types the product keeps:\n  ${missing.join("\n  ")}\n\n` +
        "/legal/terms says a customer can export their records at any time."
    );
  });

  it("hands the file back as a download, and says which day it is from", async function shape() {
    this.timeout(60000);
    const response = await download(new Set());
    assert.match(String(response.headers["content-disposition"] || ""), /attachment; filename="sonara-records-\d{4}-\d{2}-\d{2}\.json"/);
    const body = JSON.parse(response.text);
    assert.equal(body.complete, true);
    assert.deepEqual(body.unreadable, []);
    assert.equal(body.organizationId, ORGANIZATION_ID);
  });

  it("says null for a table it could not read, never an empty list", async function unreadable() {
    this.timeout(60000);
    const broken = new Set(["growth_contact_consents", "customer_invoice_lines"]);
    const response = await download(broken);
    const body = JSON.parse(response.text);

    assert.equal(body.complete, false, "an incomplete export reported itself complete");
    assert.deepEqual([...body.unreadable].sort(), [...broken].sort());
    for (const table of broken) {
      // The failure this guards: a consumer reading records.growth_contact_consents
      // reads it as the consents. [] says "you have none" — which for a consent
      // record is the difference between having permission and not.
      assert.equal(body.records[table], null, `${table} could not be read and was exported as ${JSON.stringify(body.records[table])}`);
    }
    // And a readable table beside it still carries its rows, so the null above
    // means "unreadable" rather than "the export broke".
    assert.ok(Array.isArray(body.records.customers) && body.records.customers.length > 0);
    assert.match(String(body.note), /could not be read/i);
  });

  it("tells the customer on the page how many kinds of record it covers", async function page() {
    this.timeout(30000);
    global.fetch = stubFetch(new Set());
    const response = await request(app).get("/account/data").set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
    assert.equal(response.status, 200);
    const stated = Number((String(response.text).match(/covers (\d+) kinds of record/) || [])[1]);
    assert.equal(stated, KEPT_FOR_CUSTOMERS.length, "the page states a different number of record kinds than the export carries");
  });
});

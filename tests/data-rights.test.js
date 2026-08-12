"use strict";

// Leaving, and taking your records with you.
//
// The product's pitch is that a business's records live in one place. "How do I
// get them out" and "how do I close this and have it gone" are the questions
// that follow, and /account answered neither -- it offered profile, security,
// preferences, workspaces, integrations and setup. Cancelling was already
// possible through the Stripe billing portal, so a customer could stop paying
// and still not leave.
//
// The two halves are deliberately not symmetrical, and these checks hold that
// asymmetry in place:
//
//   export  is immediate -- handing somebody a copy of their own rows needs
//           nobody's approval
//   erasure is a request -- AGENTS.md forbids automating destructive data
//           changes without owner approval, and lib/sonara-module-crud.cjs
//           already settled the same question for one record: archive, and
//           route real erasure through support. An automated wipe of a whole
//           organization is that decision at the largest possible scale.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function buildApp({ rowsByTable = {}, unreadable = [] } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: USER_ID };
    return next();
  };
  const posted = [];
  registerRoutes(app, {
    layout: ({ title, heading, body, sections = [], actions = [] }) => `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url, options = {}) => {
    const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
    if ((options.method || "GET") === "POST") {
      posted.push({ table, body: JSON.parse(options.body || "{}") });
      return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
    }
    if (unreadable.includes(table)) return { ok: false, status: 500, headers: { get: () => null }, json: async () => [] };
    return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => rowsByTable[table] || [] };
  };
  return { app, posted };
}

describe("a customer can take their records with them", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it("says what is kept, for how long, and how to leave", async () => {
    const { app } = buildApp();
    const result = await request(app).get("/account/data");
    assert.equal(result.status, 200);
    for (const heading of ["What is kept", "How long it is kept", "Take a copy", "Ask for erasure"]) {
      assert.ok(result.text.includes(heading), `the page does not cover "${heading}"`);
    }
    // Archiving is not erasing, and a page about erasure has to say so rather
    // than let a customer assume a deleted record is gone.
    assert.match(result.text, /archives it rather than removing it/);
  });

  it("exports the records themselves, not a summary of them", async () => {
    const { app } = buildApp({ rowsByTable: { customers: [{ id: "c-1", name: "Sam", email: "sam@example.com" }] } });
    const result = await request(app).get("/account/data/export");
    assert.equal(result.status, 200);
    assert.equal(result.body.organizationId, ORGANIZATION_ID);
    assert.deepEqual(result.body.records.customers, [{ id: "c-1", name: "Sam", email: "sam@example.com" }]);
    assert.equal(result.body.complete, true);
    assert.match(result.headers["content-disposition"] || "", /attachment; filename="sonara-records-/);
  });

  it("names the record types it could not read instead of leaving them out", async () => {
    // An export silently missing a table is the worst version of this defect:
    // the customer keeps the file believing it is a complete copy.
    const { app } = buildApp({ unreadable: ["customers"] });
    const result = await request(app).get("/account/data/export");
    assert.equal(result.status, 200);
    assert.equal(result.body.complete, false);
    assert.ok(result.body.unreadable.includes("customers"), "an unreadable table is not named");
    assert.match(result.body.note, /not missing from your account/);
  });

  it("records an erasure request and erases nothing", async () => {
    const { app, posted } = buildApp();
    const result = await request(app)
      .post("/account/data/erasure-request")
      .type("form")
      .send({ note: "Closing the business" });
    assert.equal(result.status, 303);

    const writes = posted.filter((entry) => entry.table === "support_requests");
    assert.equal(writes.length, 1, "the request was not recorded");
    assert.equal(writes[0].body.organization_id, ORGANIZATION_ID);
    assert.match(writes[0].body.subject, /Erasure/i);
    assert.match(writes[0].body.message, /Closing the business/);

    // The whole point. Nothing else may be written, and nothing deleted.
    assert.equal(posted.length, 1, `erasure request caused ${posted.length} writes; it must only record the request`);
  });

  it("never issues a DELETE anywhere in the erasure path", async () => {
    // Stated as its own check because it is the one regression that would be
    // catastrophic and silent: a future edit "helpfully" wiring the request up
    // to actually delete would pass every other assertion here.
    const methods = [];
    const { app } = buildApp();
    const inner = global.fetch;
    global.fetch = async (url, options = {}) => {
      methods.push(String(options.method || "GET").toUpperCase());
      return inner(url, options);
    };
    await request(app).post("/account/data/erasure-request").type("form").send({});
    assert.ok(!methods.includes("DELETE"), "the erasure request issued a DELETE");
    assert.ok(!methods.includes("PATCH"), "the erasure request modified existing records");
  });
});

"use strict";

// Twenty-seven owner record pages could create records and read them back, and
// not one of them could change anything. Eleven declare a `status` select --
// draft, sent, accepted, confirmed, received -- and every one of those values
// was fixed at the moment the record was typed in.
//
// Quote -> invoice is gated on `accepted`, so invoices, the payments recorded
// against them, the settlement, the receivables page and the invoice-paid
// notification were all downstream of a change nobody could make. Meanwhile
// lib/sonara-quote-conversion.cjs was telling people to "mark it accepted", and
// the public booking page was promising strangers the business would confirm
// their request.
//
// The first version of this shipped six endpoints out of eleven, because it was
// registered inside the loop over pages that have line items. Quotes and
// bookings -- the two records the whole change exists for -- were both among
// the five with no endpoint at all. So the test below asks the running app
// which routes it has, for every page that declares a status, rather than
// checking the two it was written for.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { ALL_OWNER_PAGES, childrenOf } = require("../lib/sonara-owner-record-pages.cjs");
const recordStatus = require("../lib/sonara-record-status.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

const STATUS_PAGES = ALL_OWNER_PAGES.filter((page) => recordStatus.hasStatus(page));

function buildApp({ rowsByTable = {}, patchOk = true, patchRows = [{ id: RECORD_ID }], calls = [] } = {}) {
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
    const method = options.method || "GET";
    const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
    calls.push({ method, url: String(url), body: options.body ? JSON.parse(options.body) : null });
    if (method === "PATCH") {
      if (!patchOk) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => patchRows };
    }
    if (method === "POST") return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
    return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => rowsByTable[table] || [] };
  };
  return app;
}

describe("An owner can change a record's status", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("counts enough pages with a status for this file to mean anything", () => {
    // Without this the four tests below pass by iterating an empty list, which
    // is precisely how the six-of-eleven gap went unnoticed the first time.
    assert.ok(
      STATUS_PAGES.length >= 8,
      `only ${STATUS_PAGES.length} owner pages declare a status; this check has gone blind`
    );
    const paths = STATUS_PAGES.map((page) => page.path);
    // The two the whole change exists for, named rather than counted.
    assert.ok(paths.includes("/business-builder/owner/quotes"), "quotes no longer declares a status");
    assert.ok(paths.includes("/business-builder/owner/bookings"), "bookings no longer declares a status");
  });

  it("gives every page that declares a status somewhere to change it", async () => {
    const app = buildApp();
    for (const page of STATUS_PAGES) {
      const options = recordStatus.statusOptionsFor(page);
      const calls = [];
      const scoped = buildApp({ rowsByTable: { [page.table]: [{ id: RECORD_ID, status: options[0] }] }, calls });
      const result = await request(scoped)
        .post(`${page.path}/${RECORD_ID}/status`)
        .set("accept", "application/json")
        .send({ status: options[1] });
      assert.equal(result.status, 200, `${page.path} has no way to change a status (answered ${result.status})`);
      assert.equal(result.body.ok, true, `${page.path} refused a status it offers`);
      assert.equal(result.body.status, options[1], `${page.path} saved a different status`);
      const patch = calls.find((call) => call.method === "PATCH");
      assert.ok(patch, `${page.path} answered success without writing anything`);
      assert.deepEqual(patch.body, { status: options[1] }, `${page.path} wrote more than the status`);
    }
    assert.ok(app, "app built");
  });

  it("renders the control on a page an owner can actually open", async () => {
    for (const page of STATUS_PAGES) {
      const options = recordStatus.statusOptionsFor(page);
      const row = { id: RECORD_ID, status: options[0] };
      const app = buildApp({ rowsByTable: { [page.table]: [row] } });
      // A record with line items has a detail page and the control is there;
      // everything else only has the list. Whichever it is, the form has to be
      // on a page that exists -- a control on an unregistered detail page is
      // the same as no control.
      const where = childrenOf(page).length > 0 ? `${page.path}/${RECORD_ID}` : page.path;
      const result = await request(app).get(where).set("accept", "text/html");
      assert.equal(result.status, 200, `${where} did not render`);
      const action = `${page.path}/${RECORD_ID}/status`;
      assert.match(
        result.text,
        new RegExp(`<form[^>]+action="${action.replace(/[/]/g, "\\/")}"`),
        `${where} shows no way to change the status`
      );
      for (const value of options) {
        assert.ok(result.text.includes(`value="${value}"`), `${where} does not offer ${value}`);
      }
    }
  });

  it("refuses a status the page does not offer, and writes nothing", async () => {
    const page = STATUS_PAGES[0];
    const calls = [];
    const app = buildApp({ rowsByTable: { [page.table]: [{ id: RECORD_ID, status: "draft" }] }, calls });
    const result = await request(app)
      .post(`${page.path}/${RECORD_ID}/status`)
      .set("accept", "application/json")
      .send({ status: "whatever-i-typed" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "unknown_status");
    assert.ok(!calls.some((call) => call.method === "PATCH"), "a rejected status still wrote to the table");
  });

  it("will not change a record belonging to another business", async () => {
    const page = STATUS_PAGES[0];
    const calls = [];
    // The read comes back empty: the id is real but it is not this business's.
    const app = buildApp({ rowsByTable: { [page.table]: [] }, calls });
    const result = await request(app)
      .post(`${page.path}/${RECORD_ID}/status`)
      .set("accept", "application/json")
      .send({ status: recordStatus.statusOptionsFor(page)[1] });
    assert.equal(result.status, 404);
    assert.equal(result.body.code, "not_yours");
    assert.ok(!calls.some((call) => call.method === "PATCH"), "a record from another business was written to");
  });

  it("filters the read and the write by organization, not by id alone", async () => {
    const page = STATUS_PAGES[0];
    const calls = [];
    const app = buildApp({ rowsByTable: { [page.table]: [{ id: RECORD_ID, status: "draft" }] }, calls });
    await request(app)
      .post(`${page.path}/${RECORD_ID}/status`)
      .set("accept", "application/json")
      .send({ status: recordStatus.statusOptionsFor(page)[1] });
    // The service key bypasses row level security, so this filter is the whole
    // tenant boundary on both halves.
    const read = calls.find((call) => call.method === "GET");
    const patch = calls.find((call) => call.method === "PATCH");
    assert.ok(read.url.includes(`organization_id=eq.${ORGANIZATION_ID}`), "the read was not scoped to one business");
    assert.ok(patch.url.includes(`organization_id=eq.${ORGANIZATION_ID}`), "the write was not scoped to one business");
  });

  it("does not report a change when the write matched nothing", async () => {
    const page = STATUS_PAGES[0];
    // PostgREST answers 200 with an empty list when the filter matched no row.
    const app = buildApp({ rowsByTable: { [page.table]: [{ id: RECORD_ID, status: "draft" }] }, patchRows: [] });
    const result = await request(app)
      .post(`${page.path}/${RECORD_ID}/status`)
      .set("accept", "application/json")
      .send({ status: recordStatus.statusOptionsFor(page)[1] });
    assert.equal(result.status, 404, "an empty PATCH result was reported as a saved change");
  });

  it("says nothing changed when the status was already the one asked for", () => {
    assert.match(recordStatus.describeChange("accepted", "accepted"), /already accepted/);
    assert.match(recordStatus.describeChange("draft", "accepted"), /from draft to accepted/);
    assert.match(recordStatus.describeChange("", "accepted"), /set to accepted/);
    assert.match(recordStatus.describeChange("partially_received", "received"), /from partially received to received/);
  });
});

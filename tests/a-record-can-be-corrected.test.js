"use strict";

// Twenty-six of the twenty-seven Business Builder owner record pages declare a
// create form. None of them could change a saved record.
//
// A customer's phone number entered with a digit missing, a quote priced at 450
// instead of 4500, a booking put against the wrong service -- the only recourse
// in the product was to create a second record and leave the wrong one sitting
// there. An address book with two entries for the same person, one of which
// cannot be reached, is worse than one with a single wrong entry, because now
// nobody knows which is current.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const recordEdit = require("../lib/sonara-record-edit.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORGANIZATION = "99999999-9999-4999-8999-999999999999";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

const EDITABLE = ALL_OWNER_PAGES.filter((page) => recordEdit.canEdit(page));

function buildApp({ rowsByTable = {}, patchRows = [{ id: RECORD_ID }], patchOk = true, calls = [] } = {}) {
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

// A row carrying a plausible value for every field the page declares, so the
// round trip below is testing the real field types rather than a bare id.
function rowFor(page) {
  const row = { id: RECORD_ID, organization_id: ORGANIZATION_ID };
  for (const field of recordEdit.editableFields(page)) {
    if (field.type === "select") {
      const first = (field.options || [])[0];
      row[field.name] = first && typeof first === "object" ? first.value : first;
    } else if (field.type === "reference") row[field.name] = "44444444-4444-4444-8444-444444444444";
    else if (field.type === "number") row[field.name] = 12;
    else if (field.type === "date") row[field.name] = "2026-08-14";
    else if (field.type === "datetime-local") row[field.name] = "2026-08-14T09:30:00+00:00";
    else if (field.type === "email") row[field.name] = "someone@example.com";
    else row[field.name] = `existing ${field.name}`;
  }
  return row;
}

describe("An owner can correct a record they typed in wrong", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("counts enough editable pages for this file to mean anything", () => {
    assert.ok(
      EDITABLE.length >= 20,
      `only ${EDITABLE.length} owner pages can be corrected; this check has gone blind`
    );
    // The two that deliberately cannot, named so a change to either is noticed
    // here rather than discovered as a missing form.
    const paths = ALL_OWNER_PAGES.filter((page) => !recordEdit.canEdit(page)).map((page) => page.path);
    assert.deepEqual(
      paths.sort(),
      ["/business-builder/owner/costs", "/business-builder/owner/time"],
      "the set of pages with no edit form changed"
    );
  });

  it("puts an edit form, filled in, on every page that can be corrected", async () => {
    for (const page of EDITABLE) {
      const row = rowFor(page);
      const app = buildApp({ rowsByTable: { [page.table]: [row] } });
      const result = await request(app).get(`${page.path}/${RECORD_ID}/edit`).set("accept", "text/html");
      assert.equal(result.status, 200, `${page.path} has no edit page (answered ${result.status})`);
      assert.match(
        result.text,
        new RegExp(`<form[^>]+action="${`${page.path}/${RECORD_ID}`.replace(/[/]/g, "\\/")}"`),
        `${page.path} renders no edit form`
      );
      // A blank edit form is the defect this is guarding: it looks like a
      // record with nothing in it, and saving it would write the blanks over
      // what is there.
      for (const field of recordEdit.editableFields(page)) {
        const shown = recordEdit.currentValue(field, row);
        if (!shown) continue;
        assert.ok(
          result.text.includes(shown) || result.text.includes(shown.replace(/&/g, "&amp;")),
          `${page.path} does not show the stored ${field.name}`
        );
      }
    }
  });

  it("points at the edit page from every row, so it is not a dead end", async () => {
    for (const page of EDITABLE) {
      const app = buildApp({ rowsByTable: { [page.table]: [rowFor(page)] } });
      const result = await request(app).get(page.path).set("accept", "text/html");
      assert.equal(result.status, 200, `${page.path} did not render`);
      assert.ok(
        result.text.includes(`${page.path}/${RECORD_ID}/edit`),
        `${page.path} has an edit page nothing links to`
      );
    }
  });

  it("writes only the fields that changed", async () => {
    const page = ALL_OWNER_PAGES.find((entry) => entry.path === "/business-builder/owner/customers");
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada L", phone: "0700", status: "active" }] }, calls });
    const result = await request(app)
      .post(`${page.path}/${RECORD_ID}`)
      .set("accept", "application/json")
      .send({ name: "Ada", phone: "0700", status: "active" });
    assert.equal(result.status, 200);
    const patch = calls.find((call) => call.method === "PATCH");
    // Not `{ name, phone, status }`. Sending back a field nobody touched would
    // overwrite an edit somebody else made in the seconds since this form
    // loaded, with a value the person saving never looked at.
    assert.deepEqual(patch.body, { name: "Ada" });
    assert.deepEqual(result.body.changed, ["Name"]);
  });

  it("shortens a value rather than reporting it unchanged", async () => {
    // "Ada L" to "Ada": the first version compared by prefix for every field
    // type, so shortening any text read as no change and the save reported
    // success without writing anything.
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada L" }] }, calls });
    await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada" });
    const patch = calls.find((call) => call.method === "PATCH");
    assert.ok(patch, "shortening a name wrote nothing");
    assert.equal(patch.body.name, "Ada");
  });

  it("clears a field rather than writing an empty string", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada", phone: "0700" }] }, calls });
    await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada", phone: "" });
    const patch = calls.find((call) => call.method === "PATCH");
    // "" and "not recorded" are different answers, and only one is honest about
    // a field somebody deliberately emptied.
    assert.equal(patch.body.phone, null);
  });

  it("will not write a column the form never declared", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada" }] }, calls });
    await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada B", organization_id: OTHER_ORGANIZATION, id: "hijacked", created_at: "1999-01-01" });
    const patch = calls.find((call) => call.method === "PATCH");
    // The patch is built from the page's declaration rather than filtered from
    // the body, so a new attack name has nothing to land on.
    assert.deepEqual(Object.keys(patch.body), ["name"]);
    assert.ok(!patch.url.includes(OTHER_ORGANIZATION), "another organization reached the query");
  });

  it("refuses a required field emptied, and writes nothing", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada" }] }, calls });
    const result = await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "missing_required");
    assert.ok(!calls.some((call) => call.method === "PATCH"), "an empty required field still wrote to the table");
  });

  it("refuses a select value the form does not offer", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada", status: "active" }] }, calls });
    const result = await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ status: "whatever-i-typed" });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "unknown_option");
    assert.ok(!calls.some((call) => call.method === "PATCH"));
  });

  it("says nothing changed rather than reporting a save that did not happen", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada", phone: "0700" }] }, calls });
    const result = await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada", phone: "0700" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.changed, []);
    assert.match(result.body.detail, /nothing was changed/i);
    assert.ok(!calls.some((call) => call.method === "PATCH"), "an empty patch was sent to the database");
  });

  it("will not open or change a record belonging to another business", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [] }, calls });
    const opened = await request(app).get(`/business-builder/owner/customers/${RECORD_ID}/edit`).set("accept", "text/html");
    assert.equal(opened.status, 404, "another business's record opened in an editable form");
    const saved = await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Taken" });
    assert.equal(saved.status, 404);
    assert.ok(!calls.some((call) => call.method === "PATCH"), "another business's record was written to");
  });

  it("scopes the read and the write to one business", async () => {
    const calls = [];
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada" }] }, calls });
    await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada B" });
    // The service key bypasses row level security, so this filter is the whole
    // tenant boundary on both halves.
    assert.ok(calls.find((call) => call.method === "GET").url.includes(`organization_id=eq.${ORGANIZATION_ID}`));
    assert.ok(calls.find((call) => call.method === "PATCH").url.includes(`organization_id=eq.${ORGANIZATION_ID}`));
  });

  it("does not offer an empty form when the record could not be read", async () => {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    const authenticate = (req, res, next) => { req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" }; return next(); };
    registerRoutes(app, {
      layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireCustomer: authenticate,
      requireBusinessManager: authenticate,
      requireWorkspaceAccess: () => authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
    });
    global.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });
    const result = await request(app).get(`/business-builder/owner/customers/${RECORD_ID}/edit`).set("accept", "text/html");
    // A read that failed is not a record that is missing. An empty form here
    // invites somebody to retype a record that is still there and save the
    // blanks over it.
    assert.equal(result.status, 502);
    assert.ok(!result.text.includes("<form"), "a failed read rendered an editable form anyway");
    assert.match(result.text, /Nothing has been changed/);
  });

  it("does not report a change when the write matched nothing", async () => {
    const app = buildApp({ rowsByTable: { customers: [{ id: RECORD_ID, name: "Ada" }] }, patchRows: [] });
    const result = await request(app)
      .post("/business-builder/owner/customers/" + RECORD_ID)
      .set("accept", "application/json")
      .send({ name: "Ada B" });
    assert.equal(result.status, 404, "an empty PATCH result was reported as a saved change");
  });

  it("keeps the reference already chosen when its picker did not load", async () => {
    // A picker whose list failed to load would otherwise render a select with
    // no current value, and saving that form would clear a reference nobody
    // touched. Every reference table below reads back empty.
    const page = ALL_OWNER_PAGES.find((entry) => recordEdit.editableFields(entry).some((field) => field.type === "reference"));
    assert.ok(page, "no owner page declares a reference field; this check has gone blind");
    const field = recordEdit.editableFields(page).find((entry) => entry.type === "reference");
    const chosen = "44444444-4444-4444-8444-444444444444";
    const app = buildApp({ rowsByTable: { [page.table]: [{ id: RECORD_ID, [field.name]: chosen }] } });
    const result = await request(app).get(`${page.path}/${RECORD_ID}/edit`).set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(
      result.text,
      new RegExp(`<option value="${chosen}" selected>`),
      `${page.path} lost the ${field.name} already on the record`
    );
  });

  it("leaves alone a form that does not create the record it sits under", () => {
    // /business-builder/owner/time posts to /api/business/time-entries/start.
    // Clocking in is not "create a time entry with these values" -- the server
    // stamps the time, and a form letting somebody type their own clock-in time
    // would be a different feature with different consequences.
    const time = ALL_OWNER_PAGES.find((page) => page.path === "/business-builder/owner/time");
    assert.ok(time.form.action, "the time page no longer names its own action");
    assert.equal(recordEdit.canEdit(time), false);
  });
});

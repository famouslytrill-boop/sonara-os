"use strict";

// Until 1 September 2026 nothing on the Business Builder owner record pages
// could change a saved record: twenty-seven pages could create and read, and
// none could update. So there was nothing to log, and the absence of a change
// log was not a gap.
//
// Two changes that day ended that. A status control on eleven pages and an edit
// form on twenty-five, both behind `requireBusinessManager` -- which is owners
// **and managers**. A business with two people can now have a price changed and
// no way to find out by whom.
//
// This file is the record of that, and the two properties that make it worth
// having: it holds no values, and it says so when it could not be written.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const changeLog = require("../lib/sonara-record-change-log.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMERS = "/business-builder/owner/customers";

function buildApp({ rows = [{ id: RECORD_ID, name: "Ada", phone: "0700", status: "active" }], logRows = [], insertOk = true, calls = [] } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: USER_ID };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, userId: USER_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const target = String(url);
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    calls.push({ method, url: target, table, body: options.body ? JSON.parse(options.body) : null });
    if (method === "PATCH") return { ok: true, status: 200, headers: { get: () => null }, json: async () => [{ id: RECORD_ID }] };
    if (method === "POST") {
      if (table === changeLog.TABLE && !insertOk) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
    }
    if (table === changeLog.TABLE) return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => logRows };
    return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => rows };
  };
  return app;
}

describe("a change leaves a record of who made it", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("records an edit, naming the columns and nothing else", async () => {
    const calls = [];
    const app = buildApp({ calls });
    const result = await request(app)
      .post(`${CUSTOMERS}/${RECORD_ID}`)
      .set("accept", "application/json")
      .send({ name: "Ada B", phone: "0700" });
    assert.equal(result.status, 200);
    const logged = calls.find((call) => call.method === "POST" && call.table === changeLog.TABLE);
    assert.ok(logged, "an edit was saved with no record of who made it");
    assert.deepEqual(logged.body.changed_fields, ["name"]);
    assert.equal(logged.body.record_table, "customers");
    assert.equal(logged.body.record_id, RECORD_ID);
    assert.equal(logged.body.changed_by, USER_ID);
    assert.equal(logged.body.organization_id, ORGANIZATION_ID);
    assert.equal(result.body.recorded, true);
  });

  it("records a status change the same way", async () => {
    const calls = [];
    const app = buildApp({ calls });
    const result = await request(app)
      .post(`${CUSTOMERS}/${RECORD_ID}/status`)
      .set("accept", "application/json")
      .send({ status: "inactive" });
    assert.equal(result.status, 200);
    const logged = calls.find((call) => call.method === "POST" && call.table === changeLog.TABLE);
    assert.ok(logged, "a status change was saved with no record of who made it");
    assert.equal(logged.body.change_kind, "status");
    assert.deepEqual(logged.body.changed_fields, ["status"]);
  });

  it("puts no value in the log, old or new", async () => {
    const calls = [];
    const app = buildApp({ calls });
    await request(app)
      .post(`${CUSTOMERS}/${RECORD_ID}`)
      .set("accept", "application/json")
      .send({ name: "Ada Lovelace", phone: "07700900123" });
    const logged = calls.find((call) => call.method === "POST" && call.table === changeLog.TABLE);
    const written = JSON.stringify(logged.body);
    // The whole reason this table holds field names rather than values: these
    // records carry contact details, and a second copy in a table with
    // different retention is a second place erasure has to reach.
    assert.ok(!written.includes("Ada Lovelace"), "the change log carries the value that was written");
    assert.ok(!written.includes("07700900123"), "the change log carries a phone number");
    assert.ok(!written.includes("Ada"), "the change log carries the previous value");
  });

  it("says so when the change was made and the record of it was not", async () => {
    const app = buildApp({ insertOk: false });
    const result = await request(app)
      .post(`${CUSTOMERS}/${RECORD_ID}`)
      .set("accept", "application/json")
      .send({ name: "Ada B" });
    // The change is already saved by this point and must not be undone, so the
    // only honest option left is to say both things. A log that quietly drops
    // what it could not write reads as complete, and somebody looking for a
    // missing change concludes it never happened.
    assert.equal(result.status, 200);
    assert.equal(result.body.recorded, false);
    assert.match(result.body.detail, /could not record who changed it/i);
  });

  it("shows the history on the page where somebody is about to change something", async () => {
    const app = buildApp({
      logRows: [{ change_kind: "fields", changed_fields: ["unit_price_cents"], changed_by: USER_ID, created_at: "2026-08-31T14:05:00+00:00" }]
    });
    const result = await request(app).get(`${CUSTOMERS}/${RECORD_ID}/edit`).set("accept", "text/html");
    assert.equal(result.status, 200);
    assert.match(result.text, /Changes/);
    assert.match(result.text, /unit price cents changed/);
    assert.match(result.text, /2026-08-31 14:05/);
  });

  it("does not call a failed history read an empty one", async () => {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    const authenticate = (req, res, next) => { req.sonaraUser = { id: USER_ID }; return next(); };
    registerRoutes(app, {
      layout: ({ title, sections = [] }) => `<html><title>${title}</title>${sections.join("")}</html>`,
      brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
      linkAction: (href, label) => `<a href="${href}">${label}</a>`,
      escapeHtml: (value) => String(value),
      requireCustomer: authenticate,
      requireBusinessManager: authenticate,
      requireWorkspaceAccess: () => authenticate,
      getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, userId: USER_ID }),
      getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
    });
    global.fetch = async (url) => {
      const table = (String(url).split("/rest/v1/")[1] || "").split("?")[0];
      if (table === changeLog.TABLE) return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) };
      return { ok: true, status: 200, headers: { get: () => "0-0/1" }, json: async () => [{ id: RECORD_ID, name: "Ada" }] };
    };
    const result = await request(app).get(`${CUSTOMERS}/${RECORD_ID}/edit`).set("accept", "text/html");
    assert.equal(result.status, 200, "a failed history read took the whole page down");
    // "Nothing has been changed" on the strength of a request that did not
    // happen, on the page somebody came to precisely to check that.
    assert.ok(!/Nothing has been changed since this was created/.test(result.text), "a failed read rendered as an empty history");
    assert.match(result.text, /does not mean nothing has changed/i);
  });

  it("writes nothing when there is nothing to record", async () => {
    const calls = [];
    const app = buildApp({ calls });
    // Saving a form with no differences: the record was not changed, so there
    // is no change to record. A row here would be a log entry for a write that
    // did not happen.
    const result = await request(app)
      .post(`${CUSTOMERS}/${RECORD_ID}`)
      .set("accept", "application/json")
      .send({ name: "Ada", phone: "0700" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.changed, []);
    assert.ok(!calls.some((call) => call.method === "POST" && call.table === changeLog.TABLE), "an unchanged save was logged as a change");
  });

  it("refuses to record a change with no fields, rather than letting the database refuse it", async () => {
    const writes = [];
    const insert = async (table, row) => { writes.push(row); return { ok: true }; };
    const base = { organizationId: ORGANIZATION_ID, table: "customers", recordId: RECORD_ID, changedBy: USER_ID, kind: "fields" };
    assert.equal((await changeLog.record(insert, { ...base, fields: [] })).code, "nothing_to_record");
    assert.equal((await changeLog.record(insert, { ...base, fields: ["", "  "] })).code, "nothing_to_record");
    assert.equal((await changeLog.record(insert, { ...base, kind: "invented", fields: ["name"] })).code, "unknown_kind");
    assert.equal((await changeLog.record(insert, { ...base, organizationId: null, fields: ["name"] })).code, "no_organization");
    assert.equal(writes.length, 0, "a refused record still wrote a row");
  });

  it("writes a fixed set of columns whatever it is handed", async () => {
    const writes = [];
    const insert = async (table, row) => { writes.push({ table, row }); return { ok: true }; };
    await changeLog.record(insert, {
      organizationId: ORGANIZATION_ID,
      table: "customers",
      recordId: RECORD_ID,
      changedBy: USER_ID,
      kind: "fields",
      fields: ["name"],
      // Everything below is ignored. The row is built from a fixed list rather
      // than spread from the argument, so a caller that starts handing this the
      // record -- the obvious way somebody adds "just the old value" later --
      // writes nothing extra.
      before: { name: "Ada Lovelace", phone: "07700900123" },
      after: { name: "Ada B" },
      values: "07700900123"
    });
    assert.equal(writes.length, 1);
    assert.deepEqual(
      Object.keys(writes[0].row).sort(),
      ["change_kind", "changed_by", "changed_fields", "organization_id", "record_id", "record_table"],
      "the change log row grew a column"
    );
    assert.ok(!JSON.stringify(writes[0].row).includes("07700900123"));
  });

  it("keeps who unrecorded rather than naming somebody who did not do it", () => {
    // Three states, not two. A change made through a path that cannot identify
    // the person is still a change, and a log that drops the rows it cannot
    // attribute is a log with holes that reads as complete.
    assert.equal(changeLog.describe({ change_kind: "status", changed_fields: ["status"], changed_by: null }).who, "not recorded");
    assert.notEqual(changeLog.describe({ change_kind: "status", changed_fields: ["status"], changed_by: USER_ID }).who, "not recorded");
  });

  it("has a migration that refuses an empty change and enables row level security", () => {
    const root = path.join(__dirname, "..");
    const file = fs
      .readdirSync(path.join(root, "supabase", "migrations"))
      .find((name) => name.includes("record_change_log"));
    assert.ok(file, "no migration creates the change log");
    const sql = fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8");
    assert.match(sql, /create table if not exists public\.record_change_log/);
    assert.match(sql, /array_length\(changed_fields, 1\) >= 1/, "the database accepts a change that changed nothing");
    assert.match(sql, /alter table public\.record_change_log enable row level security/, "a list across tenants is readable");
    assert.match(sql, /change_kind in \('status', 'fields'\)/, "an unrecognised kind can arrive without a migration");
    // No value column, by construction rather than by convention.
    for (const forbidden of ["old_value", "new_value", "before_value", "after_value", "previous_value", "values jsonb", "payload jsonb"]) {
      assert.ok(!sql.includes(forbidden), `the change log schema has room for values: ${forbidden}`);
    }
  });
});

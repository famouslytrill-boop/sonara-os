"use strict";

// Line items on the four records that have them.
//
// A purchase order with no lines is a number with nothing behind it, so the
// parent page alone was not the feature. lib/sonara-orphan-tables.cjs
// classified purchase_order_lines, inventory_count_lines,
// location_transfer_lines and vendor_invoice_lines as "build-with-parent" for a
// specific reason: a line detached from its order or count is an orphaned row,
// so lines are reachable only through the record they belong to.
//
// The tenant boundary is the thing to get right here, and it is not the same
// boundary as everywhere else. These reads and writes run with the service key,
// which bypasses row level security, and the parent id arrives from the client
// in a hidden field. So there are two ways in:
//
//   opening someone else's record by guessing its id;
//   writing a line onto someone else's record by posting its id.
//
// Both are checked below against a stub that honours the id filter as well as
// the organization filter. That mattered: the first version of the stub matched
// only the organization filter and handed back the parent record for any id at
// all, which made the cross-tenant check pass while proving nothing.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-lines",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-lines"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";
const OURS = "12345678-1234-4234-8234-123456789012";
const THEIRS = "99999999-9999-4999-8999-999999999999";

const WITH_LINES = ALL_OWNER_PAGES.filter((page) => page.lines);

let inserts = [];

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

// "organization_id=eq." contains "id=eq." as a substring, so a single-row
// lookup has to be recognised by [?&]id=eq. and not by id=eq. alone. Getting
// that wrong made the list query look like a lookup and returned no rows.
function isLookupFor(target, url) {
  return new RegExp(`[?&]id=eq\\.${target}`).test(url);
}

function stubFetch() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;

    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") {
      return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
    }
    if (method === "POST") {
      inserts.push({ table, payload: JSON.parse(options.body || "{}") });
      return json([{ id: "created" }], 201);
    }

    const parentTables = WITH_LINES.map((page) => page.table);
    if (parentTables.includes(table)) {
      const scoped = target.includes(`organization_id=eq.${ORGANIZATION_ID}`);
      // Both filters honoured, the way PostgREST would. Only our record, only
      // for our organization.
      if (isLookupFor(OURS, target)) return json(scoped ? [{ id: OURS, po_number: "PO-1001", invoice_number: "INV-1", status: "sent", total_cents: 4500, currency: "usd" }] : []);
      if (/[?&]id=eq\./.test(target)) return json([]);
      return json([{ id: OURS, po_number: "PO-1001", invoice_number: "INV-1", status: "sent", total_cents: 4500, currency: "usd" }]);
    }

    const lineTables = WITH_LINES.map((page) => page.lines.table);
    if (lineTables.includes(table)) {
      return json([
        { id: "line-1", item_name: "Flour", quantity: 10, quantity_ordered: 10, counted_quantity: 10, unit: "kg", unit_cost_cents: 250, total_cost_cents: 2500, extended_value_cents: 2500, estimated_cost_cents: 2500 },
        { id: "line-2", item_name: "Yeast", quantity: 2, quantity_ordered: 2, counted_quantity: 2, unit: "kg", unit_cost_cents: 1000, total_cost_cents: 2000, extended_value_cents: 2000, estimated_cost_cents: 2000 }
      ]);
    }
    return json([]);
  };
}

function asManager(path) {
  return request(app).get(path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
}

function postLine(page, body) {
  return request(app)
    .post(page.lines.api)
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
    .set("Accept", "text/html")
    .type("form")
    .send(body)
    .redirects(0);
}

describe("line items on the records that have them", () => {
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

  beforeEach(() => {
    inserts = [];
  });

  it("covers the four records that have lines", () => {
    assert.equal(WITH_LINES.length, 4, `${WITH_LINES.length} pages declare lines; this check has gone blind`);
  });

  it("writes lines to a real table with real columns", () => {
    // The same failure as the record forms: a payload naming a column that is
    // not there is rejected and nothing saves.
    const wrong = [];
    for (const page of WITH_LINES) {
      const columns = tableColumns(page.lines.table);
      if (!columns) {
        wrong.push(`${page.lines.table} is not in the migrations`);
        continue;
      }
      if (!columns.has(page.lines.parentColumn)) wrong.push(`${page.lines.table} has no column ${page.lines.parentColumn}`);
      if (!columns.has("organization_id")) wrong.push(`${page.lines.table} has no organization_id, so it cannot be tenant scoped`);
      if (!columns.has(page.lines.totalFrom)) wrong.push(`${page.lines.table} has no column ${page.lines.totalFrom} to total from`);
      for (const field of page.lines.form.fields) {
        if (!columns.has(field.name)) wrong.push(`${page.lines.table} has no column ${field.name}`);
      }
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("links every record through to its lines", async () => {
    // A detail page nothing points at is the dead end this codebase has
    // shipped before.
    const unlinked = [];
    for (const page of WITH_LINES) {
      const res = await asManager(page.path);
      if (res.status !== 200) {
        unlinked.push(`${page.path} returned ${res.status}`);
        continue;
      }
      if (!res.text.includes(`href="${page.path}/${OURS}"`)) unlinked.push(`${page.path} does not link to its records`);
    }
    assert.deepEqual(unlinked, [], unlinked.join("\n  "));
  });

  it("shows the lines and a way to add one", async () => {
    const problems = [];
    for (const page of WITH_LINES) {
      const res = await asManager(`${page.path}/${OURS}`);
      if (res.status !== 200) {
        problems.push(`${page.path}/:id returned ${res.status}`);
        continue;
      }
      if (!/Flour/.test(res.text)) problems.push(`${page.path}/:id does not render its lines`);
      if (!res.text.includes(`action="${page.lines.api}"`)) problems.push(`${page.path}/:id has no form to add a line`);
      if (!res.text.includes(`name="${page.lines.parentColumn}"`)) problems.push(`${page.path}/:id does not carry the parent id`);
    }
    assert.deepEqual(problems, [], problems.join("\n  "));
  });

  it("totals only when every line has an amount", async () => {
    // A total computed over rows with missing values reads as the real figure
    // while being short by however many were blank. Both stub lines carry an
    // amount, so a total is correct here -- 2500 + 2000.
    const res = await asManager(`${WITH_LINES[0].path}/${OURS}`);
    assert.match(res.text, /Total of these lines: \$45\.00/, "the total is missing or wrong");
  });

  it("refuses a record id that is not ours", async () => {
    const opened = [];
    for (const page of WITH_LINES) {
      const res = await asManager(`${page.path}/${THEIRS}`);
      // The stub returns nothing for an id outside this organization, so a 200
      // rendering the record would mean the organization filter is not applied.
      if (/PO-1001|INV-1/.test(res.text || "")) opened.push(`${page.path}/:id rendered another organization's record`);
    }
    assert.deepEqual(opened, [], opened.join("\n  "));
  });

  it("refuses a line written onto someone else's record", async () => {
    // The hidden parent field is a value the person submitting chooses, so the
    // handler has to confirm the parent belongs to this business before
    // writing. Without it, posting a guessed id writes into another business.
    const written = [];
    for (const page of WITH_LINES) {
      const res = await postLine(page, { [page.lines.parentColumn]: THEIRS, item_name: "Sneaky" });
      assert.equal(res.status, 303, `${page.lines.api} did not redirect`);
      assert.match(res.headers.location || "", /problem=parent_not_yours/, `${page.lines.api} accepted a foreign parent`);
      if (inserts.some((insert) => insert.table === page.lines.table)) written.push(`${page.lines.api} inserted a row anyway`);
    }
    assert.deepEqual(written, [], written.join("\n  "));
  });

  it("saves a line against our own record and returns to it", async () => {
    for (const page of WITH_LINES) {
      inserts = [];
      const res = await postLine(page, { [page.lines.parentColumn]: OURS, item_name: "Salt" });
      assert.equal(res.status, 303, `${page.lines.api} did not redirect`);
      assert.equal(res.headers.location, `${page.path}/${OURS}`, `${page.lines.api} did not return to the record`);
      const insert = inserts.find((entry) => entry.table === page.lines.table);
      assert.ok(insert, `${page.lines.api} saved nothing`);
      assert.equal(insert.payload.organization_id, ORGANIZATION_ID, "the line was not scoped to the organization");
      assert.equal(insert.payload[page.lines.parentColumn], OURS, "the line was not attached to the record");
    }
  });

  it("will not take the organization from the form", async () => {
    // Same hole as the record forms had: the insert runs with the service key,
    // so a submitted organization_id would write into another business.
    const page = WITH_LINES[0];
    inserts = [];
    await postLine(page, { [page.lines.parentColumn]: OURS, item_name: "Salt", organization_id: THEIRS });
    const insert = inserts.find((entry) => entry.table === page.lines.table);
    assert.ok(insert, "nothing was saved");
    assert.equal(insert.payload.organization_id, ORGANIZATION_ID, "a submitted organization_id overrode the session's organization");
  });

  it("answers a malformed record id with a page rather than a crash", async () => {
    for (const page of WITH_LINES) {
      const res = await asManager(`${page.path}/not-a-uuid`);
      assert.equal(res.status, 404, `${page.path}/not-a-uuid returned ${res.status}`);
      assert.match(res.text, /Not found/i, "the 404 does not say anything to the reader");
    }
  });
});

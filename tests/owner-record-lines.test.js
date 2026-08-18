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
const { ALL_OWNER_PAGES, childrenOf, REFERENCE_SOURCES } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";
const OURS = "12345678-1234-4234-8234-123456789012";
const THEIRS = "99999999-9999-4999-8999-999999999999";

// One entry per (page, child table) pair rather than per page.
//
// A record can now declare more than one child -- an invoice has line items and
// payments received. Iterating pages and reading page.lines would have tested
// the first child of each and silently skipped the rest, which is the same
// blindness as assuming one shape for all of them.
const WITH_LINES = ALL_OWNER_PAGES.flatMap((page) =>
  childrenOf(page).map((spec) => ({ ...page, lines: spec }))
);

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
      if (isLookupFor(OURS, target)) return json(scoped ? [{ id: OURS, po_number: "PO-1001", invoice_number: "INV-1", name: "Widget", status: "sent", total_cents: 4500, currency: "usd" }] : []);
      if (/[?&]id=eq\./.test(target)) return json([]);
      return json([{ id: OURS, po_number: "PO-1001", invoice_number: "INV-1", name: "Widget", status: "sent", total_cents: 4500, currency: "usd" }]);
    }

    const lineTables = WITH_LINES.map((page) => page.lines.table);
    if (lineTables.includes(table)) {
      return json([
        { id: "line-1", item_name: "Flour", quantity: 10, quantity_ordered: 10, counted_quantity: 10, unit: "kg", unit_cost_cents: 250, total_cost_cents: 2500, extended_value_cents: 2500, estimated_cost_cents: 2500, received_on: "2026-08-01", amount_cents: 2500, method: "Bank transfer", reference: "REF-1", description: "Call-out fee", unit_price_cents: 250, line_total_cents: 2500, ingredient_name: "Flour", calculated_cost_cents: 2500, waste_percent: 5, quantity_sold: 3, net_sales_cents: 2500, rate_type: "hourly", amount_cents: 2500, effective_from: "2026-08-01", variant_name: "Large", price_cents: 2500, currency: "usd" },
        { id: "line-2", item_name: "Yeast", quantity: 2, quantity_ordered: 2, counted_quantity: 2, unit: "kg", unit_cost_cents: 1000, total_cost_cents: 2000, extended_value_cents: 2000, estimated_cost_cents: 2000, received_on: "2026-08-02", amount_cents: 2000, method: "Bank transfer", reference: "REF-2", description: "Call-out fee", unit_price_cents: 1000, line_total_cents: 2000, ingredient_name: "Yeast", calculated_cost_cents: 2000, waste_percent: 0, quantity_sold: 2, net_sales_cents: 2000, rate_type: "hourly", amount_cents: 2000, effective_from: "2026-08-02", variant_name: "Small", price_cents: 2000, currency: "usd" }
      ]);
    }
    // The tables behind the pickers. Without these the reference check below
    // measures a stub that returns nothing rather than a page that renders
    // nothing, and passes for the wrong reason.
    const referenceTables = new Set(Object.values(REFERENCE_SOURCES).map((source) => source.table));
    if (referenceTables.has(table)) {
      return json([{ id: "ref-1", name: "Something to pick", display_name: "Something to pick", sku: "SKU-1" }]);
    }

    return json([]);
  };
}

function asManager(path) {
  return request(app).get(path).set("Accept", "text/html").set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`).redirects(0);
}

function requiredBody(page, parentId, extra = {}) {
  // A submission shaped like the page's own form. Hardcoding item_name here
  // worked while every line table was stock lines; customer_invoice_payments
  // asks for an amount and never for an item name, so a shared body tested the
  // reject path on that page and nothing else.
  const body = { [page.lines.parentColumn]: parentId };
  for (const field of page.lines.form.fields.filter((entry) => entry.required)) {
    // A date column given the word "Something" is rejected by Postgres, so a
    // harness that posts it is testing a path no real submission takes. The
    // stub accepts anything, which is exactly why this went unnoticed until a
    // child with a required date arrived.
    body[field.name] = field.type === "number" ? "1250" : field.type === "date" ? "2026-08-01" : "Something";
  }
  return { ...body, ...extra };
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

// What proves a page rendered its own lines rather than an empty table.
//
// This was the string "Flour" for every page, which worked while all four line
// tables were stock lines with an item_name. customer_invoice_payments has no
// item name -- it has a date, an amount, a method and a reference -- so a
// single shared marker would have reported it broken while it rendered
// correctly. The stub row carries every column the five tables use; this says
// which one is the evidence for each.
const LINE_EVIDENCE = Object.freeze({
  purchase_order_lines: "Flour",
  inventory_count_lines: "Flour",
  location_transfer_lines: "Flour",
  vendor_invoice_lines: "Flour",
  customer_invoice_lines: "Call-out fee",
  customer_invoice_payments: "Bank transfer",
  merchant_product_variants: "Large",
  recipe_ingredients: "Flour",
  pos_menu_mix_items: "Flour",
  employee_wage_rates: "hourly"
});

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

  it("covers every record that has lines", () => {
    assert.equal(WITH_LINES.length, 10, `${WITH_LINES.length} record/child pairs found; this check has gone blind`);
    const missing = WITH_LINES.filter((page) => !LINE_EVIDENCE[page.lines.table]).map((page) => page.lines.table);
    assert.deepEqual(missing, [], `no rendering evidence declared for: ${missing.join(", ")}`);
  });

  // A `from:` naming no entry in REFERENCE_SOURCES renders an empty select: a
  // control that looks like a way to pick something and offers nothing. Found
  // by writing `from: "inventory"` for recipe ingredients before the source
  // existed, and nothing objected.
  it("points every reference field at a source that exists", () => {
    const sources = new Set(Object.keys(REFERENCE_SOURCES));
    assert.ok(sources.size >= 5, `only ${sources.size} reference sources found; this check has gone blind`);
    const dangling = [];
    for (const page of WITH_LINES) {
      for (const field of page.lines.form.fields.filter((entry) => entry.type === "reference")) {
        if (!sources.has(field.from)) dangling.push(`${page.lines.table}.${field.name} points at "${field.from}"`);
      }
      for (const field of (page.form?.fields || []).filter((entry) => entry.type === "reference")) {
        if (!sources.has(field.from)) dangling.push(`${page.table}.${field.name} points at "${field.from}"`);
      }
    }
    assert.deepEqual(dangling, [], "these reference fields would render an empty picker");
  });

  // A total that is short by however many lines were blank.
  //
  // linesCard guarded with `Number.isFinite(Number(row[totalFrom]))`, and
  // Number(null) is 0, Number("") is 0, both finite. So a purchase order with
  // one line whose total had not been entered totalled the rest and printed
  // "Total of these lines" as though it were the whole order. The line was
  // visible in the table with a blank cost, so the two disagreed on the same
  // screen.
  //
  // Found by a recipe with one uncosted ingredient reporting a confident cost
  // per portion; every line table had it.
  it("does not treat a blank amount as zero when totalling", () => {
    const { finiteNumber } = require("../lib/sonara-owner-record-pages.cjs");
    // Split, because they did not all get through. Number(undefined) is NaN, so
    // the old guard did reject an absent column -- it was null, "" and false
    // that passed as zero, which is what PostgREST returns for a column with no
    // value in it. Writing all four as though they were the same was wrong and
    // this assertion caught it.
    for (const passedAsZero of [null, "", false]) {
      assert.equal(finiteNumber(passedAsZero), null, `${JSON.stringify(passedAsZero)} must not read as a number`);
      assert.equal(Number.isFinite(Number(passedAsZero)), true, "the old guard accepted this, which is why the check exists");
    }
    for (const alreadyRejected of [undefined, "nope"]) {
      assert.equal(finiteNumber(alreadyRejected), null);
      assert.equal(Number.isFinite(Number(alreadyRejected)), false, "the old guard already refused this one");
    }
    for (const [value, expected] of [[0, 0], ["0", 0], [2500, 2500], ["2500", 2500], [-5, -5], ["1.5", 1.5]]) {
      assert.equal(finiteNumber(value), expected, `${JSON.stringify(value)} is a real number and must survive`);
    }
    assert.equal(finiteNumber(NaN), null);
  });

  // The reverse of form reachability, which nothing asked.
  //
  // tests/form-reachability.test.js checks that every create-shaped POST route
  // can be reached from a form. It cannot see the other direction: a page
  // declaring `api:` for an endpoint nobody registered renders a form that
  // posts to a 404. The daily sales page was written that way and the button
  // looked exactly like the working ones -- the child endpoint is registered
  // automatically from the child spec, so only the parent was missing, and the
  // OpenAPI gate flagged the child while saying nothing about the parent.
  it("points every page form at an endpoint that exists", () => {
    const app = require("../server");
    const posts = new Set(
      app._router.stack
        .filter((layer) => layer.route && layer.route.methods?.post)
        .map((layer) => layer.route.path)
    );
    assert.ok(posts.size >= 40, `only ${posts.size} POST routes found; this check has gone blind`);

    // What the form posts to, which is not always page.api. The time page lists
    // from /api/business/time-entries and its form posts to .../start, because
    // clocking in is "start one now" rather than "create a time entry" -- so
    // reading page.api alone reported a working page as broken. Same rule
    // lib/sonara-form-reachability.cjs already learned.
    const dangling = [];
    for (const page of ALL_OWNER_PAGES) {
      if (page.form) {
        const action = page.form.action || page.api;
        if (action && !posts.has(action)) dangling.push(`${page.path} posts to ${action}`);
      }
      for (const spec of childrenOf(page)) {
        if (spec.form && spec.api && !posts.has(spec.api)) dangling.push(`${page.path} lines post to ${spec.api}`);
      }
    }
    assert.deepEqual(dangling, [], "these forms would post to a route that is not registered");
  });

  // A picker on a line form.
  //
  // loadReferences read page.form.fields only, and lineFormCard called
  // formField with an empty references object, so every reference field on a
  // child line form rendered "Nothing to choose yet -- add one first" whatever
  // the business had. Three did, and the invoice-line service picker had been
  // shipped that way long enough that a business with a full service catalogue
  // was being told to go and add a service first.
  it("fills in the pickers on a line form", async () => {
    const withReference = WITH_LINES.filter((page) => (page.lines.form.fields || []).some((field) => field.type === "reference"));
    assert.ok(withReference.length >= 2, `only ${withReference.length} line forms have a picker; this check has gone blind`);

    for (const page of withReference) {
      const response = await asManager(`${page.path}/${OURS}`);
      assert.equal(response.status, 200, `${page.path} did not render`);
      assert.doesNotMatch(
        String(response.text),
        /Nothing to choose yet/,
        `${page.path}'s line form renders an empty picker although the stub returns rows for every table`
      );
    }
  });

  it("gives every child its own endpoint", () => {
    // Two children sharing an api path is not a duplicate route error -- Express
    // registers both and the first one wins. customer_invoice_lines was
    // declared with /api/business/invoice-lines, which vendor_invoice_lines
    // already owned, so every invoice line posted was validated against a
    // vendor invoice and written to the vendor lines table. Nothing errored.
    const byApi = new Map();
    const collisions = [];
    for (const page of WITH_LINES) {
      const existing = byApi.get(page.lines.api);
      if (existing) collisions.push(`${page.lines.api} is claimed by both ${existing} and ${page.lines.table}`);
      byApi.set(page.lines.api, page.lines.table);
    }
    assert.deepEqual(collisions, [], collisions.join("\n  "));
    assert.equal(byApi.size, WITH_LINES.length, "a child table lost its endpoint to another");
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
      // `totalFrom` is optional, and the absence is a decision rather than an
      // omission. Product versions declare none: adding up the prices of a
      // small, a medium and a large produces a number nobody is ever charged,
      // and printing it under the table would be exactly the kind of confident
      // figure this file exists to stop. What is not allowed is naming a
      // column that is not there, which totals silently to nothing.
      if (page.lines.totalFrom === undefined) {
        assert.ok(!("totalFrom" in page.lines), `${page.lines.table} sets totalFrom to undefined; leave it out or name a column`);
      } else if (!columns.has(page.lines.totalFrom)) {
        wrong.push(`${page.lines.table} has no column ${page.lines.totalFrom} to total from`);
      }
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
      if (!res.text.includes(LINE_EVIDENCE[page.lines.table])) problems.push(`${page.path}/:id does not render its lines`);
      if (!res.text.includes(`action="${page.lines.api}"`)) problems.push(`${page.path}/:id has no form to add a line`);
      if (!res.text.includes(`name="${page.lines.parentColumn}"`)) problems.push(`${page.path}/:id does not carry the parent id`);
    }
    assert.deepEqual(problems, [], problems.join("\n  "));
  });

  it("saves a line submitted with that page's own required fields", async () => {
    // This is the test that was missing. Every case here posted item_name,
    // because all four line tables had one -- so the handler reading
    // req.body.item_name directly passed, and customer_invoice_payments, whose
    // form asks for an amount and never for an item name, was rejected on every
    // submission as missing a field it does not have.
    const rejected = [];
    for (const page of WITH_LINES) {
      inserts = [];
      await postLine(page, requiredBody(page, OURS));
      if (!inserts.some((entry) => entry.table === page.lines.table)) {
        rejected.push(`${page.lines.api} saved nothing when sent exactly the fields its own form marks required`);
      }
    }
    assert.deepEqual(rejected, [], rejected.join("\n  "));
  });

  it("refuses a line missing a field its own form marks required", async () => {
    const accepted = [];
    for (const page of WITH_LINES) {
      const required = page.lines.form.fields.filter((entry) => entry.required);
      if (required.length === 0) continue;
      inserts = [];
      // Everything required except the first one.
      const body = { [page.lines.parentColumn]: OURS };
      for (const field of required.slice(1)) {
        body[field.name] = field.type === "number" ? "1250" : "Something";
      }
      await postLine(page, body);
      if (inserts.some((entry) => entry.table === page.lines.table)) {
        accepted.push(`${page.lines.api} saved a row with no ${required[0].name}`);
      }
    }
    assert.deepEqual(accepted, [], accepted.join("\n  "));
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
      const res = await postLine(page, requiredBody(page, THEIRS));
      assert.equal(res.status, 303, `${page.lines.api} did not redirect`);
      assert.match(res.headers.location || "", /problem=parent_not_yours/, `${page.lines.api} accepted a foreign parent`);
      if (inserts.some((insert) => insert.table === page.lines.table)) written.push(`${page.lines.api} inserted a row anyway`);
    }
    assert.deepEqual(written, [], written.join("\n  "));
  });

  it("saves a line against our own record and returns to it", async () => {
    for (const page of WITH_LINES) {
      inserts = [];
      const res = await postLine(page, requiredBody(page, OURS));
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
    // Was a hand-written body with item_name on WITH_LINES[0], which is the
    // brittleness this file already learned once: adding a child changed which
    // page was first, its form asks for an amount and a date, and the
    // submission was rejected before the organization check it exists to test
    // could run. requiredBody shapes the body from the page's own form.
    const page = WITH_LINES[0];
    inserts = [];
    await postLine(page, requiredBody(page, OURS, { organization_id: THEIRS }));
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

// A picker that could not be loaded is not a picker with nothing in it.
//
// loadReferences collapsed a failed read to an empty array, so "we could not
// load your customers" and "you have no customers" were the same sentence --
// and the second one tells a business to go and create records it may already
// have hundreds of.
describe("a picker says which kind of empty it is", () => {
  const { ALL_OWNER_PAGES: pages } = require("../lib/sonara-owner-record-pages.cjs");

  it("has pages with pickers to be measuring", () => {
    const withPickers = pages.filter((page) => (page.form?.fields || []).some((field) => field.type === "reference"));
    assert.ok(withPickers.length >= 3, `only ${withPickers.length} pages have a picker`);
  });

  it("distinguishes an unreadable source from an empty one", () => {
    const source = read("routes/sonara-last9-routes.cjs").replace(/^\s*\/\/.*$/gm, "");
    // The three states, in the code that renders them.
    assert.match(source, /ok: true, options:/, "a successful read must carry its rows and its outcome");
    assert.match(source, /ok: false, options: \[\]/, "a failed read must be marked, not flattened");
    assert.match(source, /We could not load these just now/, "and must read differently to the customer");
    assert.match(source, /Nothing to choose yet/, "while a genuinely empty source still says so");
  });

  function read(file) {
    return require("node:fs").readFileSync(require("node:path").join(__dirname, "..", file), "utf8");
  }
});

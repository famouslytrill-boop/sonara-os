"use strict";

// Twenty-seven owner record pages. Eleven have a terminal status in their own
// vocabulary -- a quote goes `declined`, an invoice goes `void`, a booking goes
// `cancelled` -- so those pages already say "finished with". **The other sixteen
// have no status at all**, and a customer entered twice, a vehicle sold, a
// supplier no longer used, stayed on the list for ever.
//
// The fear this feature has to answer is the opposite of the feature: "archive"
// reads like "delete", and a business that thinks archiving a March supplier
// changed what March cost has been given a figure that does not match its books.
//
// So the property that matters most here is not that archiving works. It is
// that **exactly one read filters on `archived_at`** -- the owner list page --
// and nothing that computes money looks at it at all. That is the last test in
// this file, and it is the one to keep.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const recordArchive = require("../lib/sonara-record-archive.cjs");
const changeLog = require("../lib/sonara-record-change-log.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

const ARCHIVABLE = ALL_OWNER_PAGES.filter((page) => recordArchive.canArchive(page));
const NOT_ARCHIVABLE = ALL_OWNER_PAGES.filter((page) => !recordArchive.canArchive(page));

function buildApp({ rows = [], calls = [], total = null } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: "22222222-2222-4222-8222-222222222222" };
    return next();
  };
  registerRoutes(app, {
    layout: ({ title, heading, sections = [] }) => `<html><title>${title}</title><h1>${heading}</h1>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><p>${cardBody}</p></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" })
  });
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const target = String(url);
    calls.push({ method, url: target, prefer: options.headers?.Prefer || null, body: options.body ? JSON.parse(options.body) : null });
    const counting = String(options.headers?.Prefer || "").includes("count=exact");
    if (method === "PATCH") return { ok: true, status: 200, headers: { get: () => null }, json: async () => [{ id: RECORD_ID }] };
    if (method === "POST") return { ok: true, status: 201, headers: { get: () => null }, json: async () => [{ id: "created" }] };
    return {
      ok: true,
      status: 200,
      headers: { get: () => (counting && total !== null ? `0-0/${total}` : "0-0/1") },
      json: async () => (counting ? [] : rows)
    };
  };
  return app;
}

const listRead = (calls, table) =>
  calls.find((call) => call.method === "GET" && call.url.includes(`/${table}?`) && !String(call.prefer || "").includes("count"));

describe("an archived record is off the list, not out of the books", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it("splits the pages, and every page that has no button says why", () => {
    assert.ok(ARCHIVABLE.length >= 12, `only ${ARCHIVABLE.length} pages can be archived; this check has gone blind`);
    assert.ok(NOT_ARCHIVABLE.length >= 8, `only ${NOT_ARCHIVABLE.length} pages are excluded; this check has gone blind`);
    assert.equal(ARCHIVABLE.length + NOT_ARCHIVABLE.length, ALL_OWNER_PAGES.length);
    for (const page of NOT_ARCHIVABLE) {
      const reason = recordArchive.reasonWithoutArchive(page);
      assert.ok(reason, `${page.table} has no archive control and no recorded reason`);
      // The first version said "retired by setting their status to archived,
      // rather than archived" for the seven whose terminal value IS archived.
      assert.ok(!/archived, rather than archived/.test(reason), `${page.table}: ${reason}`);
    }
  });

  it("matches the migration column for column, in both directions", () => {
    // The set is derived from each page's status vocabulary. The migration is
    // written by hand. If those two ever disagree, either a page offers a
    // button the database cannot honour or a column sits unused -- and neither
    // shows up as an error anywhere else.
    const file = fs
      .readdirSync(path.join(__dirname, "..", "supabase", "migrations"))
      .find((name) => name.includes("owner_records_can_be_archived"));
    assert.ok(file, "no migration adds the archive column");
    const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", file), "utf8");
    const altered = [...sql.matchAll(/alter table public\.([a-z_]+)\s+add column if not exists archived_at/g)].map((m) => m[1]);
    assert.deepEqual(
      altered.sort(),
      ARCHIVABLE.map((page) => page.table).sort(),
      "the migration and the derived set disagree about which tables can be archived"
    );
  });

  it("selects the column the button reads", async () => {
    // Sixteen page declarations name their columns explicitly and none listed
    // archived_at -- there was no such column when they were written. The row
    // reached the renderer without it, so an archived record still showed
    // "Archive" rather than "Put back": a control reporting the opposite of the
    // state it is in.
    for (const page of ARCHIVABLE) {
      const calls = [];
      const app = buildApp({ rows: [{ id: RECORD_ID }], calls });
      await request(app).get(page.path).set("accept", "text/html");
      const read = listRead(calls, page.table);
      const select = decodeURIComponent((read.url.match(/select=([^&]*)/) || [])[1] || "");
      assert.ok(select === "*" || select.split(",").includes("archived_at"), `${page.path} does not read archived_at: ${select}`);
    }
  });

  it("says Archive on a current record and Put back on an archived one", async () => {
    const page = ARCHIVABLE[0];
    const current = buildApp({ rows: [{ id: RECORD_ID, archived_at: null }] });
    const shown = await request(current).get(page.path).set("accept", "text/html");
    assert.match(shown.text, />Archive</, "a current record offers no way to archive it");
    assert.ok(!/>Put back</.test(shown.text), "a current record offers to put it back");

    const archived = buildApp({ rows: [{ id: RECORD_ID, archived_at: "2026-09-01T00:00:00Z" }] });
    const back = await request(archived).get(`${page.path}?archived=1`).set("accept", "text/html");
    assert.match(back.text, />Put back</, "an archived record offers no way back");
  });

  it("hides archived rows by default and shows them when asked", async () => {
    const page = ARCHIVABLE[0];
    const hidden = [];
    await request(buildApp({ rows: [], calls: hidden })).get(page.path).set("accept", "text/html");
    assert.match(listRead(hidden, page.table).url, /archived_at=is\.null/, "the default list shows archived records");

    const shown = [];
    await request(buildApp({ rows: [], calls: shown })).get(`${page.path}?archived=1`).set("accept", "text/html");
    assert.ok(!/archived_at=is\.null/.test(listRead(shown, page.table).url), "asking for archived records still hid them");
  });

  it("says how many are not on screen, and offers the way to see them", async () => {
    const page = ARCHIVABLE[0];
    const app = buildApp({ rows: [{ id: RECORD_ID }], total: 3 });
    const result = await request(app).get(page.path).set("accept", "text/html");
    assert.match(result.text, /3 archived records are not shown/);
    assert.match(result.text, /archived=1/, "nothing on the page leads to the archived records");
  });

  it("does not say nothing is archived when the count did not happen", async () => {
    // A count that failed is not a count of zero, and "nothing is archived" on
    // the strength of a request that did not happen is how somebody concludes a
    // record they archived has been deleted.
    assert.equal(recordArchive.describeHidden(null), null);
    assert.equal(recordArchive.describeHidden(0), null);
    assert.match(recordArchive.describeHidden(1), /1 archived record is not shown/);
    assert.match(recordArchive.describeHidden(9, { including: true }), /Showing archived records as well/);
  });

  it("gives every page that can archive an endpoint, and no page that cannot", async () => {
    for (const page of ARCHIVABLE) {
      const calls = [];
      const app = buildApp({ calls });
      const result = await request(app)
        .post(`${page.path}/${RECORD_ID}/archive`)
        .set("accept", "application/json")
        .send({ archived: "1" });
      assert.equal(result.status, 200, `${page.path} cannot archive (answered ${result.status})`);
      const patch = calls.find((call) => call.method === "PATCH");
      assert.ok(patch.body.archived_at, `${page.path} archived without writing a time`);
      assert.deepEqual(Object.keys(patch.body), ["archived_at"], `${page.path} wrote more than the archive column`);
    }
    for (const page of NOT_ARCHIVABLE) {
      const app = buildApp({});
      const result = await request(app)
        .post(`${page.path}/${RECORD_ID}/archive`)
        .set("accept", "application/json")
        .send({ archived: "1" });
      assert.notEqual(result.status, 200, `${page.path} has an archive endpoint it should not`);
    }
  });

  it("puts a record back, and scopes both writes to one business", async () => {
    const page = ARCHIVABLE[0];
    const calls = [];
    const app = buildApp({ calls });
    const back = await request(app)
      .post(`${page.path}/${RECORD_ID}/archive`)
      .set("accept", "application/json")
      .send({ archived: "0" });
    assert.equal(back.status, 200);
    const patch = calls.find((call) => call.method === "PATCH");
    assert.equal(patch.body.archived_at, null, "putting a record back did not clear the column");
    // The service key bypasses row level security, so this filter is the whole
    // tenant boundary.
    assert.ok(patch.url.includes(`organization_id=eq.${ORGANIZATION_ID}`), "the write was not scoped to one business");
  });

  it("records who archived it", async () => {
    const page = ARCHIVABLE[0];
    const calls = [];
    const app = buildApp({ calls });
    await request(app).post(`${page.path}/${RECORD_ID}/archive`).set("accept", "application/json").send({ archived: "1" });
    const logged = calls.find((call) => call.method === "POST" && call.url.includes(changeLog.TABLE));
    assert.ok(logged, "a record was archived with no record of who did it");
    assert.deepEqual(logged.body.changed_fields, ["archived_at"]);
  });

  it("tells somebody archiving is not deleting", async () => {
    // The whole design rests on this being understood, and "archive" reads like
    // "delete" to most people.
    assert.match(recordArchive.describeChange(true), /still counted in every total/i);
    assert.match(recordArchive.describeChange(false), /back on your list/i);
  });

  it("is the only read in the whole application that filters on archived_at", () => {
    // The property that makes this safe, and the reason the fear it answers is
    // the opposite of the feature. An archived vendor invoice is still in the
    // payables total; an archived time entry is still in the labour cost of its
    // day; every accounting export still contains all of them. That holds only
    // while nothing else filters this column.
    const root = path.join(__dirname, "..");
    const files = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(cjs|js)$/.test(full)) files.push(full);
      }
    };
    walk(path.join(root, "lib"));
    walk(path.join(root, "routes"));
    files.push(path.join(root, "server.js"));
    assert.ok(files.length >= 100, `only ${files.length} runtime files scanned; this check has gone blind`);

    const filtering = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      // A PostgREST filter on the column, in any of the shapes this codebase
      // writes one. Not a bare mention: `archived_at` appears in the patch
      // body, in the select list and in the change-log field name, and none of
      // those hides a row from anybody.
      for (const match of source.matchAll(/archived_at=(?:is|not|eq|neq|gt|lt)\./g)) {
        filtering.push(`${path.relative(root, file)} :: ${match[0]}`);
      }
    }

    // Two, and both belong to the owner list page: the clause that hides them
    // and the count that says how many were hidden.
    assert.deepEqual(
      filtering.sort(),
      [
        "lib/sonara-record-archive.cjs :: archived_at=is.",
        "routes/sonara-last9-routes.cjs :: archived_at=not."
      ],
      `something else now filters on archived_at:\n${filtering.join("\n")}`
    );
  });
});

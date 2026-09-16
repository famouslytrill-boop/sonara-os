"use strict";

// Two exports were capped at 10,000 rows with no way to tell the cap had been
// reached. `limit=10000` returns 10,000 rows for a period holding 10,000 and
// for a period holding 40,000, and those are different facts.
//
// What each one did with that:
//
//   * `/business-builder/owner/accounting-exports/:id/download` built a CSV,
//     set X-Sonara-Export-Rows to 10000, and handed it to an accountant. The
//     file opened cleanly and was missing records, and nothing in it said so.
//   * `/account/data/export` returned a payload carrying a field called
//     **complete**, computed from whether any table failed to READ. A table
//     that answered with its most recent 10,000 of 40,000 rows had not failed,
//     so the partial copy was labelled complete -- under a page whose own copy
//     promised "Nothing is left out".
//
// The two are fixed differently on purpose, and the difference is the thing
// worth checking. The accounting file is REFUSED, because an accountant acting
// on figures that are quietly short is a harm no later correction undoes. The
// data export is DELIVERED and labelled, because a customer asking for a copy
// of their own records is better served by the most recent 10,000 plus an
// honest note than by nothing at all.

const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const registerRoutes = require("../routes/sonara-last9-routes.cjs");
const { ACCOUNTING_EXPORT_SOURCES } = require("../lib/sonara-accounting-export-sources.cjs");

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const EXPORT_ID = "33333333-3333-4333-8333-333333333333";

// The cap the routes use. Read from the module under test would be circular, so
// it is stated here and the assertions below check the ROUTE honours it -- a cap
// raised in the source without a thought for this file shows up as a failure
// rather than as a silently weaker check.
const CAP = 10000;

function rowsOf(count, columns) {
  return Array.from({ length: count }, (_, index) => {
    const row = {};
    for (const column of columns) row[column] = column === "id" ? `row-${index}` : index;
    return row;
  });
}

// PostgREST honours `limit`, so a stub that ignores it would let the route ask
// for CAP + 1 and still "prove" nothing. This reads the limit out of the query
// and truncates, exactly as the database would.
function respondWithLimit(url, available) {
  const limit = Number(new URL(url).searchParams.get("limit") || available.length);
  return new Response(JSON.stringify(available.slice(0, limit)), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function harness({ exportType = "bills", availableRows = 5, tableRowCounts = null } = {}) {
  const source = ACCOUNTING_EXPORT_SOURCES[exportType];
  const seen = [];

  const fetchImpl = async (url) => {
    const target = String(url);
    seen.push(target);

    if (target.includes("/rest/v1/accounting_exports")) {
      return new Response(
        JSON.stringify([{
          id: EXPORT_ID,
          organization_id: ORGANIZATION_ID,
          export_type: exportType,
          period_start: "2026-01-01",
          period_end: "2026-03-31"
        }]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (source && target.includes(`/rest/v1/${source.table}`)) {
      return respondWithLimit(target, rowsOf(availableRows, source.columns));
    }

    // The data export walks every record table. `tableRowCounts` names how many
    // rows a given table has; anything unnamed has none.
    if (tableRowCounts) {
      const match = target.match(/\/rest\/v1\/([a-z0-9_]+)\?/);
      const table = match ? match[1] : null;
      if (table) {
        const count = Object.prototype.hasOwnProperty.call(tableRowCounts, table) ? tableRowCounts[table] : 0;
        return respondWithLimit(target, rowsOf(count, ["id", "created_at"]));
      }
    }

    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  const authenticate = (req, res, next) => {
    req.sonaraUser = { id: USER_ID, email: "owner@example.com" };
    return next();
  };
  registerRoutes(app, {
    // The deps shape is copied from tests/data-rights.test.js rather than
    // inferred. `requireCustomer` and `requireBusinessManager` are middleware
    // used directly; only `requireWorkspaceAccess` is a factory. Guessing that
    // wrong registers no routes at all, and every assertion below then fails as
    // a timeout rather than as the thing it checks.
    layout: ({ title, heading, body, sections = [], actions = [] }) =>
      `<html><title>${title}</title><h1>${heading}</h1><p>${body}</p><nav>${actions.join("")}</nav>${sections.join("")}</html>`,
    brandCard: (cardTitle, cardBody) => `<article><h2>${cardTitle}</h2><div>${cardBody}</div></article>`,
    linkAction: (href, label) => `<a href="${href}">${label}</a>`,
    escapeHtml: (value) => String(value),
    requireCustomer: authenticate,
    requireBusinessManager: authenticate,
    requireWorkspaceAccess: () => authenticate,
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORGANIZATION_ID, role: "owner" }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://project.supabase.co", serviceRoleKey: "server-only" }),
    getEnv: () => undefined
  });

  return { app, fetchImpl, seen, source };
}

async function withFetch(fetchImpl, run) {
  const original = global.fetch;
  global.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

describe("an export says when it is short", () => {
  it("downloads a period that fits", async () => {
    // The control. Without it every assertion below could pass against a route
    // that refuses every export, which is not a fix.
    const { app, fetchImpl } = harness({ availableRows: 5 });
    const response = await withFetch(fetchImpl, () =>
      request(app).get(`/business-builder/owner/accounting-exports/${EXPORT_ID}/download`)
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers["x-sonara-export-rows"], "5");
    assert.match(response.headers["content-type"], /text\/csv/);
  });

  it("refuses a period larger than one file can carry", async () => {
    const { app, fetchImpl } = harness({ availableRows: CAP + 1 });
    const response = await withFetch(fetchImpl, () =>
      request(app).get(`/business-builder/owner/accounting-exports/${EXPORT_ID}/download`)
    );

    // No file at all. A 200 carrying 10,000 of 10,001 rows is the defect: it
    // opens, the row count looks plausible, and an accountant has no way to
    // know a record is missing.
    assert.equal(response.status, 413, "a period over the cap produced a file anyway");
    assert.equal(response.headers["x-sonara-export-rows"], undefined, "a refused export still reported a row count");
    assert.doesNotMatch(String(response.headers["content-type"] || ""), /text\/csv/, "a refused export still returned a CSV");

    // And it says what to do. "Too many records" with no next step leaves an
    // owner with a download button that does not work and no idea why.
    assert.match(response.text, /shorter periods/i);
    assert.match(response.text, /10,000/);
  });

  it("asks for one row more than it will use, or it could not tell", async () => {
    // The mechanism, asserted directly. Detecting the cap rests entirely on
    // requesting CAP + 1: a route that asks for exactly CAP gets CAP back from
    // a table holding a million and cannot distinguish that from a full read.
    const { app, fetchImpl, seen, source } = harness({ availableRows: 5 });
    await withFetch(fetchImpl, () =>
      request(app).get(`/business-builder/owner/accounting-exports/${EXPORT_ID}/download`)
    );

    const read = seen.find((url) => url.includes(`/rest/v1/${source.table}?`));
    assert.ok(read, "the export never read its source table");
    assert.match(read, new RegExp(`limit=${CAP + 1}`), `the export asked for a limit it cannot interpret: ${read}`);
  });

  it("fetches only the columns the file will contain", async () => {
    // buildRecordCsv writes source.columns and nothing else, so `select=*` here
    // fetched every column of up to 10,000 rows into a file that used thirteen
    // of them. Fetched into the output and never used.
    const { app, fetchImpl, seen, source } = harness({ availableRows: 3 });
    await withFetch(fetchImpl, () =>
      request(app).get(`/business-builder/owner/accounting-exports/${EXPORT_ID}/download`)
    );

    const read = seen.find((url) => url.includes(`/rest/v1/${source.table}?`));
    const select = new URL(read).searchParams.get("select");
    assert.notEqual(select, "*", "the export still fetches every column to write a declared subset");
    assert.deepEqual(select.split(","), [...source.columns], "the export's select and the CSV's columns disagree");
  });

  it("does not call a truncated data export complete", async () => {
    // The field is named `complete`. It was computed from whether any table
    // failed to READ, and a table that answered with 10,000 of 40,000 rows had
    // not failed -- so this said true over a partial copy of somebody's records.
    const { app, fetchImpl } = harness({ tableRowCounts: { customers: CAP + 1 } });
    const response = await withFetch(fetchImpl, () =>
      request(app).get("/account/data/export").set("Accept", "application/json")
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.complete, false, "a truncated export called itself complete");
    assert.deepEqual(response.body.truncated, ["customers"]);
    assert.equal(response.body.truncatedAt, CAP);

    // Delivered, not refused -- and the difference from the accounting export
    // is deliberate. A customer asking for their own records is better served
    // by the most recent 10,000 and an honest note than by nothing.
    assert.ok(Array.isArray(response.body.records.customers), "the export withheld the rows it did read");
    assert.equal(response.body.records.customers.length, CAP, "the export returned more rows than its own cap");

    // The note has to say which way it is short. Ordered created_at.desc, so
    // what is present is the newest and what is missing is the oldest, and
    // those send a person looking in different places.
    assert.match(response.body.note, /most recent/i);
    assert.match(response.body.note, /older ones are still in your account/i);
  });

  it("still calls a full data export complete", async () => {
    // Or the assertion above is satisfied by a route that never reports
    // complete at all, which would be a different bug wearing the same green.
    const { app, fetchImpl } = harness({ tableRowCounts: { customers: 3 } });
    const response = await withFetch(fetchImpl, () =>
      request(app).get("/account/data/export").set("Accept", "application/json")
    );

    assert.equal(response.body.complete, true, "a complete export no longer reports itself complete");
    assert.deepEqual(response.body.truncated, []);
    assert.equal(response.body.truncatedAt, null);
    assert.equal(response.body.records.customers.length, 3);
  });

  it("keeps unreadable and truncated as separate facts", async () => {
    // A table that could not be read and a table larger than the file are both
    // reasons the copy is short, and they need different actions: one is an
    // outage to retry, the other is a size to work around. Collapsing them into
    // one list would tell a customer to retry something retrying cannot fix.
    const { app } = harness();
    const both = await withFetch(async (url) => {
      const target = String(url);
      const match = target.match(/\/rest\/v1\/([a-z0-9_]+)\?/);
      const table = match ? match[1] : null;
      if (table === "customers") return respondWithLimit(target, rowsOf(CAP + 1, ["id", "created_at"]));
      if (table === "vendor_invoices") return new Response("boom", { status: 500 });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }, () => request(app).get("/account/data/export").set("Accept", "application/json"));

    assert.equal(both.body.complete, false);
    assert.deepEqual(both.body.truncated, ["customers"]);
    assert.ok(both.body.unreadable.includes("vendor_invoices"), "an unreadable table was not named");
    assert.ok(!both.body.truncated.includes("vendor_invoices"), "an unreadable table was reported as merely truncated");
    assert.equal(both.body.records.vendor_invoices, null, "an unreadable table came back as an empty list rather than null");
    // Both sentences, not one. The note is what a person actually reads.
    assert.match(both.body.note, /could not be read/i);
    assert.match(both.body.note, /more than 10,000/i);
  });

  it("no longer promises that nothing is left out", async () => {
    // The page said "Nothing is left out of the kinds listed above", which was
    // false for any table over the cap. A fix that leaves the promise on the
    // page fixes the payload and not the thing the customer read.
    const { app, fetchImpl } = harness();
    const page = await withFetch(fetchImpl, () =>
      request(app).get("/account/data").set("Accept", "text/html")
    );

    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, /Nothing is left out/i, "the page still promises a complete copy unconditionally");
    assert.match(page.text, /larger than one file can carry/i, "the page does not say the file will tell you when it is short");
  });
});

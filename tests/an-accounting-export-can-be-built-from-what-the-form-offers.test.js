"use strict";

// The page offered six exports. Three of them could be built.
//
// /business-builder/owner/accounting-exports carried a select with six options
// -- bills, sales, inventory, payroll_summary, journal_entries, other -- and the
// download route in routes/sonara-last9-routes.cjs knew how to read three
// tables. A business owner could ask for a payroll summary, see the row appear
// on the page exactly like the ones that work, and find out only on pressing
// Download that no such file exists.
//
// The refusal was well written. That was the problem: it was a clear apology
// arriving after the choice had already been offered and made. Offering a job
// nothing can do is the defect.
//
// Both sides now read lib/sonara-accounting-export-sources.cjs. That makes the
// two lists one list, which is the fix -- and makes a test that compares them a
// tautology, so this file does not compare them. It walks the rendered page and
// the live route instead: what a customer can pick, and what the server will
// then build. Two independent observations of the same promise.

const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");
const {
  ACCOUNTING_EXPORT_SOURCES,
  ACCOUNTING_EXPORT_TYPES,
  REFUSED_EXPORT_TYPES,
  MONEY_COLUMNS,
  exportSourceFor
} = require("../lib/sonara-accounting-export-sources.cjs");
const { ALL_OWNER_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const PAGE_PATH = "/business-builder/owner/accounting-exports";

describe("an accounting export can be built from what the form offers", () => {
  it("has a source table that is not empty", () => {
    // Every assertion below is satisfied by an empty source map: the form would
    // offer nothing and nothing would be unbuildable. That is a passing check
    // over a broken product, so the population is asserted first.
    assert.ok(
      ACCOUNTING_EXPORT_TYPES.length >= 3,
      `only ${ACCOUNTING_EXPORT_TYPES.length} export types are declared; this check has gone blind`
    );
    for (const type of ACCOUNTING_EXPORT_TYPES) {
      const source = ACCOUNTING_EXPORT_SOURCES[type];
      assert.ok(source.table, `${type} names no table`);
      assert.ok(source.dateColumn, `${type} names no date column to bound a period by`);
      assert.ok(source.columns.length > 1, `${type} would export a single column`);
    }
  });

  it("reads tables that exist, with columns those tables have", () => {
    // A source naming a column PostgREST does not recognise fails the whole
    // request, so the file an accountant asked for never arrives -- and the
    // page would report the export as asked-for regardless.
    for (const type of ACCOUNTING_EXPORT_TYPES) {
      const source = ACCOUNTING_EXPORT_SOURCES[type];
      const columns = tableColumns(source.table);
      assert.ok(columns, `${type} exports from ${source.table}, which no migration creates`);
      const missing = source.columns.filter((column) => !columns.has(column));
      assert.deepEqual(missing, [], `${source.table} has no ${missing.join(", ")} for the ${type} export`);
      assert.ok(
        columns.has(source.dateColumn),
        `${source.table} has no ${source.dateColumn}, so a period cannot bound the ${type} export`
      );
    }
  });

  it("puts the figures in the file", () => {
    // The whole point of the file. buildRecordCsv writes a blank cell for a
    // header the row does not carry, so a column list that names the wrong
    // money column produces a file that opens, has the right number of rows,
    // and has no amounts in it. That is what the first draft of the source
    // table did: "amount" on every bills line, empty every time, and
    // total_cents nowhere.
    const types = Object.keys(MONEY_COLUMNS);
    assert.deepEqual(
      types.sort(),
      [...ACCOUNTING_EXPORT_TYPES].sort(),
      "every export type needs its figures named, and only real types may be named"
    );
    for (const [type, wanted] of Object.entries(MONEY_COLUMNS)) {
      assert.ok(wanted.length > 0, `${type} names no column carrying its figures`);
      const source = ACCOUNTING_EXPORT_SOURCES[type];
      const absent = wanted.filter((column) => !source.columns.includes(column));
      assert.deepEqual(absent, [], `the ${type} export would not carry ${absent.join(", ")}`);
    }
  });

  it("offers exactly the types a file can be built for, on the page a customer reads", async () => {
    const response = await request(app).get(PAGE_PATH).set("Accept", "text/html");
    // Signed out, the page redirects. The form is what is being read here, so
    // the declaration is rendered directly rather than faking a session -- but
    // the route must still exist and guard, or there is no page to talk about.
    assert.equal(response.status, 303, `${PAGE_PATH} should send an anonymous visitor to sign in`);
    assert.match(response.headers.location, /login/, `${PAGE_PATH} should redirect to a login page`);

    const page = ALL_OWNER_PAGES.find((candidate) => candidate.path === PAGE_PATH);
    assert.ok(page, `${PAGE_PATH} is not among the owner record pages`);
    const field = page.form.fields.find((candidate) => candidate.name === "export_type");
    assert.ok(field, "the form does not ask what to export");

    const offered = [...field.options];
    assert.ok(offered.length > 0, "the form offers no export type at all");
    const unbuildable = offered.filter((type) => !exportSourceFor(type));
    assert.deepEqual(
      unbuildable,
      [],
      `the form offers ${unbuildable.join(", ")}, which the download route cannot build a file for`
    );
  });

  it("says why a type that is not offered is not offered", () => {
    // A row created before the form was narrowed still carries one of these.
    // The download route answers 422 and quotes this sentence, so an owner
    // finds out what happened rather than being told "not supported".
    for (const [type, reason] of Object.entries(REFUSED_EXPORT_TYPES)) {
      assert.equal(exportSourceFor(type), null, `${type} is refused and buildable at the same time`);
      assert.ok(reason.length > 30, `${type} is refused without a reason worth reading`);
      assert.doesNotMatch(reason, /not supported|unsupported/i, `${type}'s reason says nothing an owner can act on`);
    }
    // The three that were on the form are each accounted for by name. Without
    // this the map could be emptied and the loop above would pass over nothing.
    for (const type of ["payroll_summary", "journal_entries", "other"]) {
      assert.ok(REFUSED_EXPORT_TYPES[type], `${type} was offered by the form and is now refused without explanation`);
    }
  });

  it("refuses an export reference that is not one of ours before reading anything", async () => {
    const response = await request(app)
      .get(`${PAGE_PATH}/not-a-uuid/download`)
      .set("Accept", "text/plain");
    // Anonymous, so the manager guard answers first. What matters is that the
    // download route is registered and guarded rather than open.
    assert.notEqual(response.status, 200, "an anonymous visitor was handed an accounting export");
  });
});

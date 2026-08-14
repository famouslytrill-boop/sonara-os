"use strict";

// A list view asks for the fields it renders, and it has to ask for all of them.
//
// The owner record pages read `select=*`: across 22 pages that fetched 307
// columns to render 112, on every page load, for every row. Narrowing it is the
// obvious win and the dangerous one -- a select missing a field does not error,
// it renders an empty cell, and an empty cell in a business record reads as
// "this customer has no phone number" rather than as a bug.
//
// Two ways that goes wrong, and this file checks both:
//
//   a field the page reads and the select omits  -> a silently blank cell
//   a field the select names and the table lacks -> PostgREST rejects the whole
//                                                   query and the page reports
//                                                   "not set up yet"
//
// The selects were produced by running each column function against a recording
// proxy and unioning that with the properties read off the parameter in the
// function source. Both were needed: the runtime probe alone missed
// `customer_id` on quotes, because the refusal rule returns early on any status
// that is not "accepted" and never reaches the line that reads it.
//
// This file deliberately does not repeat that derivation. A check that rebuilds
// the list the same way the list was built agrees with itself by construction --
// the exact defect found in the tenant-tables generator, which was verified by
// re-running itself. So the property is checked instead: give a column function
// a row containing only what the select asked for, and see whether it reaches
// for anything else.

const assert = require("node:assert/strict");
const { ALL_OWNER_PAGES, CREATOR_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

// A branch only touches the fields on the path its input takes, so one probe
// value proves very little. These drive the status comparisons the refusal
// rules turn on, which is where the early returns are.
const PROBES = ["x", "", 0, 1, null, undefined, true, false, "accepted", "won", "sent", "draft", "2026-01-01T00:00:00Z"];

// Runs `fn` against a row that has only `allowed`, and reports what it wanted
// that was not there.
function fieldsReachedOutside(fn, allowed) {
  const missing = new Set();
  for (const value of PROBES) {
    const row = new Proxy({}, {
      get(_target, key) {
        if (typeof key !== "string") return undefined;
        if (!allowed.has(key)) missing.add(key);
        return value;
      },
      has() { return true; }
    });
    try {
      fn(row);
    } catch {
      // A column that throws on a nonsense row is a separate concern, and
      // row-actions-are-pressable.test.js already holds that line. What matters
      // here is which fields it asked for before it threw, and the proxy has
      // already recorded those.
    }
  }
  return [...missing];
}

// Every table this renderer lists, not only the owner pages. The creator pages
// share the renderer, and each of their `also` blocks is a second table listed
// on the same page by the same code -- so leaving either out would let a select
// go unchecked while this file read as though it covered the renderer.
const LISTED = [
  ...ALL_OWNER_PAGES.map((page) => ({ label: page.path, table: page.table, columns: page.columns, rowAction: page.rowAction, select: page.select })),
  ...CREATOR_RECORD_PAGES.flatMap((page) => [
    { label: page.path, table: page.table, columns: page.columns, rowAction: page.rowAction, select: page.select },
    ...(page.also || []).map((side) => ({ label: `${page.path} (${side.table})`, table: side.table, columns: side.columns, rowAction: side.rowAction, select: side.select }))
  ])
];

const withSelect = LISTED.filter((page) => page.select && page.select !== "*");

describe("a record list asks for every field it renders", () => {
  it("has narrowed selects to check", () => {
    assert.ok(
      withSelect.length >= 20,
      `only ${withSelect.length} lists declare a narrowed select; this check has gone blind`
    );
  });

  it("declares a select on every list the renderer draws", () => {
    // A list without one still works -- it falls back to `*` -- so this cannot
    // be discovered by using the product. It has to be asserted.
    const wide = LISTED.filter((page) => !page.select || page.select === "*").map((page) => page.label);
    assert.deepEqual(wide, [], `these lists still fetch every column: ${wide.join(", ")}`);
  });

  it("is looking at both collections that use this renderer", () => {
    assert.ok(ALL_OWNER_PAGES.length > 0 && CREATOR_RECORD_PAGES.length > 0, "a collection is empty; this check has gone blind");
    assert.ok(
      LISTED.length > ALL_OWNER_PAGES.length,
      "LISTED has not picked up the creator pages or their side tables"
    );
  });

  for (const page of withSelect) {
    const allowed = new Set(page.select.split(",").map((field) => field.trim()).filter(Boolean));

    it(`${page.label} selects every field its columns read`, () => {
      const missing = new Set();
      for (const column of page.columns) {
        for (const field of fieldsReachedOutside(column.value, allowed)) missing.add(field);
      }
      if (page.rowAction?.reasonUnavailable) {
        // The refusal rule decides whether a row gets a button. A field it
        // reads and the select omits does not blank a cell -- it silently
        // changes the answer, which is worse.
        const rule = (row) => page.rowAction.reasonUnavailable(row, { customers: [] });
        for (const field of fieldsReachedOutside(rule, allowed)) missing.add(field);
      }
      assert.deepEqual(
        [...missing].sort(),
        [],
        `${page.label} renders fields its select does not ask for, so those cells come out blank: ${[...missing].join(", ")}`
      );
    });

    it(`${page.label} selects only fields ${page.table} has`, () => {
      // PostgREST rejects a select naming an unknown column, and it rejects the
      // whole query -- one typo empties the page and reports it as an account
      // that has not been set up.
      const columns = tableColumns(page.table);
      assert.ok(columns && columns.size > 0, `no columns parsed for ${page.table}; this check cannot look`);
      const unknown = [...allowed].filter((field) => !columns.has(field));
      assert.deepEqual(
        unknown,
        [],
        `${page.label} selects columns ${page.table} does not have, which fails the whole query: ${unknown.join(", ")}`
      );
    });

    it(`${page.label} selects id, which the detail link needs`, () => {
      assert.ok(allowed.has("id"), `${page.label} omits id, so every row's Open link points at nothing`);
    });
  }
});

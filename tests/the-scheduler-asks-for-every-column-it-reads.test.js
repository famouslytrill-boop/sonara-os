"use strict";

// The schedule tick is the one read in this application that deliberately
// crosses tenants: a scheduler has to see every organisation's due work, and
// `buildTenantQuery` makes it say so rather than letting it slip past unscoped.
// Every run underneath it is then scoped to the `organization_id` on the row.
//
// It used to ask for `select=*`. That is a query nothing can audit -- it does
// not name its columns, so `report-unused-selected-columns` counts it and moves
// on -- and it hides a failure with no symptom:
//
//   `isDue()` reads seven columns off the row. If one of them stops arriving,
//   nothing errors. `wholeNumber()` reports it as "not recorded", `isDue`
//   returns not-due, and the schedule is added to `skipped`. The tick answers
//   200 with `ran: []`. A customer's weekly job silently stops running and the
//   response says everything is fine.
//
// The columns are now named, which fixes the audit but creates the thing this
// file exists for: a hand-written list that has to keep matching two other
// files. So neither list here is hand-written. Both are derived from source --
// the columns `lib/sonara-agent-schedule.cjs` reads, and the columns the tick
// handler itself reads -- and the select has to cover their union.
//
// Derived rather than pasted, because a pasted list agrees with itself.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROUTES = path.join(__dirname, "..", "routes", "sonara-agent-activity-routes.cjs");
const SCHEDULE_MODULE = path.join(__dirname, "..", "lib", "sonara-agent-schedule.cjs");
const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20260813180000_agent_schedules.sql");

const routeSource = fs.readFileSync(ROUTES, "utf8");
const scheduleSource = fs.readFileSync(SCHEDULE_MODULE, "utf8");
const migrationSource = fs.readFileSync(MIGRATION, "utf8");

/**
 * Every `schedule.<column>` a file reads.
 *
 * Comments are stripped first, and the name must not be preceded by a hyphen.
 * Both are needed: the first draft of this matched `sonara-agent-schedule.cjs`
 * inside a comment and asserted that the query was missing a column called
 * `cjs`. A pattern loose enough to match prose reports a defect that is not
 * there, which wastes exactly the attention this file is asking for.
 */
function columnsReadIn(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  const found = new Set();
  for (const match of code.matchAll(/(?<![-\w.])schedule\.([a-z][a-z0-9_]*)\b/g)) found.add(match[1]);
  return found;
}

/**
 * The select list on the tick's own query, taken from the route source.
 *
 * Called inside each test rather than once at describe time. That is not
 * style: when the query goes back to `select=*` this finds nothing, and doing
 * it at describe time made the whole file error out before the test written
 * for exactly that case could run and name it. A check that cannot report the
 * bug it was written for is the shape this repository keeps finding.
 */
function selectList() {
  const match = routeSource.match(/select:\s*"([a-z0-9_,]+)"[^}]*?eq:\s*\{\s*enabled:\s*true\s*\}/s);
  assert.ok(match, "the tick's select could not be found; this test has gone blind and is asserting nothing");
  return match[1].split(",").map((name) => name.trim()).filter(Boolean);
}

describe("the scheduler asks for every column it reads", () => {
  it("does not ask for every column instead of naming them", () => {
    // The finding itself. `select: "*"` on this query is unauditable, and it is
    // the query that decides whether anybody's scheduled work runs.
    const tick = routeSource.slice(routeSource.indexOf("globalReason:"));
    assert.doesNotMatch(
      tick.slice(0, 1200),
      /select:\s*"\*"/,
      "the schedule tick is back to select=*; nothing can then say which columns it needs"
    );
  });

  describe("the column list", () => {
    it("is a plausible list rather than an empty one", () => {
      const selected = selectList();
      // Shape 1: a check satisfied by measuring nothing. An empty or two-column
      // select would make every assertion below trivially true.
      assert.ok(selected.length >= 10, `only ${selected.length} columns selected; this check has gone blind`);
      assert.equal(new Set(selected).size, selected.length, "a column is named twice");
    });

    it("carries the tenant column every run underneath is scoped to", () => {
      const selected = selectList();
      // The read crosses tenants on purpose; organization_id is what puts each
      // run back inside one. Without it every run would be scoped to undefined.
      assert.ok(selected.includes("organization_id"), "organization_id is not selected on the one read that crosses tenants");
    });

    it("covers every column isDue reads to decide whether a schedule fires", () => {
      const selected = selectList();
      const needed = columnsReadIn(scheduleSource);
      assert.ok(needed.size >= 5, `only ${needed.size} columns found in the schedule module; this check has gone blind`);
      for (const column of [...needed].sort()) {
        assert.ok(
          selected.includes(column),
          `isDue() reads schedule.${column} and the tick does not select it. It would arrive undefined, read as ` +
            "\"not recorded\", and the schedule would be reported as not due -- with a 200 and an empty ran list"
        );
      }
    });

    it("covers every column the tick handler itself reads", () => {
      const selected = selectList();
      const needed = columnsReadIn(routeSource);
      assert.ok(needed.size >= 4, `only ${needed.size} columns found in the route; this check has gone blind`);
      for (const column of [...needed].sort()) {
        assert.ok(selected.includes(column), `the tick reads schedule.${column} and does not select it`);
      }
    });

    it("names only columns the table actually has", () => {
      const selected = selectList();
      // The other direction. A column selected that does not exist makes
      // PostgREST answer 400, and the tick turns that into schedules_unreadable
      // -- every organisation's scheduled work stopping at once.
      const columns = new Set();
      const body = migrationSource.slice(migrationSource.indexOf("create table if not exists public.agent_schedules"));
      for (const line of body.split("\n")) {
        const match = line.match(/^\s{2}([a-z][a-z0-9_]*)\s+(uuid|text|jsonb|integer|boolean|timestamptz)\b/);
        if (match) columns.add(match[1]);
      }
      assert.ok(columns.size >= 12, `only ${columns.size} columns parsed from the migration; this check has gone blind`);
      for (const column of selected) {
        assert.ok(columns.has(column), `the tick selects ${column}, which agent_schedules does not have`);
      }
    });
  });
});

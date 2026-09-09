"use strict";

const assert = require("node:assert/strict");

const rollups = require("../lib/sonara-d1-rollups.cjs");
const d1 = require("../lib/sonara-d1-adapter.cjs");

// D1 has no row-level security. None: no policies, no roles, no auth.uid().
//
// In Supabase the service-role key bypasses RLS, so `organization_id` filtering
// is already the boundary that matters -- but RLS is still there, unused, as a
// second thing that would have to fail. In D1 there is no second thing. A
// statement that forgets the organization is a cross-tenant read with nothing
// behind it.
//
// So this asserts the boundary over every statement builder the module exports,
// found by reading its exports rather than by listing the ones somebody
// remembered. A builder added later is covered the day it is added.

const BUILDERS = Object.entries(rollups).filter(([name, value]) => typeof value === "function" && name.endsWith("Statement"));

const VALID_ARGUMENTS = {
  readDailyTotalsStatement: { organizationId: "org-1", from: "2026-09-01", to: "2026-09-09" },
  writeDailyTotalsStatement: { organizationId: "org-1", day: "2026-09-09", totals: { bookings_made: 3 }, sourceRows: 12, computedAt: "2026-09-09T00:00:00.000Z" },
  recordRunStatement: { organizationId: "org-1", rollupName: "daily_totals", windowStart: "2026-09-09", windowEnd: "2026-09-09", runStatus: "complete", at: "2026-09-09T00:00:00.000Z" },
  readRunsStatement: { organizationId: "org-1" }
};

describe("the rollups cannot read another organization", () => {
  it("found the statement builders, so this does not pass by checking nothing", () => {
    assert.ok(BUILDERS.length >= 4, `only ${BUILDERS.length} statement builders found; this check has gone blind`);
    for (const [name] of BUILDERS) {
      assert.ok(VALID_ARGUMENTS[name], `${name} is exported but has no arguments here, so it is untested`);
    }
  });

  for (const [name, build] of BUILDERS) {
    describe(name, () => {
      it("puts organization_id in the statement", () => {
        const built = build(VALID_ARGUMENTS[name]);
        assert.equal(built.ok, true, built.detail);
        assert.match(built.sql, /organization_id/, "the statement does not mention organization_id at all");
        assert.ok(built.params.includes("org-1"), "the organization id is not among the bound parameters");
      });

      it("refuses a missing organization rather than reading across all of them", () => {
        for (const bad of [undefined, null, "", "   ", 7, {}]) {
          const built = build({ ...VALID_ARGUMENTS[name], organizationId: bad });
          assert.equal(built.ok, false, `organizationId ${JSON.stringify(bad)} was accepted`);
          assert.match(built.detail, /organization id/i);
        }
      });

      it("binds its values as parameters rather than pasting them into the SQL", () => {
        const built = build(VALID_ARGUMENTS[name]);
        assert.doesNotMatch(built.sql, /'org-1'/, "the organization id was concatenated into the statement");
        assert.doesNotMatch(built.sql, /org-1/, "the organization id appears in the statement text");
      });

      it("produces SQL the D1 adapter will actually accept", () => {
        // The adapter refuses comments, multiple statements, and any identifier
        // naming a table Supabase owns. A builder that produces SQL the adapter
        // rejects is a builder nothing can call, and without this the two
        // modules would agree only by coincidence.
        const built = build(VALID_ARGUMENTS[name]);
        const violation = d1.derivedOnlyViolation(built.sql);
        assert.equal(violation, "", `the adapter would refuse this statement: ${violation}`);
      });
    });
  }

  describe("the schema itself", () => {
    it("introduces no identifier that collides with a table Supabase owns", () => {
      // `bookings` is a Supabase table, which is why the column is
      // `bookings_made`. Checked against the real set rather than a memory of it.
      assert.deepEqual(rollups.collidingIdentifiers(), []);
    });

    it("checks a populated reserved list, or the assertion above is vacuous", () => {
      const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");
      const total = TENANT_SCOPED_TABLES.size + GLOBAL_TABLES.size;
      assert.ok(total > 200, `only ${total} reserved table names; the collision check has gone blind`);
      assert.ok(rollups.declaredIdentifiers().length >= 15, "the identifier list is too short to be the whole schema");
    });

    it("would catch a collision if one were introduced", () => {
      // The motivating bug, reproduced: a column named after a Supabase table.
      const { TENANT_SCOPED_TABLES } = require("../lib/sonara-tenant-scoped-tables.cjs");
      const aRealTable = [...TENANT_SCOPED_TABLES][0];
      assert.ok(aRealTable, "no tenant-scoped tables to build the probe from");
      const RESERVED = new Set([...TENANT_SCOPED_TABLES].map((n) => String(n).toLowerCase()));
      assert.equal(RESERVED.has(String(aRealTable).toLowerCase()), true);
      assert.equal([...rollups.declaredIdentifiers(), aRealTable].filter((n) => RESERVED.has(String(n).toLowerCase())).length, 1);
    });

    it("is every statement acceptable to the adapter, DDL included", () => {
      assert.ok(rollups.SCHEMA_STATEMENTS.length >= 4, "the schema is too short to be the whole thing");
      for (const statement of rollups.SCHEMA_STATEMENTS) {
        assert.equal(d1.derivedOnlyViolation(statement), "", `the adapter would refuse: ${statement.slice(0, 60)}`);
      }
    });

    it("stores money as whole cents, never as a floating-point column", () => {
      const schema = rollups.SCHEMA_STATEMENTS.join("\n");
      assert.match(schema, /invoiced_cents INTEGER/);
      assert.match(schema, /paid_cents INTEGER/);
      assert.doesNotMatch(schema, /\bREAL\b/, "SQLite REAL is a double, and a double cannot hold 0.1");
    });

    it("requires a row count on every total, so a zero can be told from an unrun rollup", () => {
      assert.match(rollups.SCHEMA_STATEMENTS.join("\n"), /source_rows INTEGER NOT NULL/);
      const built = rollups.writeDailyTotalsStatement({ organizationId: "org-1", day: "2026-09-09", totals: {}, sourceRows: undefined });
      assert.equal(built.ok, false);
      assert.match(built.detail, /sourceRows/);
    });
  });

  describe("a run has three states, and absence is the fourth", () => {
    it("accepts only the three declared statuses", () => {
      assert.deepEqual([...rollups.RUN_STATUSES], ["running", "complete", "failed"]);
      const built = rollups.recordRunStatement({ ...VALID_ARGUMENTS.recordRunStatement, runStatus: "ok" });
      assert.equal(built.ok, false);
      assert.match(built.detail, /never ran/);
    });

    it("leaves finished_at empty while a run is still going", () => {
      const running = rollups.recordRunStatement({ ...VALID_ARGUMENTS.recordRunStatement, runStatus: "running" });
      assert.equal(running.params[rollups.RUN_COLUMNS.indexOf("finished_at")], null);
      const complete = rollups.recordRunStatement({ ...VALID_ARGUMENTS.recordRunStatement, runStatus: "complete" });
      assert.notEqual(complete.params[rollups.RUN_COLUMNS.indexOf("finished_at")], null);
    });
  });

  describe("input that would corrupt a total is refused rather than rounded", () => {
    it("refuses a float where cents are expected", () => {
      const built = rollups.writeDailyTotalsStatement({
        organizationId: "org-1",
        day: "2026-09-09",
        totals: { paid_cents: 10.5 },
        sourceRows: 1
      });
      assert.equal(built.ok, false);
      assert.match(built.detail, /paid_cents/);
    });

    it("refuses a negative count", () => {
      const built = rollups.writeDailyTotalsStatement({
        organizationId: "org-1",
        day: "2026-09-09",
        totals: { bookings_made: -1 },
        sourceRows: 1
      });
      assert.equal(built.ok, false);
    });

    it("refuses a day that is not a day", () => {
      for (const day of ["2026-9-9", "yesterday", "2026-09-09T00:00:00Z", ""]) {
        assert.equal(rollups.writeDailyTotalsStatement({ organizationId: "org-1", day, totals: {}, sourceRows: 1 }).ok, false, `${day} was accepted`);
      }
    });

    it("bounds the number of rows a read can ask for", () => {
      assert.match(rollups.readDailyTotalsStatement({ organizationId: "org-1", limit: 100000 }).sql, /LIMIT 366$/);
      assert.match(rollups.readRunsStatement({ organizationId: "org-1", limit: 100000 }).sql, /LIMIT 200$/);
    });

    it("falls back to the default on a limit that is not one, rather than clamping to a single row", () => {
      // The first version clamped a negative limit to 1: the value survived the
      // `||` because it is truthy, and Math.max(-5, 1) is 1. A caller asking
      // badly got one row and no indication that it was not the whole answer.
      for (const limit of [-5, 0, 0.5, NaN, "many", null, undefined]) {
        assert.match(
          rollups.readDailyTotalsStatement({ organizationId: "org-1", limit }).sql,
          /LIMIT 90$/,
          `limit ${JSON.stringify(limit)} did not fall back to the default`
        );
        assert.match(rollups.readRunsStatement({ organizationId: "org-1", limit }).sql, /LIMIT 20$/);
      }
    });
  });
});

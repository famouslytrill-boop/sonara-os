"use strict";

// The unused-table classification, checked rather than trusted.
//
// docs/WORKSPACE_WORKFLOW_AUDIT.md reported 206 unused tables of 300 and said
// removing them needed owner approval. The number could not be reproduced, and
// that is the point worth keeping: "named anywhere in the application source"
// gives 0 if docs/ counts (the audit lists every orphan by name), 0 again if the
// generated inventories count (they name every table by construction), and 90 if
// neither does.
//
// scripts/report-orphan-tables.mjs recomputes it on every run so no stored
// number can drift from the schema. This file checks the classification the
// script reads: that every entry is a real table, that every decision means
// something, and that a superseded entry names what replaced it.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { ORPHAN_TABLES, ORPHAN_DISPOSITIONS, tablesWithDecision } = require("../lib/sonara-orphan-tables.cjs");
const { tableColumns } = require("../lib/sonara-migration-columns.cjs");

const DECISIONS = new Set(["retire", "keep", "build", "build-with-parent", "defer", "await direction"]);

describe("the tables nothing queries", () => {
  it("lists enough to be describing the problem", () => {
    assert.ok(ORPHAN_TABLES.length >= 50, `only ${ORPHAN_TABLES.length} classified; this check has gone blind`);
  });

  it("names only tables the migrations actually create", () => {
    // A classification entry for a table that does not exist is a decision
    // about nothing, and it would keep the gate green while the real table went
    // unclassified.
    const missing = ORPHAN_TABLES.filter((table) => !tableColumns(table));
    assert.deepEqual(missing, [], `these are classified but no migration creates them:\n  ${missing.join("\n  ")}`);
  });

  it("records a real decision for every one", () => {
    const bad = ORPHAN_TABLES
      .filter((table) => !DECISIONS.has(ORPHAN_DISPOSITIONS[table].decision))
      .map((table) => `${table}: ${ORPHAN_DISPOSITIONS[table].decision}`);
    assert.deepEqual(bad, [], `these carry a decision that is not one of ${[...DECISIONS].join(", ")}:\n  ${bad.join("\n  ")}`);
  });

  it("says what replaced anything marked for retirement", () => {
    // "retire" is the only decision that ends in deleting data. A retirement
    // with no named successor is the claim that nothing was lost, with nothing
    // behind it -- and it is the one entry somebody might act on directly.
    const unexplained = tablesWithDecision("retire").filter((table) => {
      const successor = ORPHAN_DISPOSITIONS[table].supersededBy;
      return !successor || String(successor).trim().length < 3;
    });
    assert.deepEqual(unexplained, [], `these are marked for retirement without naming what replaced them:\n  ${unexplained.join("\n  ")}`);
  });

  it("points retirements at something that exists", () => {
    // A successor naming a table no migration creates would send somebody
    // looking for their data in a place that is not there.
    const wrong = [];
    for (const table of tablesWithDecision("retire")) {
      const successor = String(ORPHAN_DISPOSITIONS[table].supersededBy);
      // Some successors are a file rather than a table -- open_source_tools was
      // replaced by data/open-source-tools.ts, not by another table.
      if (successor.includes("/") || successor.includes(".")) continue;
      if (!tableColumns(successor)) wrong.push(`${table} -> ${successor}, which no migration creates`);
    }
    assert.deepEqual(wrong, [], wrong.join("\n  "));
  });

  it("explains anything it is choosing not to act on", () => {
    // keep, defer and await-direction are all "no action", and without a reason
    // they are indistinguishable from having forgotten about it.
    const silent = ORPHAN_TABLES
      .filter((table) => ["keep", "defer", "await direction"].includes(ORPHAN_DISPOSITIONS[table].decision))
      .filter((table) => !String(ORPHAN_DISPOSITIONS[table].note || "").trim());
    assert.deepEqual(silent, [], `these record no action and no reason:\n  ${silent.join("\n  ")}`);
  });

  it("agrees with what the schema and the code actually say right now", function () {
    this.timeout(60000);
    // The gate itself. It fails when a table is created and never queried
    // without a classification, and when a classified table starts being
    // queried -- which is what happened to purchase_orders,
    // inventory_count_sessions and location_transfers when they got workspaces.
    const script = path.join(__dirname, "..", "scripts", "report-orphan-tables.mjs");
    const output = execFileSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    assert.match(output, /Orphan table check passed/, output);
  });
});

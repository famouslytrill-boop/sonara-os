"use strict";

// "No duplicate tables" was asked for on 1 October 2026, and `employee_shifts`
// was found duplicating `employee_schedules` the same day -- by reading the
// migrations while looking for something else. Nothing would have found the next
// one, and 345 tables is more than anybody holds in their head.
//
// scripts/report-duplicate-tables.mjs is that check. This file is the part that
// stops it becoming a green light over the problem.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "report-duplicate-tables.mjs");
const { DUPLICATE_TABLE_REVIEWS } = require("../lib/sonara-duplicate-table-review.cjs");

function run(args = []) {
  try {
    return { ok: true, output: execFileSync("node", [script, ...args], { cwd: root, encoding: "utf8" }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

describe("a second copy of a table is found by a check", () => {
  const result = run(["--check"]);

  it("passes against the schema as it stands", () => {
    assert.equal(result.ok, true, `the duplicate-table check failed:\n${result.output}`);
  });

  // The shape this repository keeps finding: a check satisfied by an empty
  // population. If it compared nothing it would pass forever.
  it("says how much of the schema it compared, and it is most of it", () => {
    const tables = Number((result.output.match(/report: (\d+) tables/) || [])[1]);
    const compared = Number((result.output.match(/(\d+) with at least \d+ distinctive columns/) || [])[1]);
    assert.ok(tables >= 300, `only ${tables} tables parsed; the check has gone blind`);
    assert.ok(compared >= 200, `only ${compared} of ${tables} tables were compared`);
    assert.ok(compared / tables > 0.6, `only ${Math.round((compared / tables) * 100)}% of tables were compared`);
  });

  // A threshold is only meaningful if something sits below it. If the
  // highest-scoring ignored pair were also at the threshold, the line would be
  // arbitrary and the next real duplicate could sit just under it.
  it("reports the gap between what it flags and what it ignores", () => {
    const match = result.output.match(/Highest overlap below the threshold: (\S+) \+ (\S+) at ([0-9.]+)/);
    assert.ok(match, `the report does not state the runner-up:\n${result.output}`);
    const runnerUp = Number(match[3]);
    assert.ok(runnerUp < 0.8, `the highest ignored pair scores ${runnerUp}, at the threshold`);
    assert.ok(runnerUp <= 0.75, `the gap below the threshold has closed to ${runnerUp}; re-measure before trusting the line`);
  });

  it("finds the pair it was written for", () => {
    assert.match(result.output, /employee_schedules \+ employee_shifts/, "the known duplicate is no longer reported");
  });

  describe("the register", () => {
    it("accounts for every pair the check reports, and nothing else", () => {
      const reported = [...result.output.matchAll(/^ {2}[0-9.]+ {2}(\S+) \+ (\S+)/gm)]
        .map(([, a, b]) => [a, b].sort().join(" + ")).sort();
      const reviewed = DUPLICATE_TABLE_REVIEWS.map((entry) => [...entry.tables].sort().join(" + ")).sort();
      assert.ok(reported.length > 0, "nothing was reported; this check has gone blind");
      assert.deepEqual(reviewed, reported, "the register and the report disagree about which pairs exist");
    });

    it("gives every entry a verdict and a reason that names evidence", () => {
      for (const entry of DUPLICATE_TABLE_REVIEWS) {
        assert.equal(entry.tables.length, 2, `${entry.tables.join(" + ")} is not a pair`);
        assert.ok(["duplicate_awaiting_owner_decision", "parallel_by_design"].includes(entry.verdict),
          `${entry.tables.join(" + ")} has an unrecognised verdict: ${entry.verdict}`);
        assert.ok(entry.reason.length > 120, `${entry.tables.join(" + ")} has a reason too short to be a reason`);
        // A reason that cites nothing is one the next reader believes instead of
        // checking. Each must name a column, a table, a route or a file.
        assert.match(entry.reason, /[a-z_]+\.(cjs|sql|md)|\/[a-z-]+\/|[a-z]+_[a-z_]+/,
          `${entry.tables.join(" + ")} gives a reason that names no evidence`);
      }
    });

    // Retiring a table is destructive, so a duplicate can legitimately sit here
    // waiting. What it must not do is sit here looking resolved.
    it("does not describe an unresolved duplicate as a decision already taken", () => {
      const waiting = DUPLICATE_TABLE_REVIEWS.filter((entry) => entry.verdict === "duplicate_awaiting_owner_decision");
      assert.ok(waiting.length > 0, "nothing is recorded as awaiting a decision; employee_shifts was");
      for (const entry of waiting) {
        assert.match(entry.reason, /owner|destructive/i,
          `${entry.tables.join(" + ")} is awaiting a decision and does not say whose`);
      }
    });
  });

  it("is in the release chain rather than only on disk", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(typeof packageJson.scripts["verify:duplicate-tables"], "string");
    assert.match(packageJson.scripts["verify:gates"], /verify:duplicate-tables/,
      "the check exists and the release chain does not run it");
  });
});

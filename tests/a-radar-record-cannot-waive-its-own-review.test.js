"use strict";

// An external repository on the GitHub radar cannot waive its own review.
//
// `data/github-radar-repos.ts` gives every record four review flags -- owner,
// legal, security, privacy -- and an `autoInstall` field. AGENTS.md is the reason
// they exist: screenshot-sourced and radar records stay non-executing until a
// separate implementation review promotes them, and outside package managers and
// agent frameworks do not replace SONARA's contracts without an explicit
// architecture decision.
//
// Measured 30 September 2026, and this is the part worth keeping:
//
//   * the four flags are declared `boolean` in the type, so `false` compiles;
//   * all fifteen records set all four to `true` -- by convention;
//   * four scripts read this file and **nothing ran any of them**;
//   * the one that checked `autoInstall` asked whether the whole FILE contained
//     the string `autoInstall: false`, once, so fourteen records could have said
//     `true` and it would still have passed.
//
// Proven rather than argued. With `ownerReviewRequired: false` planted in the
// first record, `node scripts/check-github-radar.mjs` printed "GitHub Radar check
// passed." and exited 0, and `pnpm run verify:ts-contracts` was clean too. The
// guarantee was enforced by nothing at all.
//
// scripts/verify-github-radar-review-flags.mjs replaces those four. This file
// holds what that gate cannot hold for itself: that it runs in the release chain,
// and that it reads every record rather than the file as one string.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const GATE = "scripts/verify-github-radar-review-flags.mjs";
const DATA = "data/github-radar-repos.ts";
const COMMAND = "verify:radar-review-flags";
const REVIEW_FLAGS = ["ownerReviewRequired", "legalReviewRequired", "securityReviewRequired", "privacyReviewRequired"];

function records() {
  const source = fs.readFileSync(path.join(root, DATA), "utf8");
  const start = source.indexOf("githubRadarRepos: GitHubRadarRepo[] = [");
  assert.notEqual(start, -1, `${DATA} has no githubRadarRepos array; the record split has nothing to read`);
  return source.slice(start).split(/\n  \{/).slice(1);
}

describe("a radar record cannot waive its own review", () => {
  it("has records to check", () => {
    const found = records();
    assert.ok(found.length >= 10, `only ${found.length} radar records parsed; the split has gone blind`);
  });

  // The property itself, asserted here as well as in the gate, because this is the
  // safety rule and one of the two should not be the only place it lives.
  it("requires all four reviews on every record", () => {
    const offenders = [];
    for (const record of records()) {
      const name = /name: "([^"]+)"/.exec(record)?.[1] ?? "(unnamed)";
      for (const flag of REVIEW_FLAGS) {
        if (!new RegExp(`${flag}:\\s*true`).test(record)) offenders.push(`${name}: ${flag}`);
      }
      if (!/autoInstall:\s*false/.test(record)) offenders.push(`${name}: autoInstall`);
    }
    assert.deepEqual(offenders, [], `${offenders.length} radar field(s) waive a review: ${offenders.join(", ")}`);
  });

  // The literal type is the only thing TypeScript itself enforces on this file.
  // Widening it to `boolean` deletes that guarantee and breaks nothing visible.
  it("keeps autoInstall as a literal type", () => {
    const source = fs.readFileSync(path.join(root, DATA), "utf8");
    assert.match(
      source,
      /^\s*autoInstall:\s*false;\s*$/m,
      `${DATA} no longer declares autoInstall as the literal false, so autoInstall: true would compile`
    );
  });

  // The failure the four deleted scripts shared. A gate outside the chain is a
  // gate that has never run on anything anybody shipped.
  it("runs the gate from the release chain", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const { chainCommands } = require("../lib/sonara-release-chain.cjs");

    assert.ok(pkg.scripts[COMMAND], `package.json has no ${COMMAND} script`);
    assert.ok(fs.existsSync(path.join(root, GATE)), `${COMMAND} points at ${GATE}, which does not exist`);

    const chain = chainCommands(pkg.scripts);
    assert.ok(chain.length > 40, `only ${chain.length} chain commands read; the chain walk has gone blind`);
    assert.ok(
      chain.includes(COMMAND),
      `${COMMAND} is not reachable from verify:launch. Its four predecessors were reachable from nothing, which is ` +
        "why a record could have waived every review without one check noticing."
    );
  });

  // And it reads per record rather than per file. The count in its own summary is
  // the evidence: a gate that reported "1 record" would be the old file-wide
  // substring test wearing a new name.
  it("reports a record count, not a file verdict", () => {
    const output = execFileSync(process.execPath, [path.join(root, GATE)], { cwd: root, encoding: "utf8" });
    const counted = Number(/verified: (\d+) repository records/.exec(output)?.[1]);
    assert.ok(
      Number.isFinite(counted),
      `the gate's summary does not report how many records it read: ${output.trim()}`
    );
    assert.equal(
      counted,
      records().length,
      "the gate reports a different number of records from the one in the file, so one of the two splits is wrong"
    );
  });
});

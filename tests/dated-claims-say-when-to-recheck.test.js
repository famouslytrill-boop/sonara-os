"use strict";

// A claim that was true when it was written.
//
// This repository writes documents that check something about the world or the
// live system and then state what they found. Three of those went stale inside
// one working session:
//
//   lib/sonara-billing.cjs said the three retired Stripe plans were active
//   prices on archived products; checked against the live account, all three
//   read inactive on both.
//
//   The form-reachability list called two endpoints "JSON twins" of endpoints
//   that "have a form". Neither was, and two whole tables had no way in.
//
//   docs/SHIP_READINESS.md framed the legal position as a question about
//   engaging counsel, while the pages were placeholders headed "Section 1".
//
// None was careless. Each was an accurate observation the world moved past with
// nothing watching the gap. Pairing a claim with the date it should be looked at
// again is taken from rshankras/claude-code-apple-skills (MIT), where every
// skill file carries last_verified and review_by.
//
// What this file protects is the mechanism, not the dates: a check that stops
// finding documents reports success while watching nothing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chainCommands } = require("../lib/sonara-release-chain.cjs");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "report-stale-claims.mjs");

function run(args = []) {
  try {
    return { ok: true, output: execFileSync("node", [script, ...args], { cwd: root, encoding: "utf8" }) };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

describe("a document that checked something says when to check it again", () => {
  it("passes as the repository stands", () => {
    const { ok, output } = run(["--check"]);
    assert.ok(ok, `the stale-claim check fails on a clean tree:\n${output}`);
  });

  it("is actually finding the documents", () => {
    // The failure mode this whole family of checks exists for. If the marker
    // stops matching, every loop passes over an empty list and reports success.
    const { output } = run();
    const found = Number(output.match(/Documents making a dated claim: (\d+)/)?.[1] || 0);
    assert.ok(found >= 5, `only ${found} dated documents found; the marker is no longer matching`);
  });

  it("fails when a dated document does not say when to re-check it", () => {
    const probe = path.join(root, "docs", "stale-claim-probe.md");
    fs.writeFileSync(probe, "# Probe\n\nAudit date: 2026-01-01. This checked something and never says when to look again.\n");
    try {
      const { ok, output } = run(["--check"]);
      assert.equal(ok, false, "a dated document with no review date passed the check");
      assert.match(output, /stale-claim-probe/, "the check failed without naming the document");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("reports an overdue document loudly and does not fail the release for it", () => {
    // Deliberate. A missing review date is a structural omission somebody fixes
    // in a minute. A passed date needs a person to go and look at the world
    // again, and failing a release on a calendar would block an unrelated
    // deploy for something no code change caused.
    const probe = path.join(root, "docs", "overdue-claim-probe.md");
    fs.writeFileSync(probe, "# Probe\n\nReview by: 2020-01-01\n\nAudit date: 2019-01-01. Long past looking at again.\n");
    try {
      const { ok, output } = run(["--check"]);
      assert.equal(ok, true, "an overdue document failed the release; it should be reported, not fatal");
      assert.match(output, /Past their review date/);
      assert.match(output, /overdue-claim-probe/, "the overdue document is not named");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("runs in the release chain", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    // Chain membership is asked of lib/sonara-release-chain.cjs, not of the string.
    //
    // `verify:launch` used to be one flat line, so matching it for a command
    // name worked. Everything after `verify:db` now sits in `verify:gates` so
    // CI can run the whole gate in one step, and five checks reported commands
    // as missing from a chain that runs them -- accurate about the string,
    // wrong about the thing they named.
    assert.ok(chainCommands(packageJson.scripts || {}).includes("verify:stale-claims"), "the check is not in the release chain, so nothing runs it");
  });
});

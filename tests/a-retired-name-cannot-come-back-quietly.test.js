"use strict";

// The retired-names rule is enforced by something that runs.
//
// AGENTS.md: "Do not reintroduce retired public names in active UI, navigation,
// metadata, manifests, tests, or launch docs." For most of this repository's
// history the enforcement was scripts/check-no-legacy-public-copy.mjs, and two
// skills and an audit record said so in those words -- one of them "fails the
// release if one comes back".
//
// Measured 30 September 2026: no package.json script, no workflow and no test
// named it, and running it directly died with ENOENT on `app/`, a Next.js
// directory this Express repository does not have. Its root list also omitted
// routes/ and server.js, so even repaired it would never have read the runtime.
// A sentence in a skill stood in for a check that could not execute.
//
// scripts/verify-retired-public-names.mjs replaces it. This file holds the three
// properties that gate cannot hold for itself:
//
//   1. the ledger it reads is really there and really parses;
//   2. it keeps no copy of the names, so there is nothing in it to exempt from
//      its own rule;
//   3. it is reachable from the release chain, which is the specific thing its
//      predecessor was not.
//
// This file names no retired name. It is inside the population the gate scans,
// so spelling one here would make this test a finding -- which is the same
// reason the gate reads the ledger instead of holding a list.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const GATE = "scripts/verify-retired-public-names.mjs";
const LEDGER = "docs/archive/legacy-names.md";
const COMMAND = "verify:retired-names";

function ledgerNames() {
  const source = fs.readFileSync(path.join(root, LEDGER), "utf8");
  const block = /<!-- BEGIN RETIRED_PUBLIC_NAMES -->\s*```text\s*([\s\S]*?)```\s*<!-- END RETIRED_PUBLIC_NAMES -->/.exec(source);
  assert.ok(block, `${LEDGER} has no RETIRED_PUBLIC_NAMES block; the gate reads that block and would search for nothing`);
  return block[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

describe("a retired public name cannot come back quietly", () => {
  it("has a ledger the gate can read", () => {
    const names = ledgerNames();
    assert.ok(
      names.length >= 5,
      `only ${names.length} retired names in the ledger; the parse has gone blind and every file would read clean`
    );
    for (const name of names) {
      assert.ok(name.length >= 5, `a ledger entry of ${name.length} character(s) would match almost any file`);
    }
  });

  // The property that makes the gate safe to place inside its own population.
  // Its predecessor hard-coded the list, and the list had drifted: it blocked a
  // string the archive does not retire and which appears in a Dockerfile header,
  // a brand-asset filename and three claim-boundary sentences in lib/. Reading
  // the ledger means the gate cannot disagree with the archive, and means there
  // is no copy of the names anywhere a scan would have to skip.
  it("keeps no copy of the names it blocks", () => {
    const source = fs.readFileSync(path.join(root, GATE), "utf8");
    const spelled = ledgerNames().filter((name) => source.includes(name));
    assert.deepEqual(
      spelled,
      [],
      `${GATE} spells ${spelled.length} of the names it blocks, so it has to be exempted from its own rule: ${spelled.join(", ")}`
    );
  });

  // The failure this whole change is about. A gate that exists and runs nowhere
  // is worse than no gate, because three documents said it failed the release.
  it("is reachable from the release chain", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const { chainCommands } = require("../lib/sonara-release-chain.cjs");

    assert.ok(pkg.scripts[COMMAND], `package.json has no ${COMMAND} script, so nothing can run the gate`);
    // A substring test, not a regular expression. The first draft built one by
    // hand-escaping `/` and `.` in the path, which CodeQL flagged as an incomplete
    // escape -- correctly: it left `\` alone. The assertion only ever meant "the
    // command names this file", and escaping a path to ask that is a step that can
    // only be got wrong.
    assert.ok(
      pkg.scripts[COMMAND].includes(GATE),
      `${COMMAND} runs "${pkg.scripts[COMMAND]}", which does not name ${GATE}`
    );
    assert.ok(fs.existsSync(path.join(root, GATE)), `${COMMAND} points at ${GATE}, which does not exist`);

    const chain = chainCommands(pkg.scripts);
    assert.ok(chain.length > 40, `only ${chain.length} chain commands read; the chain walk has gone blind`);
    assert.ok(
      chain.includes(COMMAND),
      `${COMMAND} is not reachable from verify:launch. Its predecessor was reachable from nothing, which is why ` +
        "a retired name could have come back for months without a single check noticing."
    );
  });

  // Run it, and read the population out of its own summary rather than trusting
  // that the groups are there. A group that silently becomes zero is shape 1:
  // the gate would still pass, having read less than it says.
  it("reads every population it claims to read", () => {
    const output = execFileSync(process.execPath, [path.join(root, GATE)], { cwd: root, encoding: "utf8" });
    const groups = { runtime: 250, public: 40, android: 1, data: 5, tests: 200, docs: 300 };
    for (const [group, floor] of Object.entries(groups)) {
      const match = new RegExp(`(\\d+) ${group}\\b`).exec(output);
      assert.ok(match, `the gate's summary does not report a count for ${group}: ${output.trim()}`);
      assert.ok(
        Number(match[1]) >= floor,
        `the gate scanned ${match[1]} ${group} file(s), below the floor of ${floor}; that group has gone blind`
      );
    }
  });
});

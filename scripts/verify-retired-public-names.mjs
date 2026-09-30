#!/usr/bin/env node
"use strict";

// A retired public name has not come back.
//
// AGENTS.md states the rule plainly: "Do not reintroduce retired public names in
// active UI, navigation, metadata, manifests, tests, or launch docs. If
// historical context is required, keep it in docs/archive/legacy-names.md."
//
// ## What this replaces, and why it is a replacement rather than an addition
//
// `scripts/check-no-legacy-public-copy.mjs` was the enforcement. Three documents
// said so -- `.claude/skills/writing-sonara-marketing-copy/SKILL.md` said it
// "fails the release if one comes back", the social-post skill said it "fails the
// build", and an audit record described its patterns. None of that was true any
// more, in two separate ways, both measured on 30 September 2026:
//
//   1. **Nothing ran it.** No package.json script, no workflow and no test named
//      it. `scripts/verify-all.mjs` did, and nothing runs that either -- and 24
//      of the 34 pnpm scripts it lists no longer exist, so it fails on its second
//      command. `pnpm run verify:all` maps to `verify:launch`, which does not
//      include it, so the obvious command silently ran something else.
//   2. **It could not run.** Its first scan root was `app/`, a Next.js directory
//      this Express repository does not have, so `node scripts/check-no-legacy-public-copy.mjs`
//      died with ENOENT before reading a single file. Its root list also omitted
//      `routes/` and `server.js` entirely, so even repaired it would never have
//      scanned the runtime it was said to protect.
//
// That is this repository's recurring defect in its worst form: not a check that
// reports a false pass, but a sentence in a skill that a person writing customer
// copy reads and believes, standing in for a check that cannot execute.
//
// ## The names are data, not a copy
//
// The old scanner hard-coded its blocked list. This reads the ledger in
// docs/archive/legacy-names.md, which AGENTS.md already names as the one place
// historical context lives. A name added to the archive is enforced without
// anybody remembering there is a scanner, and the scanner cannot disagree with
// the archive about what is retired.
//
// The hard-coded list had drifted, which is the argument for this: it blocked
// "SONARA OS", a string the archive does not retire and which appears in a
// Dockerfile header, a brand-asset filename, three claim-boundary strings in
// lib/, and the name of three archived billing plans. None of those is active
// public copy. Enforcing that list would have produced five findings that are
// not violations, which is how a check gets switched off.
//
// ## Why this file does not quote the names it blocks
//
// It scans tests/ and docs/, and it would scan itself if it were either. A
// scanner that spells its own patterns is a file that has to be exempted from
// its own rule, and an exemption is the thing that later gets widened. Reading
// the ledger means there is nothing here to exempt.
//
// ## Two-sided, in three directions
//
// Recorded history is not a violation: four dated audit records describe the
// rename itself and naming the old names is the point of them. So:
//
//   1. A file that contains a retired name and is not registered fails.
//   2. A registered file that no longer contains one fails -- the entry now
//      describes nothing, and a wrong reason inside an exemption is what the next
//      person reads instead of checking (shape 5).
//   3. A registered file that does not exist fails.
//
// Falsified before being trusted: see
// tests/a-retired-name-cannot-come-back-quietly.test.js.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { runtimeSourceFiles, blindnessReason } = require("../lib/sonara-runtime-source-files.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = "docs/archive/legacy-names.md";

// Measured 30 September 2026 by running this script and reading its own summary
// line: 308 runtime files, 88 under public/, 2 Android manifests, 14 data files,
// 413 tests and 458 markdown files under docs/ -- 1,283 in all, the test count
// including this gate's own test. The floor is far
// below that and far above zero, so a walk that breaks cannot pass by measuring
// nothing (shape 1).
const MINIMUM_SCANNED = 800;

// The ledger holds six entries today. A parser that silently stops matching the
// fenced block would leave nothing to search for and every file clean, so the
// floor is checked before the scan rather than after it.
const MINIMUM_RETIRED = 5;

// Files that contain a retired name correctly, each with the reason.
//
// "Historical" is not a reason on its own. Each entry says what the document is,
// so that the next person can tell a dated record of the rename from a file that
// has quietly started using an old name again.
const RECORDED_HISTORY = Object.freeze({
  [LEDGER]:
    "The ledger itself. This is the file AGENTS.md names as the one place historical context belongs, and the list " +
    "this check reads.",
  "docs/audits/SONARA_REDESIGN_CURRENT_STATE.md":
    "A dated audit of the state of the redesign. It names the old product names as the things being renamed away from, " +
    "which is what the document is for.",
  "docs/audits/SONARA_CURRENT_STATE_AUDIT.md":
    "A dated audit of the platform as it stood before the rename. Removing the old names would make it a record of " +
    "something that did not happen.",
  "docs/audits/SONARA_FINAL_PLATFORM_REDESIGN_AUDIT.md":
    "The dated report of the rename itself, including the retired tagline. It is the primary record of what the public " +
    "copy used to say.",
  "docs/audits/LIVE_FIX_SPRINT_PLAN.md":
    "A dated sprint plan that names one retired slug in the list of things the sprint removed."
});

function readLedger() {
  const source = fs.readFileSync(path.join(root, LEDGER), "utf8");
  const block = /<!-- BEGIN RETIRED_PUBLIC_NAMES -->\s*```text\s*([\s\S]*?)```\s*<!-- END RETIRED_PUBLIC_NAMES -->/.exec(source);
  if (!block) {
    console.error(
      `ERROR: ${LEDGER} has no RETIRED_PUBLIC_NAMES block. The ledger is what this check searches for; without it ` +
      "every file reads clean and the pass means nothing."
    );
    process.exit(1);
  }
  const names = block[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (names.length < MINIMUM_RETIRED) {
    console.error(
      `ERROR: only ${names.length} retired public name(s) parsed from ${LEDGER}, against a floor of ${MINIMUM_RETIRED}. ` +
      "The ledger parse has gone blind."
    );
    process.exit(1);
  }
  return names;
}

// Files with the extensions given, recursively, skipping nothing: a retired name
// in a fixture or a nested partial is still a retired name in the tree.
function filesUnder(directory, extensions) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const found = [];
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(path.relative(root, full));
    }
  })(absolute);
  return found;
}

// The population, named in the output rather than summarised as "verified", so
// the number can be checked against the tree (shape 2).
//
// Each group answers to a clause of the AGENTS.md rule: the runtime and public/
// are active UI, navigation, metadata and manifests; android/ holds the TWA
// manifest; data/ holds the product catalogue the pages render from; tests/ and
// docs/ are named in the rule explicitly.
function population() {
  const groups = {
    runtime: runtimeSourceFiles({ root, directories: ["lib", "routes"], files: ["server.js"] }),
    public: filesUnder("public", [".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt", ".md"]),
    android: filesUnder("android", [".json", ".xml", ".gradle"]),
    data: filesUnder("data", [".ts", ".json"]),
    tests: filesUnder("tests", [".js", ".mjs", ".cjs"]),
    docs: filesUnder("docs", [".md"])
  };
  const runtimeBlind = blindnessReason(groups.runtime);
  if (runtimeBlind) {
    console.error(`ERROR: ${runtimeBlind}`);
    process.exit(1);
  }
  return groups;
}

const retired = readLedger();
const groups = population();
const files = Object.values(groups).flat();
const total = files.length;

if (total < MINIMUM_SCANNED) {
  console.error(
    `ERROR: only ${total} files scanned, against a floor of ${MINIMUM_SCANNED}. One of the walks has broken and a ` +
    "clean result here would mean nothing."
  );
  process.exit(1);
}

const failures = [];
const hits = new Map();

for (const relative of files) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const found = retired.filter((name) => source.includes(name));
  if (found.length > 0) hits.set(relative, found);
}

for (const [relative, found] of [...hits].sort()) {
  if (RECORDED_HISTORY[relative]) continue;
  failures.push(
    `${relative} contains ${found.length === 1 ? "a retired public name" : `${found.length} retired public names`}: ` +
    `${found.join(", ")}.\n` +
    "    AGENTS.md: retired public names must not appear in active UI, navigation, metadata, manifests, tests or\n" +
    `    launch docs. Use the current architecture, or -- if this is a dated historical record -- add it to\n` +
    "    RECORDED_HISTORY in scripts/verify-retired-public-names.mjs with the reason."
  );
}

for (const [relative, reason] of Object.entries(RECORDED_HISTORY)) {
  if (!fs.existsSync(path.join(root, relative))) {
    failures.push(`RECORDED_HISTORY names ${relative}, which no longer exists. Remove the entry.`);
    continue;
  }
  if (!files.includes(relative)) {
    failures.push(
      `RECORDED_HISTORY names ${relative}, which is outside the scanned population, so the entry excuses nothing.\n` +
      "    Either the population moved or the entry is wrong; both need a person."
    );
    continue;
  }
  if (!hits.has(relative)) {
    failures.push(
      `RECORDED_HISTORY says ${relative} holds a retired name because: ${reason}\n` +
      "    It holds none. The reason now describes nothing, and a wrong reason inside an exemption is what the next\n" +
      "    person reads instead of checking. Remove the entry."
    );
  }
}

if (failures.length > 0) {
  console.error("Retired public names are not all accounted for:\n");
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

const groupSummary = Object.entries(groups)
  .map(([name, group]) => `${group.length} ${name}`)
  .join(", ");

console.log(
  `Retired public names verified: ${retired.length} names read from ${LEDGER}, searched across ${total} files ` +
  `(${groupSummary}). ${hits.size} files contain one, all ${Object.keys(RECORDED_HISTORY).length} of them dated ` +
  "records registered with a reason checked against the file. None in active UI, metadata, manifests, tests or docs."
);

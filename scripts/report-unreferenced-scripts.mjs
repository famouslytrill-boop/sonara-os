#!/usr/bin/env node
"use strict";

// Scripts nothing runs.
//
// `report-unreferenced-modules.mjs` asks this question of `lib/` and `routes/`,
// and says so plainly: "It reads every module under lib/ and routes/". `scripts/`
// was outside it, and `scripts/` is where the release chain lives -- so the one
// directory whose files exist to be executed had no check that any of them were.
//
// Measured 30 September 2026: **24 of 122** files under `scripts/` were reachable
// from nothing. Not merely unused -- unrunnable-by-anything. The list was not
// harmless:
//
//   * `verify-all.mjs` presents itself as the complete verification runner and
//     lists 34 pnpm scripts, of which **24 no longer exist**, so it dies on its
//     second command. `pnpm run verify:all` maps to `verify:launch`, so the
//     obvious command silently ran something else entirely.
//   * `verify-security.mjs` requires `next.config.mjs` and
//     `src/config/securityConfig.ts` and exits 1 -- and `SECURITY_NOTES.md` cited
//     it as a thing that runs.
//   * `check-env-safety.mjs` guarded the rule that no public environment variable
//     may carry a service-role key, and read **one file** out of the 256 `.cjs`
//     modules in `lib/`, because its extension filter excluded `.cjs`.
//   * four more asserted the existence of an `app/` or `frontend/` tree this
//     Express repository does not have, and three print a sentence and enforce
//     nothing at all.
//
// Every one of those had been "noticed" before. That is the argument
// `report-unreferenced-modules.mjs` already makes: noticing is free, and deleting
// needs somebody to be sure. This makes being sure cheap for `scripts/` too.
//
// ## Why reachability is transitive, and why comments are stripped
//
// A script is reachable when something that can RUN it names it. The roots are
// `package.json`'s scripts, the workflow files, and the code that ships or is
// tested -- `lib/`, `routes/`, `tests/`, `api/`, `tools/`, `server.js`. A
// reachable script naming another makes that one reachable too, because
// `run-python-coverage-floor.mjs` spawning `verify-python-coverage-floor.py` is a
// real call chain.
//
// Comments are stripped first, with lib/sonara-comment-stripping.cjs rather than a
// copy, and this is not a precaution -- it was a measured error. The first run of
// this analysis reported `verify-all.mjs` as REACHABLE, because a comment in
// scripts/verify-retired-public-names.mjs explains that nothing runs it. A
// sentence saying "nothing runs this" counted as something running it. The
// measurement would have exonerated the exact file it exists to find.
//
// ## Two-sided
//
// A script nobody can run fails. A registered operator tool that has become
// reachable fails too -- it is wired in now, and the entry describes nothing --
// and so does one whose file is gone. Shape 5: an exemption whose reason has
// expired is what the next person reads instead of checking.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { withoutComments, withoutHashComments } = require("../lib/sonara-comment-stripping.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

// This file names scripts in order to report on them, so its own mentions are the
// report rather than a call. Leaving it in the referencer text made every entry in
// OPERATOR_TOOLS read as reachable the moment this gate was wired into the chain,
// and the register then failed as stale on all five -- the register accusing itself.
//
// This is the same error as counting a comment: a mention is not an invocation. It
// is also the limit of this measurement, stated rather than hidden: any reachable
// script that holds another script's filename in a data structure will make it read
// as reachable. Nothing else in scripts/ does that today, and the two-sided
// register is what would surface it if one started.
const SELF = "scripts/report-unreferenced-scripts.mjs";

// Every language a file in scripts/ is written in. `.ps1` is included
// deliberately: leaving it out would make this gate measure a smaller population
// than the "scripts/" it reports on, which is the shape-2 defect it was written
// alongside. Both PowerShell scripts turn out to be operator tools, and are
// registered below.
const SCRIPT_EXTENSIONS = [".mjs", ".cjs", ".js", ".sh", ".py", ".ps1"];

// Measured 30 September 2026 after the deletions in this change: 108 files under
// scripts/, 101 of them reachable. The floors sit below those and far above zero,
// so a walk that breaks cannot pass by finding nothing to check (shape 1).
const MINIMUM_CANDIDATES = 80;
const MINIMUM_REACHABLE = 60;

// Tools a person runs by hand. Each entry says what it does and when you would
// reach for it, because "a dev script" is what every one of these looks like
// until it is the one that stopped working two years ago.
const OPERATOR_TOOLS = Object.freeze({
  "scripts/report-actions-queue.cjs":
    "Manual, offline exact-commit GitHub Actions evidence diagnostic. An authorized operator exports a sanitized " +
    "GitHub API snapshot and runs node scripts/report-actions-queue.cjs <snapshot.json> to inspect unfinished jobs, " +
    "workflow-to-job provenance and page completeness. It neither fetches tokens nor reruns or approves CI.",
  "scripts/bootstrap-local.mjs":
    "First-run local setup: installs from pnpm-lock.yaml and refuses outright if the lockfile or package.json is absent. " +
    "Run once on a fresh checkout. Nothing in CI needs it because the workflows install directly.",
  "scripts/dependency-audit.mjs":
    "Wraps `pnpm audit --audit-level moderate` and prints the findings without ever running a fix, which is the " +
    "AGENTS.md rule it exists to make hard to break. The release chain runs the same audit directly, so this is the " +
    "convenience copy for a person at a terminal.",
  "scripts/check-software.mjs":
    "Reports which local command-line tools are present and which are optional, so somebody setting up a machine can " +
    "tell a missing tool from a broken one. It is a report about the machine, not about this repository, so it has " +
    "nothing to assert in CI.",
  "scripts/create-agent-worktree.sh":
    "Creates a sibling git worktree on an `agent/<name>` branch, refusing to overwrite an existing path. For running " +
    "two branches side by side without a second clone.",
  "scripts/remove-agent-worktree.sh":
    "Removes a worktree created by create-agent-worktree.sh, behind a typed confirmation because it deletes a working " +
    "tree. Deliberately interactive, which is also why nothing automated may call it.",
  "scripts/scan-secrets-local.ps1":
    "A Windows-side secret scan an owner runs before pushing, walking the tree and skipping binaries. It is the local " +
    "companion to `pnpm run scan:client-secrets`, which is what the release chain runs; SECURITY_NOTES.md and " +
    "docs/owner/INSTALL-ALL-KEYS.md both name it for a person at a Windows terminal.",
  "scripts/setup-vercel-env.ps1":
    "Prompts for each deployment environment variable and sends it to Vercel without ever writing a value to a file. " +
    "Run by the owner when setting up or rotating deployment configuration; docs/owner/INSTALL-ALL-KEYS.md walks " +
    "through it. Nothing automated may call it, because it is interactive and it handles secrets."
});

function walk(directory, extensions) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const found = [];
  (function descend(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        descend(full);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(path.relative(root, full));
    }
  })(absolute);
  return found;
}

// Comments out, by language. A shell or Python script's `#` comments and a
// JavaScript file's `//` and `/* */` are equally capable of naming a script
// nobody calls.
function executableText(relative) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  return /\.(sh|py|ya?ml)$/.test(relative) ? withoutHashComments(source) : withoutComments(source);
}

const candidates = walk("scripts", SCRIPT_EXTENSIONS).sort();

// The roots: everything that can start a script without another script's help.
const packageScripts = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts || {});
const workflows = walk(".github/workflows", [".yml", ".yaml"]);
const shippedCode = [
  ...walk("lib", [".cjs", ".mjs", ".js", ".ts"]),
  ...walk("routes", [".cjs", ".mjs", ".js"]),
  ...walk("tests", [".js", ".mjs", ".cjs"]),
  ...walk("api", [".js", ".mjs", ".cjs"]),
  ...walk("tools", [".js", ".mjs", ".cjs", ".ts"]),
  "server.js"
].filter((relative) => fs.existsSync(path.join(root, relative)));

const rootText = [packageScripts, ...workflows.map(executableText), ...shippedCode.map(executableText)].join("\n");

const reachable = new Set(candidates.filter((relative) => rootText.includes(path.basename(relative))));
for (let settled = false; !settled; ) {
  settled = true;
  const reachableText = [...reachable].filter((relative) => relative !== SELF).map(executableText).join("\n");
  for (const relative of candidates) {
    if (reachable.has(relative)) continue;
    if (reachableText.includes(path.basename(relative))) {
      reachable.add(relative);
      settled = false;
    }
  }
}

const problems = [];

if (candidates.length < MINIMUM_CANDIDATES) {
  problems.push(
    `Only ${candidates.length} files found under scripts/, below the floor of ${MINIMUM_CANDIDATES}.\n` +
    "    The directory walk has broken, and a clean result here would mean nothing."
  );
}
if (reachable.size < MINIMUM_REACHABLE) {
  problems.push(
    `Only ${reachable.size} of ${candidates.length} scripts read as reachable, below the floor of ${MINIMUM_REACHABLE}.\n` +
    "    The referencer scan has broken. Almost everything in scripts/ is called by package.json, so this number\n" +
    "    collapsing means the roots are not being read rather than that the scripts went dead."
  );
}
if (rootText.length < 100000) {
  problems.push(
    `The referencer text is only ${rootText.length} characters. It should be the whole of package.json's scripts,\n` +
    "    the workflows, and the shipped code; something has stopped being read."
  );
}

const unreferenced = candidates.filter((relative) => !reachable.has(relative) && !OPERATOR_TOOLS[relative]);
for (const relative of unreferenced) {
  problems.push(
    `${relative} is run by nothing.\n` +
    "    No package.json script, no workflow, no shipped code or test, and no reachable script names it. This\n" +
    "    runtime has no dynamic dispatch for scripts, so the only way in is a literal mention.\n" +
    "    Delete it, wire it into the release chain, or -- if a person runs it by hand -- add it to OPERATOR_TOOLS\n" +
    "    in scripts/report-unreferenced-scripts.mjs saying what it does and when you would run it."
  );
}

for (const [relative, reason] of Object.entries(OPERATOR_TOOLS)) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`OPERATOR_TOOLS names ${relative}, which no longer exists. Remove the entry.`);
    continue;
  }
  if (reachable.has(relative)) {
    problems.push(
      `OPERATOR_TOOLS calls ${relative} a tool a person runs by hand, and something now runs it automatically.\n` +
      "    Remove the entry: it is wired in, and the reason on file describes something that is no longer true."
    );
  }
  if (String(reason).trim().length < 80) {
    problems.push(`${relative} has no real reason recorded. "A dev script" is not a reason; say what it does and when you would run it.`);
  }
}

if (problems.length > 0) {
  console.error(`Scripts in scripts/ are not all accounted for (${problems.length} finding(s)):\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

const registered = Object.keys(OPERATOR_TOOLS).length;
console.log(
  `Scripts accounted for: ${candidates.length} files under scripts/, ${reachable.size} reachable from package.json, ` +
  `the workflows, or the shipped code, and ${registered} recorded as operator tools with a reason. None unaccounted. ` +
  "Comments are stripped first: a comment saying nothing runs a script counted as something running it, which is how " +
  "the first version of this measurement exonerated the file it exists to find."
);

if (!checkOnly) {
  console.log(`\nOperator tools, run by hand:\n${Object.entries(OPERATOR_TOOLS).map(([file, reason]) => `  ${file}\n      ${reason}`).join("\n")}`);
}

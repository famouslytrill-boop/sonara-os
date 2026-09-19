#!/usr/bin/env node
"use strict";

// A step that names one test file must run that file, and not the other 4,766.
//
// `.mocharc.json` declares `spec: ["tests/**/*.js", "tests/**/*.mjs"]`. Mocha
// treats a positional path as an ADDITION to that list, not a replacement. So
//
//     pnpm exec mocha tests/cross-tenant-isolation.test.js --reporter json
//
// runs the entire repository suite. Measured 19 September 2026: **4,779 tests
// from that command, and 13 in the file it names.**
//
// ## Why this is a correctness problem and not a speed one
//
// That exact command wrote `artifacts/security/tenant-adversarial.json` in
// `engineering-intelligence-security.yml` -- release security evidence, named
// for the 13 tenant-isolation assertions, containing all 4,779 results. Two
// consequences, both of them the defect this repository is organised around:
//
//   - any unrelated failure anywhere in the suite appeared in that file and
//     read as a tenant-isolation failure, which is how three failing
//     assertions elsewhere propagated into the security gate;
//   - the file's name claimed a population it did not measure.
//
// The same applied to `rls-contract.log` and to the event-consumer step, and to
// `verify:tenant-adversarial` in `package.json`, which `test:security` runs.
//
// ## The fix these invocations must use
//
// `.mocharc.targeted.json` carries the `require` and `timeout` the suite needs
// and declares **no `spec`**, so a positional path is the whole population.
// This check requires every targeted invocation to pass it.
//
// It does not forbid running the whole suite: `pnpm test` is
// `mocha --pass-with-no-tests` with no positional path, which is the config's
// job and is left alone.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const TARGETED_CONFIG = ".mocharc.targeted.json";
const WORKFLOWS = ".github/workflows";

// Measured 19 September 2026: 4 targeted invocations carrying a positional
// path (1 in package.json, 3 across 2 workflows), with `scripts/` and `tests/`
// also scanned and holding none. A floor, because a scan that finds none
// reports every invocation correct -- exactly how this went unnoticed.
const MINIMUM_INVOCATIONS = 3;

// `mocha ... tests/<something>` -- a positional path under tests/. Flags and
// their values are skipped, so `--reporter tests/x` would not be mistaken for a
// spec, and `--config`/`--spec` are recognised by name.
const MOCHA_CALL = /\bmocha\b([^\n|&;>]*)/g;

// Tokens are normalised before they are read, because a spawned invocation is
// an array of quoted strings rather than a shell line:
//
//     spawnSync("npx", ["mocha", "tests/x.test.js", "--reporter", "dot"])
//
// The first version of this split on whitespace and tested `/^tests\//`, so
// every token still carried a quote or a comma and nothing matched. Widening
// the population to `scripts/` and `tests/` therefore scanned those files and
// could not see anything in them -- coverage that looks real and is not, which
// is the defect this check exists to catch. Caught by falsifying the widening
// instead of trusting it: a planted unpinned spawn exited 0.
function normaliseToken(token) {
  return token.replace(/^[\[({,'"`]+/, "").replace(/[\])},;'"`]+$/, "");
}

function targetedPaths(commandTail) {
  const tokens = commandTail.trim().split(/[\s,]+/).map(normaliseToken).filter(Boolean);
  const paths = [];
  let sawConfig = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--config" || token.startsWith("--config=")) {
      sawConfig = true;
      if (token === "--config") i += 1;
      continue;
    }
    if (token.startsWith("--") || token.startsWith("-")) {
      // Flags that take a value: skip the value so it cannot look like a spec.
      if (/^--?(reporter|reporter-option|require|timeout|grep|spec|slow|retries|ui|parallel|jobs)$/.test(token)) i += 1;
      continue;
    }
    if (/^tests\//.test(token)) paths.push(token);
  }
  return { paths, sawConfig };
}

// Comments removed before scanning, so a file that DESCRIBES the mistake is not
// mistaken for one that makes it.
//
// The first version with `scripts/` in its population flagged this very file
// twice, for the example invocation quoted in the header above -- shape 7 in
// .claude/skills/checks-that-cannot-lie, a pattern matching prose as if it were
// code, reproduced while fixing a different defect.
//
// The second version hand-rolled the stripper, stripping block comments and
// then line comments in two passes, and
// tests/a-line-comment-cannot-open-a-block-comment.test.js failed it by name:
// "strips comments without using the shared stripper; that is how the same bug
// shipped three times". It was right. lib/sonara-comment-stripping.cjs exists
// for exactly this, does it in one alternation so whichever comment starts
// first wins, and now carries the `#` form for YAML as well.
const { withoutComments, withoutHashComments } = require(path.join(root, "lib", "sonara-comment-stripping.cjs"));

const sources = [];

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  sources.push({ where: `package.json scripts.${name}`, command });
}

if (!fs.existsSync(path.join(root, WORKFLOWS))) {
  console.error(`Targeted mocha check failed: ${WORKFLOWS} does not exist, so nothing was scanned.`);
  process.exit(1);
}
for (const file of fs.readdirSync(path.join(root, WORKFLOWS)).filter((name) => /\.ya?ml$/i.test(name))) {
  sources.push({ where: `${WORKFLOWS}/${file}`, command: withoutHashComments(fs.readFileSync(path.join(root, WORKFLOWS, file), "utf8")) });
}

// `scripts/` and `tests/` too, because a spawned mocha is the same defect and
// the first version of this check did not look there.
//
// It scanned `package.json` and the workflows, which is where the four known
// invocations were -- so its population was "wherever I happened to look",
// which is not a population. Checked by hand afterwards and found one spawn:
// `tests/every-test-file-can-fail-the-suite.test.js` runs `mocha --dry-run`
// with NO positional path, deliberately loading the whole suite because its job
// is to enumerate every test file. That one is correct and this check leaves it
// alone; the point is that the scan now covers the place it lives.
for (const directory of ["scripts", "tests"]) {
  const full = path.join(root, directory);
  if (!fs.existsSync(full)) continue;
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) { walk(next); continue; }
      if (!/\.(mjs|cjs|js)$/.test(entry.name)) continue;
      sources.push({ where: next, command: withoutComments(fs.readFileSync(path.join(root, next), "utf8")) });
    }
  };
  walk(directory);
}

const problems = [];
const invocations = [];

for (const { where, command } of sources) {
  for (const match of command.matchAll(MOCHA_CALL)) {
    const { paths, sawConfig } = targetedPaths(match[1] || "");
    if (!paths.length) continue;
    invocations.push({ where, paths, sawConfig });
    if (!sawConfig) {
      problems.push(
        `${where} runs mocha on ${paths.join(", ")} without --config ${TARGETED_CONFIG}.\n`
        + "    .mocharc.json declares a spec covering every test file, and mocha ADDS a positional path to it\n"
        + "    rather than replacing it, so this runs the whole suite. Any unrelated failure then lands in this\n"
        + `    step's evidence under this step's name. Add: --config ${TARGETED_CONFIG}`
      );
    }
  }
}

if (!fs.existsSync(path.join(root, TARGETED_CONFIG))) {
  problems.push(
    `${TARGETED_CONFIG} does not exist, and every targeted invocation points at it.\n`
    + "    Without it mocha falls back to the repository config and silently runs the whole suite again."
  );
} else {
  const targeted = JSON.parse(fs.readFileSync(path.join(root, TARGETED_CONFIG), "utf8"));
  if (targeted.spec) {
    problems.push(
      `${TARGETED_CONFIG} declares a "spec", which defeats its only purpose.\n`
      + "    A positional path is added to that spec, so the invocation would run the whole suite again."
    );
  }
  const repoConfig = JSON.parse(fs.readFileSync(path.join(root, ".mocharc.json"), "utf8"));
  for (const key of ["require", "timeout"]) {
    if (repoConfig[key] !== undefined && targeted[key] === undefined) {
      problems.push(
        `${TARGETED_CONFIG} is missing "${key}", which .mocharc.json sets to ${JSON.stringify(repoConfig[key])}.\n`
        + "    A targeted run must load the same setup and limits as the suite, or it is testing something else."
      );
    }
  }
}

if (invocations.length < MINIMUM_INVOCATIONS) {
  problems.push(
    `Only ${invocations.length} targeted mocha invocation(s) found, below the ${MINIMUM_INVOCATIONS} present on 19 September 2026.\n`
    + "    Either they were removed or this scan has stopped matching. A scan that finds none reports every\n"
    + "    invocation correct, which is how a security-evidence file came to hold the entire test suite."
  );
}

if (problems.length) {
  console.error(`Targeted mocha check failed on ${problems.length} point(s).\n`);
  console.error(problems.map((problem) => `  - ${problem}`).join("\n\n"));
  process.exit(1);
}

console.log(
  `Targeted mocha invocations verified: ${invocations.length} command(s) naming a test file all pass `
  + `--config ${TARGETED_CONFIG}, which declares no spec -- so each runs the file it names and not the whole suite.`
);

#!/usr/bin/env node
"use strict";

/**
 * No runtime file may be less than 35% covered by the tests, and every file
 * that is has to say why.
 *
 * ## Where the numbers come from
 *
 * Node 22 writes V8's own coverage to the directory named by
 * `NODE_V8_COVERAGE`, so this needs no dependency: it runs the mocha suite with
 * that variable set and folds the byte ranges into per-file line coverage. That
 * is the same mechanism c8 uses; what is not here is c8's reporting, which this
 * does not need.
 *
 * V8 gives ranges with hit counts, and the ranges nest -- an outer function
 * range says "this ran", an inner range with count 0 carves out a branch that
 * did not. Painting the largest span first and letting nested ranges overwrite
 * is what reproduces that.
 *
 * The denominator is lines with something on them: blank lines, comment lines
 * and lines holding only a closing brace are excluded, because counting them
 * inflates every figure here and would let a file pass the floor on its
 * punctuation. That makes these numbers stricter than a raw line count, not
 * more generous, and the population is printed so the figure can be checked
 * rather than believed.
 *
 * ## Why a register rather than a bare floor
 *
 * Twenty-one files were already under the floor when it was introduced. A gate
 * that simply failed would have had to be switched off on the day it landed,
 * which is how a check becomes decoration. So it is two-sided, the way
 * `report-orphan-tables.mjs` is:
 *
 *   - a file under the floor that is not in the register fails, and
 *   - a file in the register that has reached the floor **also** fails, because
 *     a recorded reason that no longer describes anything is worse than no
 *     record at all -- it is what the next person reads instead of checking.
 *   - a register entry naming a file nothing measured fails too, so a rename
 *     cannot quietly retire an exemption.
 *   - and a file already in the register that gets **worse** fails, so the
 *     register is a record of where things stand rather than a place to put
 *     things to stop them being looked at.
 *
 * Each entry carries what was measured and how many test files name the module,
 * both of which are facts rather than judgements. `handlers` is recorded for the
 * four files no test names at all: they are `require`d by `server.js`, so their
 * route registration runs -- which is the coverage they do have -- and nothing
 * invokes the handlers they declare.
 *
 * Run-to-run stability was checked before choosing the regression tolerance:
 * two consecutive runs of the whole suite produced identical per-file figures
 * (21 files under the floor, 3395 uncovered lines inside them, both times).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FLOOR = 0.35;

// Below the floor on 2 September 2026, with what was measured that day.
// `namedBy` is how many files under tests/ mention the module by name.
const BELOW_FLOOR = Object.freeze({
  "routes/sonara-call-routes.cjs":
    { covered: 45, total: 273, namedBy: 2, note: "the two tests that name it assert the call never routes through us; the handler bodies need a live Supabase" },
  "routes/sonara-subsystem-routes.cjs":
    { covered: 30, total: 177, namedBy: 1, note: "reached only as one of many routes in the outage crawl, which renders the unconfigured state" },
  "scripts/verify-member-read-access.mjs":
    { covered: 15, total: 86, namedBy: 1, note: "a release script that talks to Supabase; the suite loads it but cannot run it against a database" },
  "lib/sonara-page-frame.cjs":
    { covered: 65, total: 350, namedBy: 12, note: "twelve tests assert parts of the page shell; most of the file is per-page branches only some pages take" },
  "lib/sonara-scroll-render.cjs":
    { covered: 30, total: 158, namedBy: 1, note: "browser-side rendering, exercised by the one test that reads it rather than by running it" },
  "routes/sonara-prompt-library-routes.cjs":
    { covered: 125, total: 511, namedBy: 2, note: "handler bodies need a live Supabase" },
  "routes/sonara-huggingface-routes.cjs":
    { covered: 26, total: 95, namedBy: 0, handlers: 4, note: "no test names it; required by server.js so its registration runs, nothing drives its 4 handlers" },
  "lib/sonara-langflow-adapter.cjs":
    { covered: 8, total: 28, namedBy: 1, note: "an adapter for a service the owner runs; the test asserts its shape, not a call" },
  "lib/sonara-open-webui-adapter.cjs":
    { covered: 6, total: 21, namedBy: 1, note: "an adapter for a service the owner runs; the test asserts its shape, not a call" },
  "routes/sonara-connected-payment-routes.cjs":
    { covered: 43, total: 149, namedBy: 1, note: "handler bodies need a live Stripe and Supabase" },
  "routes/sonara-infrastructure-routes.cjs":
    { covered: 16, total: 55, namedBy: 0, handlers: 4, note: "no test names it; required by server.js so its registration runs, nothing drives its 4 handlers" },
  "routes/market-intelligence-routes.cjs":
    { covered: 141, total: 472, namedBy: 3, note: "handler bodies need a live Supabase" },
  "routes/sonara-notification-routes.cjs":
    { covered: 36, total: 117, namedBy: 3, note: "handler bodies need a live Supabase" },
  "routes/product-lifecycle-routes.cjs":
    { covered: 160, total: 507, namedBy: 1, note: "handler bodies need a live Supabase" },
  "routes/sonara-model-safety-resilience-routes.cjs":
    { covered: 24, total: 74, namedBy: 1, note: "handler bodies need a live Supabase" },
  "routes/growth-studio-control-routes.cjs":
    { covered: 284, total: 866, namedBy: 3, note: "the largest of these; handler bodies need a live Supabase" },
  "lib/sonara-call-sessions.cjs":
    { covered: 43, total: 131, namedBy: 1, note: "session bookkeeping for calls, driven from routes the suite does not drive" },
  "routes/sonara-leadforge-routes.cjs":
    { covered: 100, total: 301, namedBy: 2, note: "handler bodies need a live Supabase" },
  "routes/creator-music-system-readonly.cjs":
    { covered: 22, total: 65, namedBy: 0, handlers: 5, note: "no test names it; required by server.js so its registration runs, nothing drives its 5 handlers" },
  "routes/sonara-formula-routes.cjs":
    { covered: 58, total: 169, namedBy: 0, handlers: 6, note: "no test names it; required by server.js so its registration runs, nothing drives its 6 handlers" },
  "routes/sonara-voice-studio-routes.cjs":
    { covered: 36, total: 103, namedBy: 2, note: "34.95%, just under; handler bodies need a live Supabase" }
});

// If a registered file loses more than this many percentage points it fails.
// Two consecutive whole-suite runs gave identical figures, so this is slack for
// a future source of jitter rather than for one that has been seen.
const REGRESSION_TOLERANCE_POINTS = 2;

// This check has gone blind if it is suddenly measuring far less than the
// repository holds. Both are well below what is there today (206 files, 39,087
// countable lines) and far above nothing.
const MINIMUM_FILES = 150;
const MINIMUM_LINES = 25000;

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exitCode = 1;
}

function collect(covDir) {
  const perFile = new Map();
  for (const name of fs.readdirSync(covDir)) {
    if (!name.endsWith(".json")) continue;
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(path.join(covDir, name), "utf8"));
    } catch {
      continue;
    }
    for (const script of doc.result || []) {
      if (!script.url || !script.url.startsWith("file://")) continue;
      let file;
      try {
        file = fileURLToPath(script.url);
      } catch {
        continue;
      }
      if (!file.startsWith(REPO)) continue;
      const rel = path.relative(REPO, file).split(path.sep).join("/");
      if (rel.startsWith("node_modules/") || rel.includes("/node_modules/")) continue;
      if (rel.startsWith("archive/") || rel.startsWith("tests/")) continue;
      if (!perFile.has(rel)) perFile.set(rel, []);
      for (const fn of script.functions || []) {
        for (const range of fn.ranges || []) perFile.get(rel).push(range);
      }
    }
  }
  return perFile;
}

function lineCoverage(rel, ranges) {
  const source = fs.readFileSync(path.join(REPO, rel));
  const counts = new Int32Array(source.length).fill(-1);
  ranges.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
  for (const range of ranges) {
    const end = Math.min(range.endOffset, source.length);
    for (let i = range.startOffset; i < end; i += 1) counts[i] = range.count;
  }

  const text = source.toString("utf8");
  let offset = 0;
  let total = 0;
  let covered = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const punctuationOnly = trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("*") ||
      trimmed.startsWith("/*") || trimmed === "}" || trimmed === "};" || trimmed === "});" || trimmed === ")";
    if (!punctuationOnly) {
      total += 1;
      for (let i = offset; i < offset + line.length; i += 1) {
        if (counts[i] > 0) { covered += 1; break; }
      }
    }
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  return { covered, total };
}

const covDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-coverage-"));
try {
  // Run the suite here rather than reading whatever a previous command left
  // behind. Coverage from an older tree would be a figure that reports success
  // about code it never saw.
  // The suite's stderr is captured rather than passed through: several tests
  // deliberately provoke the error paths they are testing, so a clean run
  // prints stack traces that are not problems. It is printed in full if the
  // run fails, which is the only time it means anything.
  const run = spawnSync("npx", ["mocha"], {
    cwd: REPO,
    env: { ...process.env, NODE_V8_COVERAGE: covDir },
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8"
  });
  if (run.status !== 0) {
    process.stderr.write(run.stderr || "");
    fail("the test suite did not pass, so its coverage says nothing. Fix the suite first.");
    process.exit(1);
  }

  const measured = [];
  for (const [rel, ranges] of collect(covDir)) {
    const { covered, total } = lineCoverage(rel, ranges);
    if (total > 0) measured.push({ rel, covered, total, ratio: covered / total });
  }

  const totalLines = measured.reduce((sum, row) => sum + row.total, 0);
  const coveredLines = measured.reduce((sum, row) => sum + row.covered, 0);

  if (measured.length < MINIMUM_FILES) {
    fail(`only ${measured.length} runtime files were measured, expected at least ${MINIMUM_FILES}; this check has gone blind`);
    process.exit(1);
  }
  if (totalLines < MINIMUM_LINES) {
    fail(`only ${totalLines} countable lines were measured, expected at least ${MINIMUM_LINES}; this check has gone blind`);
    process.exit(1);
  }

  const byPath = new Map(measured.map((row) => [row.rel, row]));

  for (const row of measured) {
    const entry = BELOW_FLOOR[row.rel];
    const percent = (row.ratio * 100).toFixed(1);
    if (row.ratio < FLOOR && !entry) {
      fail(
        `${row.rel} is ${percent}% covered (${row.covered}/${row.total}), under the ${FLOOR * 100}% floor, and is not in ` +
        `BELOW_FLOOR in scripts/verify-coverage-floor.mjs. Either test it, or record it there with what it is and why.`
      );
    }
    if (row.ratio >= FLOOR && entry) {
      fail(
        `${row.rel} is now ${percent}% covered (${row.covered}/${row.total}) and has reached the floor, but is still listed ` +
        `in BELOW_FLOOR. Remove its entry -- a recorded reason that no longer describes anything is what the next person ` +
        `reads instead of checking.`
      );
    }
    if (entry) {
      const wasRatio = entry.covered / entry.total;
      const lost = (wasRatio - row.ratio) * 100;
      if (lost > REGRESSION_TOLERANCE_POINTS) {
        fail(
          `${row.rel} was ${(wasRatio * 100).toFixed(1)}% when it was recorded and is ${percent}% now, ` +
          `${lost.toFixed(1)} points worse. The register records where things stand; it is not somewhere to put a file ` +
          `to stop it being looked at.`
        );
      }
    }
  }

  for (const rel of Object.keys(BELOW_FLOOR)) {
    if (!byPath.has(rel)) {
      fail(
        `BELOW_FLOOR names ${rel}, which nothing measured. If it was renamed or deleted, update the register -- ` +
        `otherwise a rename retires an exemption without anybody deciding to.`
      );
    }
  }

  const under = measured.filter((row) => row.ratio < FLOOR).length;
  const population =
    `${measured.length} runtime files, ${totalLines} countable lines, ` +
    `${((coveredLines / totalLines) * 100).toFixed(1)}% covered overall, ` +
    `${under} under the ${FLOOR * 100}% floor against ${Object.keys(BELOW_FLOOR).length} register entries`;

  // The word "verified" belongs only on a run that found nothing. Printing it
  // beneath a list of errors is the failure this repository keeps finding: a
  // signal that reports success without being true.
  if (process.exitCode) {
    process.stderr.write(`\nCoverage floor check FAILED. Measured ${population}.\n`);
    process.exit(1);
  }
  process.stdout.write(`Coverage floor verified: ${population}.\n`);
} finally {
  fs.rmSync(covDir, { recursive: true, force: true });
}

#!/usr/bin/env node

// Modules nothing requires.
//
// lib/sonara-cohesive-homepage.cjs and lib/sonara-advanced-builder-homepage.cjs
// were each several hundred lines of homepage rendering that no file in this
// repository required. They were noticed three separate times across this
// project's history, mentioned each time, and left there each time -- because
// noticing is free and deleting needs somebody to be sure.
//
// This makes being sure cheap. It reads every module under lib/ and routes/ and
// asks whether any file anywhere -- server.js, api/, scripts/, tests/, or
// another module -- names it. A module nothing names is not "probably unused";
// it is unreachable, because this runtime has no bundler, no dynamic import and
// no code generation left, so the only way in is a literal require.
//
// duriantaco/skylos in the register does this for Python and cannot run here.
// The problem it solves is real in this tree; the tool is not the one that
// fits, so this is the same idea written against this codebase.
//
// It reports rather than deletes. A module can be legitimately unreferenced --
// something staged behind a flag, or a file kept deliberately -- and the
// allowlist below takes those with a reason attached, which is the part that
// stops the list becoming a place to hide things.
//
// ## Tests count as referencers here, and that was measured rather than assumed
//
// The searched set below includes tests/, so a module only its own test
// requires reads as referenced. That is a real gap in principle: a lib module
// nothing in the product uses is dead whatever its tests do, and it is exactly
// the shape that hid 108 lines of homepage from this report (see
// scripts/report-uncalled-factory-functions.mjs, which covers the function-level
// version of it).
//
// Measured on 8 September 2026, the module-level version of that gap has **no
// defects in it**. Two modules are referenced by tests and by neither runtime
// nor scripts, and both are correct:
//
//   lib/sonara-form-reachability.cjs   -- a measurement three tests share. Test
//                                         infrastructure that lives in lib/ on
//                                         purpose.
//   lib/sonara-supabase-clients.cjs    -- deliberately not yet wired. It is the
//                                         machinery for moving off the
//                                         service-role key, and
//                                         tests/the-revoke-reasoning-is-still-true.test.js
//                                         reasons about it explicitly, including
//                                         what its deletion would mean.
//
// So no runtime-versus-test tier was added. It would carry two permanent
// exemptions and catch nothing, and a gate whose entire population is
// exemptions is a gate that only makes noise. This note is here so the next
// person can see the measurement rather than repeat it.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { withoutComments } = createRequire(import.meta.url)("../lib/sonara-comment-stripping.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

// Unreferenced on purpose. A reason is required, because "it is fine" is what
// every one of these looks like until it is not.
const ALLOWED = new Map([
  // Empty. Both entries that would have gone here were deleted instead, which
  // is what this list is for -- making the choice explicit rather than letting
  // "unreferenced" become a resting state.
]);

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, found);
    } else if (/\.(cjs|mjs|js|ts)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

// Every file that could name a module, including the modules themselves --
// one module requiring another counts as a reference.
const searchable = [
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "routes")),
  ...walk(path.join(root, "api")),
  ...walk(path.join(root, "scripts")),
  ...walk(path.join(root, "tests")),
  ...walk(path.join(root, "data")),
  path.join(root, "server.js")
].filter((file) => fs.existsSync(file));

// Candidates: modules under lib/ and routes/ that something is supposed to use.
const candidates = [...walk(path.join(root, "lib")), ...walk(path.join(root, "routes"))]
  .filter((file) => /\.cjs$/.test(file));

if (candidates.length === 0) {
  console.error("ERROR: no modules found under lib/ or routes/; this report has gone blind rather than found nothing");
  process.exit(1);
}

// Comments are stripped before matching. This file's own header names two of
// the modules it reports on, and scripts/report-orphan-tables.mjs once shipped
// with exactly this bug -- a table mentioned in a comment counted as a table
// somebody queried, so a table nothing touched looked used.
//
// ## Why this no longer strips them itself
//
// It used to, in two passes: block comments, then line comments. That is the
// obvious order and it is wrong, and lib/sonara-comment-stripping.cjs exists
// because two other reports had the identical bug. This one was not changed
// with them, so it carried the original for as long as the module has existed.
//
// The damage was not hypothetical. In routes/sonara-last9-routes.cjs the line
//
//     // /business-builder/owner/* and this module already receives ...
//
// contains `/*`, the block pass read it as an opener, and everything to the
// next `*/` -- 971 lines later, inside a catch -- stopped being code. The file
// went from 171,348 characters to 74,306: **57% of it erased before matching**,
// taking `require("./sonara-sub-app-routes.cjs")` with it.
//
// That direction of error is the dangerous one here. Losing a reference makes a
// module that IS required look unreferenced, and `--check` fails the build over
// it. The report currently prints zero only because nothing has yet landed in
// one of the swallowed regions.
//
// One left-to-right pass with both forms in one alternation fixes it: at the
// `//` the block branch cannot match, so a `/*` inside a line comment is never
// an opener.

const sources = new Map(searchable.map((file) => [file, withoutComments(fs.readFileSync(file, "utf8"))]));

const unreferenced = [];
for (const candidate of candidates) {
  const relative = path.relative(root, candidate);
  const base = path.basename(candidate, ".cjs");
  // The module name as it would appear in a require path. Matching the base
  // name rather than the full path catches ../lib/x.cjs, ./x.cjs and
  // path.join(root, "lib", "x.cjs") alike.
  const pattern = new RegExp(`["'\`/]${base.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(?:\\.cjs)?["'\`]`);
  let referenced = false;
  for (const [file, source] of sources) {
    if (file === candidate) continue;
    if (pattern.test(source)) {
      referenced = true;
      break;
    }
  }
  if (!referenced) unreferenced.push(relative);
}

const unexplained = unreferenced.filter((relative) => !ALLOWED.has(relative));

console.log(`Modules under lib/ and routes/: ${candidates.length}`);
console.log(`Files that could reference them: ${sources.size}`);
console.log(`Unreferenced: ${unreferenced.length}${ALLOWED.size ? `, of which ${ALLOWED.size} are allowed with a reason` : ""}`);
for (const relative of unreferenced) {
  const reason = ALLOWED.get(relative);
  console.log(`  ${relative}${reason ? ` -- allowed: ${reason}` : ""}`);
}

if (checkOnly && unexplained.length) {
  console.error("");
  console.error("ERROR: these modules are required by nothing. This runtime has no bundler, no dynamic");
  console.error("import and no code generation, so the only way into a module is a literal require --");
  console.error("which means unreferenced is unreachable, not merely unused. Delete them, or add each");
  console.error("to ALLOWED in this script with the reason it stays.");
  for (const relative of unexplained) console.error(`  ${relative}`);
  process.exit(1);
}

if (checkOnly) console.log("Every module under lib/ and routes/ is reachable.");

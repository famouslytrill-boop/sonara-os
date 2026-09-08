#!/usr/bin/env node

// Functions a factory hands out that nothing takes.
//
// scripts/report-unreferenced-modules.mjs asks whether anything requires a
// module. It cannot ask whether anything uses what the module returns, and on
// 8 September 2026 that gap cost 108 lines: `renderHomepageContent` in
// lib/sonara-page-frame.cjs was a complete homepage body, returned by
// `createPageFrame`, destructured by nobody, and called by nothing. The module
// is heavily used, so the module-level report was correct and silent. It was
// found by accident, while checking whether a sentence on it was still true.
//
// That is the third dead homepage in this repository's history. The other two
// were whole modules, and the header of the module report describes them as
// "noticed three separate times, and left there each time". This one could not
// even be noticed, because nothing looked inside a module that was itself used.
//
// ## What it looks for, and the four wrong versions that came first
//
// The shape is narrow on purpose. Four broader definitions were measured
// against this repository before this one, and each was rejected by what it
// found:
//
//   1. Names a module exposes that nothing else names -- 201 results. Most are
//      internal helpers and constants a module exports for its own use. Dead
//      surface, not dead code, and not worth a gate.
//
//   2. Named functions whose identifier appears nowhere but their declaration
//      -- 1 result, and it misses the case this exists for. The homepage
//      function's name appeared in a return list and in a test's list of
//      functions; it was referenced everywhere and called nowhere.
//
//   3. Factory-returned names never called -- 98 results, because `return {
//      fit, urgency, score, band }` is a result object, not a factory. Filtered
//      to names that are also `function` declarations in the same file: 2.
//
//   4. Factory-returned functions no *runtime* file names -- 40 results.
//      Modules legitimately export helpers so their tests can exercise them
//      directly, and this accused every one of them.
//
// Definition 3 flagged `rejectCustomerBearerFromAdminLogin`, which is **live
// and load-bearing**: Express middleware, passed by reference into
// `app.get("/admin/login", ...)` and never "called" anywhere. A gate on that
// definition would have accused a security control guarding the admin login.
//
// So both conditions are required, and each one spares a real pattern:
//
//   never called anywhere       -- spares a helper exported only for its tests,
//                                  because its tests call it.
//   never named by a runtime    -- spares middleware and any other function
//   file outside its module        passed by reference rather than invoked.
//
// Measured together: 86 factory-returned functions inspected, 1 flagged. That one
// was deleted rather than allowed, so the standing population is 85.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { withoutComments } = createRequire(import.meta.url)("../lib/sonara-comment-stripping.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

// Dead on purpose. A reason is required, for the same reason the module report
// requires one: "it is fine" is what every one of these looks like until it is
// not.
const ALLOWED = new Map([
  // Empty. The one this report found was deleted rather than listed, which is
  // what the list is for -- making the choice explicit rather than letting
  // "unused" become a resting state.
]);

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, found);
    } else if (/\.(cjs|mjs|js)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const libAndRoutes = [...walk(path.join(root, "lib")), ...walk(path.join(root, "routes"))];
const candidates = libAndRoutes.filter((file) => /\.cjs$/.test(file));

// Runtime is what ships. scripts/ and tests/ name things without using them --
// a test listing a function to assert which module it lives in is not a caller.
const runtimeFiles = new Set([
  ...libAndRoutes,
  ...walk(path.join(root, "api")),
  path.join(root, "server.js")
].filter((file) => fs.existsSync(file)));

const everything = [
  ...libAndRoutes,
  ...walk(path.join(root, "api")),
  ...walk(path.join(root, "scripts")),
  ...walk(path.join(root, "tests")),
  path.join(root, "server.js")
].filter((file) => fs.existsSync(file));

if (candidates.length === 0) {
  console.error("ERROR: no modules found under lib/ or routes/; this report has gone blind rather than found nothing");
  process.exit(1);
}

const sources = new Map(everything.map((file) => [file, withoutComments(fs.readFileSync(file, "utf8"))]));

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let inspected = 0;
const dead = [];

for (const candidate of candidates) {
  const own = sources.get(candidate);
  if (!own) continue;

  // A factory's return: `return {` at two-space indent, entries at four, closed
  // by `};`. Three or more entries, because a two-entry return is a result.
  for (const block of own.matchAll(/\n {2}return \{\n([\s\S]*?)\n {2}\};/g)) {
    const names = [...block[1].matchAll(/^ {4}([A-Za-z_$][\w$]*),?\s*$/gm)].map((match) => match[1]);
    if (names.length < 3) continue;

    for (const name of names) {
      const escaped = escape(name);
      const declaration = new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\(`);
      // Only functions this module declares. A returned data field is not a
      // function nobody calls; it is a value.
      if (!declaration.test(own)) continue;

      inspected += 1;

      let calledAnywhere = false;
      let namedByRuntimeOutside = false;

      for (const [file, source] of sources) {
        // The declaration is not a call. Removed before asking, or every
        // function would look like it calls itself.
        const body = file === candidate
          ? source.replace(new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\(`, "g"), " ")
          : source;

        if (new RegExp(`\\b${escaped}\\s*\\(`).test(body)) calledAnywhere = true;
        if (file !== candidate && runtimeFiles.has(file) && new RegExp(`\\b${escaped}\\b`).test(source)) {
          namedByRuntimeOutside = true;
        }
        if (calledAnywhere && namedByRuntimeOutside) break;
      }

      if (!calledAnywhere && !namedByRuntimeOutside) {
        dead.push(`${path.relative(root, candidate)} :: ${name}`);
      }
    }
  }
}

// The guard against measuring nothing. Every claim below is satisfied by a run
// that inspected no functions at all, which is what a changed factory style or
// a broken regex would look like from here.
if (inspected < 40) {
  console.error(`ERROR: only ${inspected} factory-returned functions inspected; there were 85 after the one it found was deleted, so the scan has stopped matching rather than the shape having gone`);
  process.exit(1);
}

const unexplained = dead.filter((entry) => !ALLOWED.has(entry));

console.log(`Factory-returned functions inspected: ${inspected}`);
console.log(`Files searched: ${sources.size}, of which runtime: ${runtimeFiles.size}`);
console.log(`Called by nothing and named by no runtime file: ${dead.length}${ALLOWED.size ? `, of which ${ALLOWED.size} are allowed with a reason` : ""}`);
for (const entry of dead) {
  const reason = ALLOWED.get(entry);
  console.log(`  ${entry}${reason ? ` -- allowed: ${reason}` : ""}`);
}

if (checkOnly && unexplained.length) {
  console.error("");
  console.error("ERROR: a factory hands these out and nothing takes them. They are called nowhere,");
  console.error("including by their own module and their own tests, and no runtime file names them");
  console.error("even as a value. That is unreachable rather than merely unused. Delete them, or add");
  console.error("each to ALLOWED in this script with the reason it stays.");
  for (const entry of unexplained) console.error(`  ${entry}`);
  process.exit(1);
}

if (checkOnly) console.log("Every function a factory returns is reachable.");

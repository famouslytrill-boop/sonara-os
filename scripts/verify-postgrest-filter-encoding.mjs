#!/usr/bin/env node
// Every value interpolated into a PostgREST filter is encoded before it gets
// there.
//
// This application builds its database queries as strings:
//
//     `?select=*&organization_id=eq.${encodeURIComponent(context.organizationId)}&limit=1`
//
// PostgREST reads `&`, `=`, `,` and `.` as syntax. A value carrying one of them
// does not error -- it becomes **more query**. An unencoded value in a filter is
// therefore the same class of thing as an unparameterised SQL string, and it
// matters more here than in most codebases for one specific reason: every one of
// these requests goes out with the service-role key, which bypasses row level
// security. The `organization_id=eq.` clause is not a convenience. On these
// paths it is the entire tenant boundary, and a value that can add `&or=(...)`
// to the query is a value that can widen it.
//
// ## Why this is a gate and not a fix
//
// When this was first swept, on 3 September 2026, there were 365 filter
// interpolations in the runtime and **not one of them was exploitable**. That is
// worth saying plainly, because it is the reason this check exists rather than a
// patch. Of the thirteen not encoded at the point of use:
//
//   - four were `context.organizationId` in the prompt library, a value read out
//     of the database for the signed-in user. Encoded now, because it cost
//     nothing and it was the only place in the runtime spelling it that way;
//   - four in `sonara-last9-routes.cjs` used a variable encoded once, at its
//     declaration, and reused. Encoding again at the call site would
//     double-encode and break the query;
//   - the rest were values structurally unable to carry syntax -- a date sliced
//     to ten characters, a key from a fixed set.
//
// So the property held three different ways, and only one of them is checkable
// by reading the line. That is the problem. A property maintained by reasoning
// has to be re-reasoned by every person who touches it, and this repository's
// recurring defect is exactly the reasoning that reads correct and is not.
//
// This makes the common case checkable and forces the rest to be written down.
// The register below is two-sided: an unaccounted site fails, and an entry that
// no longer describes anything fails too, because a stale exemption is what the
// next person reads instead of checking.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// PostgREST's filter operators. `not.` prefixes any of them and is matched by
// the same rule because the value still sits after the final dot.
const OPERATORS = "eq|neq|gt|gte|lt|lte|like|ilike|match|imatch|in|is|isdistinct|fts|plfts|phfts|wfts|cs|cd|ov|sl|sr|nxr|nxl|adj";

const FILTER = new RegExp(String.raw`([a-z_][a-z_0-9]*)=(?:not\.)?(${OPERATORS})\.\$\{([^}]*)\}`, "g");

// Anything that puts the value through an encoder before it lands in the string.
// `enc` is the local alias several route files declare for encodeURIComponent.
const ENCODED_HERE = /encodeURIComponent\s*\(|\benc\s*\(|\bencodeUri/;

// Sites where the value reaches the template already encoded, or cannot carry
// PostgREST syntax at all. Each entry names the file, the variable, and the
// reason -- and each is checked against the source, so a reason that has stopped
// being true fails rather than covering for something new.
const ACCOUNTED = Object.freeze({
  "routes/sonara-last9-routes.cjs": {
    variables: ["employeeId"],
    // `const employeeId = encodeURIComponent(me.profile.id);`
    requires: /const employeeId = encodeURIComponent\(/,
    note: "encoded once at its declaration and reused; encoding again at each use would double-encode the value"
  },
  "lib/sonara-owner-record-pages.cjs": {
    variables: ["businessDate"],
    // `const businessDate = String(day?.business_date || "").slice(0, 10);`
    requires: /const businessDate = String\([^)]*\)\.slice\(0, 10\)/,
    note: "a date column sliced to ten characters, so it cannot carry a separator whatever the column holds"
  }
});

const failures = [];
function fail(message) { failures.push(message); }

function sourceFiles() {
  const files = [];
  for (const dir of ["lib", "routes"]) {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (name.endsWith(".cjs") || name.endsWith(".js")) files.push(path.join(dir, name));
    }
  }
  files.push("server.js");
  return files;
}

const files = sourceFiles();
let interpolations = 0;
let encodedHere = 0;
const usedEntries = new Set();
const usedVariables = new Set();

for (const rel of files) {
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const lines = source.split("\n");
  const entry = ACCOUNTED[rel];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(FILTER)) {
      const [, column, operator, expression] = match;
      interpolations += 1;
      if (ENCODED_HERE.test(expression)) { encodedHere += 1; continue; }

      // The bare identifier the expression resolves to, for matching against
      // the register. Anything more complicated than a name or a property path
      // is not accounted for by a variable entry.
      const name = /^[A-Za-z_$][\w$]*$/.test(expression.trim()) ? expression.trim() : null;
      if (entry && name && entry.variables.includes(name)) {
        usedEntries.add(rel);
        usedVariables.add(`${rel}:${name}`);
        continue;
      }

      fail(
        `${rel}:${index + 1} interpolates ${expression} into ${column}=${operator}. without encoding it. ` +
        "PostgREST reads & = , and . as syntax, and these requests carry the service-role key, so a value that " +
        "can extend the query can widen the tenant filter. Wrap it in encodeURIComponent(), or -- if it is " +
        "already encoded upstream -- record it in ACCOUNTED in scripts/verify-postgrest-filter-encoding.mjs " +
        "with the reason."
      );
    }
  });
}

// The other side of the register. An entry whose file no longer has that
// unencoded use, or whose stated reason no longer appears in the source, is
// removed rather than left to be read as still true.
for (const [rel, entry] of Object.entries(ACCOUNTED)) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`ACCOUNTED names ${rel}, which no longer exists. Remove the entry.`);
    continue;
  }
  const source = fs.readFileSync(full, "utf8");
  if (!entry.requires.test(source)) {
    fail(
      `ACCOUNTED says ${rel} is safe because ${entry.note}, and the source no longer matches ${entry.requires}. ` +
      "Either the guarantee moved or it is gone; a wrong reason inside an exemption is what the next person reads " +
      "instead of checking."
    );
  }
  for (const variable of entry.variables) {
    if (!usedVariables.has(`${rel}:${variable}`)) {
      fail(
        `ACCOUNTED excuses ${variable} in ${rel}, and nothing there interpolates it into a filter unencoded any more. ` +
        "Remove it from the register."
      );
    }
  }
  if (!usedEntries.has(rel)) fail(`ACCOUNTED names ${rel} and nothing in it needed the exemption. Remove the entry.`);
}

// This check has gone blind if it is suddenly finding almost nothing. 365
// interpolations across 187 files on the day it was written; both floors are far
// below that and far above zero.
if (files.length < 100) fail(`only ${files.length} source files scanned; this check has gone blind`);
if (interpolations < 200) fail(`only ${interpolations} PostgREST filter interpolations found; this check has gone blind`);

if (failures.length) {
  for (const message of failures) process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

const excused = interpolations - encodedHere;
process.stdout.write(
  `PostgREST filter encoding verified: ${interpolations} filter values interpolated across ${files.length} runtime files, ` +
  `${encodedHere} encoded where they are used, ${excused} accounted for in the register with a reason checked against ` +
  "the source. None unaccounted.\n"
);

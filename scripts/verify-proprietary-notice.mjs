#!/usr/bin/env node
"use strict";

// Every shipped source file says who owns it.
//
// ## What this does and does not achieve, stated plainly
//
// It does **not** stop anyone copying this source. The repository is public by
// the owner's decision of 18 September 2026, so anybody can clone it, and no
// check inside the tree can change that. Writing a gate that implied otherwise
// would be the exact defect this codebase is organised around: a signal that
// reports success without being true.
//
// What a per-file notice does achieve is narrower and real. `LICENSE` sits at
// the repository root and does not travel: copy `lib/sonara-billing.cjs` into
// another project and nothing in that file says who wrote it or on what terms.
// A header travels with the file. It removes "I did not know it was
// proprietary" as a position, and it is the first thing anyone assessing a
// copied file looks for.
//
// Measured before this existed: **3 of 1,005** source files carried any
// copyright or proprietary notice -- and neither `server.js` nor `api/index.js`
// was among them. The two entry points of a product sold on paid plans.
//
// ## Why migrations are excluded
//
// `supabase/migrations/` is deliberately out of scope. 119 of those files are
// content-checksummed in `supabase/applied-migration-checksums.json`, and
// `verify:applied-migrations` fails when one changes -- which is the entire
// point: an applied migration is immutable. Adding a header to them would have
// broken 119 checksums to gain a comment. Checked before editing rather than
// after.
//
// ## The holder is read from LICENSE, not repeated here
//
// If the company is ever renamed, a hardcoded string here would leave 258 files
// asserting the old name and this check would call that correct. So the expected
// holder is parsed out of `LICENSE` and the notices are compared against it.
// One source of truth, and the check fails when they drift apart.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

// The shipped runtime: what Vercel bundles and what somebody would take to run
// the product. `vercel.json` includes `public/**,routes/**,lib/**`, and the
// entry points are server.js and api/index.js.
const TRACKED_GLOBS = [
  "server.js",
  "api/*.js", "api/*.cjs", "api/*.mjs",
  "routes/*.js", "routes/*.cjs", "routes/*.mjs",
  "lib/*.js", "lib/*.cjs", "lib/*.mjs"
];

// How far into a file the notice may sit. A shebang, and nothing else, may
// precede it.
const HEADER_LINES = 6;

// Measured 18 September 2026: 258 files in this population.
const MINIMUM_FILES = 150;

function licenceHolder() {
  const licensePath = path.join(root, "LICENSE");
  if (!fs.existsSync(licensePath)) {
    return { ok: false, reason: "LICENSE does not exist, so there is no holder to check notices against" };
  }
  const text = fs.readFileSync(licensePath, "utf8");
  const match = text.match(/Copyright \(c\)\s*(\d{4})\s+([^\n.]+?)\.?\s*(?:All rights reserved)/i);
  if (!match) {
    return {
      ok: false,
      reason: "could not read a `Copyright (c) <year> <holder>. All rights reserved` line out of LICENSE, "
        + "so the notices cannot be compared to anything"
    };
  }
  return { ok: true, year: match[1], holder: match[2].trim() };
}

const holder = licenceHolder();
if (!holder.ok) {
  console.error(`Proprietary notice check failed: ${holder.reason}.`);
  console.error("This check exists to keep every file's notice agreeing with LICENSE. It refuses to guess the holder.");
  process.exit(1);
}

const files = execFileSync("git", ["ls-files", ...TRACKED_GLOBS], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.startsWith("archive/"));

const problems = [];
const missing = [];
const wrongHolder = [];
let examined = 0;

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    continue;
  }
  examined += 1;
  const head = text.split("\n").slice(0, HEADER_LINES).join("\n");

  if (!/all rights reserved/i.test(head)) {
    missing.push(file);
    continue;
  }
  // The notice is present; does it name the same holder as LICENSE?
  if (!head.includes(holder.holder)) {
    wrongHolder.push(file);
  }
}

if (examined < MINIMUM_FILES) {
  problems.push(
    `Only ${examined} shipped source file(s) examined, below the ${MINIMUM_FILES} present on 18 September 2026.\n`
    + "    Either `git ls-files` returned almost nothing or the glob list stopped matching the tree.\n"
    + "    A notice check that reads nothing reports every file compliant, which is how 1,002 of them had none."
  );
}

if (missing.length) {
  problems.push(
    `${missing.length} shipped source file(s) carry no "All rights reserved" notice in their first ${HEADER_LINES} lines:\n`
    + missing.slice(0, 20).map((file) => `      ${file}`).join("\n")
    + (missing.length > 20 ? `\n      ... and ${missing.length - 20} more` : "")
    + "\n\n    LICENSE does not travel with a copied file. Add, after any shebang and before any\n"
    + `    "use strict" directive:\n\n`
    + `      // Copyright (c) ${holder.year} ${holder.holder}. All rights reserved.\n`
    + "      // Proprietary source. No licence is granted; see LICENSE."
  );
}

if (wrongHolder.length) {
  problems.push(
    `${wrongHolder.length} file(s) carry a notice that does not name the holder LICENSE declares (${holder.holder}):\n`
    + wrongHolder.slice(0, 20).map((file) => `      ${file}`).join("\n")
    + "\n\n    A notice naming the wrong owner is worse than none: it is the statement somebody relies on.\n"
    + "    Either the company was renamed and these were missed, or LICENSE was changed and these were not."
  );
}

if (problems.length) {
  console.error(`Proprietary notice check failed on ${problems.length} point(s).\n`);
  console.error(problems.map((problem) => `  - ${problem}`).join("\n\n"));
  process.exit(1);
}

console.log(
  `Proprietary notice verified: ${examined} shipped source file(s) name ${holder.holder} `
  + `and reserve all rights, matching LICENSE. `
  + "This makes a copied file attributable; it does not make the source uncopyable, and nothing in a public repository could."
);

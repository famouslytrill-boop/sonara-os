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

// ## What this does NOT guarantee: prompt delivery to a browser
//
// `lib/sonara-page-frame.cjs` requests `/sonara-one.js?v=sonara-ui-20260914-v12-palette`,
// and `server.js:316` serves anything carrying a `?v=` with
// `public, max-age=31536000, immutable`. Adding these notices changed the bytes
// without changing the token, so a browser that already holds the old file can
// keep serving it for up to a year. Codex raised this on PR #299 and the
// mechanism is exactly as described.
//
// The token is deliberately NOT bumped for this, and the reasoning is recorded
// rather than left as an omission. A notice exists so that a *copied file* is
// attributable. Somebody copying this source takes it from the repository, from
// a fresh load, or from devtools -- not from a year-old entry in one visitor's
// cache -- and every new visitor receives the current bytes. Bumping the shared
// token would invalidate every cached asset for every visitor, and the service
// worker version with it (`verify:customer-ready-production-experience` asserts
// the two match), to deliver a two-line comment.
//
// The one case where cache staleness WOULD matter is the customer export, and
// it does not apply: `routes/sonara-scroll-routes.cjs` reads
// `public/sonara-scroll.js` from disk at require time, so every export ships
// current bytes regardless of any browser cache. That file is excluded here for
// a different reason -- see CUSTOMER_DISTRIBUTED below.
//
// If the notices ever need to be served promptly -- a dispute, say -- the fix is
// to bump the token in `lib/sonara-page-frame.cjs` and the matching `VERSION` in
// `public/sw.js` together. That is a deliberate act with a cost, not a
// housekeeping step, which is why it is written down instead of done quietly.

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
  "lib/*.js", "lib/*.cjs", "lib/*.mjs",
  // Browser-side source. Added 18 September 2026 after Codex pointed out on
  // PR #297 that the comment above named `public/**` as shipped and the glob
  // list then left it out -- shape 2 in .claude/skills/checks-that-cannot-lie,
  // a scan measuring a different population from the one it claims. All 21
  // tracked public JavaScript files had no notice and the check passed.
  //
  // These are the files most likely to be copied, because a browser hands the
  // reader the source. None is generated: nothing under `scripts/` writes into
  // `public/`, checked before editing them.
  "public/*.js", "public/**/*.js"
];

// One file in that population is EXCLUDED, and this is the most important
// comment in this file.
//
// `public/sonara-scroll.js` is not only served to browsers -- it is *given to
// customers*. `routes/sonara-scroll-routes.cjs:57` reads it and
// `lib/sonara-scroll-export.cjs` writes it into every Creator Studio site
// export as `scroll.js`, beside a README that tells the customer "A static
// site. Put these files on any web host and it works... Drop the whole folder
// in."
//
// Adding "No licence is granted" to that file put a sentence denying
// permission inside a file the product hands the customer and instructs them to
// deploy. That is not a notice, it is a contradiction of what they paid for,
// and it was introduced by widening this population on PR #299. Codex caught it
// before it reached anybody. The notice was removed from the file and the file
// excluded here.
//
// Giving that runtime an explicit customer-facing licence grant is a different
// act: AGENTS.md reserves legal and policy publishing to the owner, and no
// check may write a grant on their behalf. So this excludes rather than
// re-licenses, and the gap is named for them to close.
const CUSTOMER_DISTRIBUTED = Object.freeze({
  "public/sonara-scroll.js":
    "Shipped to customers as scroll.js inside every Creator Studio site export (lib/sonara-scroll-export.cjs), with a README instructing them to host it anywhere. A no-licence notice here denies the customer the right the export exists to give them. Needs an owner decision on a runtime licence grant, not a notice."
});

// Not included, deliberately, so the decision is visible rather than absent:
// the 4 tracked stylesheets and 1 HTML file under `public/`. A stylesheet is
// arguably the same case as a script and could be added; page markup is a
// different question, since a rendered page is public by construction. Neither
// was in the finding this population was widened for, and widening a check
// past what was established is how a check ends up asserting more than anyone
// verified. Left as a named choice for whoever decides it.

// How far into a file the notice may sit. A shebang, and nothing else, may
// precede it.
const HEADER_LINES = 6;

// Measured 18 September 2026: 279 files (258 server-side plus 21 browser-side),
// less the 1 customer-distributed exclusion below = 278 examined.
//
// The floor was 150 when the population was 258, and stayed 150 when the public
// scripts were added. Codex pointed out on PR #299 what that means: if the two
// `public/` pathspecs are ever removed or stop matching, the check falls back to
// the 258 server-side files, sails past a floor of 150, and reports every file
// compliant -- recreating the exact blind spot widening the population was
// meant to close. A floor far below the population is not a floor.
//
// So it ratchets to the measurement, and the browser-side half gets its own
// floor, because that half is the one that was missing and the one a single
// edited glob would silently drop.
// An EXACT expected count, not a floor, and this is the third attempt at it.
//
// 150 while the population was 258, then still 150 at 279 -- Codex pointed out
// that a floor far below its population floors nothing. Raised to 278, and
// Codex pointed out that adding `lib/sonara-env-value-checks.cjs` had already
// made it 279, so deleting any one covered file would still pass. That is the
// same defect twice: any fixed floor below the measurement leaves exactly that
// much slack, and it reappears the moment somebody adds a file.
//
// So this asserts equality in BOTH directions. Too few means a glob stopped
// matching or a file lost its notice; too many means the population grew and
// nobody looked. The second is not a failure of the code, it is a prompt to
// re-read this constant deliberately -- which is the only way it stays a
// measurement rather than a guess.
// Batch 13 raised the measured population to 280. Batch 14 then added one
// shipped research module and Platform Foundation v1 added one shipped kernel,
// taking the exact population to 282. Batch 15 adds four governed shipped
// runtime/research modules; exact-head CI measured 286 covered source files.
// The September 20 governed market-intelligence module added one more shipped
// proprietary source file, taking the exact covered population to 287. Backend
// Operations Research Pass #3 adds one governed shipped research module, taking
// the exact covered population to 288. Backend Operations Market Analysis Pass
// #4 adds one governed shipped research module, taking the exact covered
// population to 289. Frontend Visual Operations Intelligence adds one governed
// shipped research module, taking the combined exact covered population to 290.
// PR #330's consolidated backend/auth/repository work brought the exact
// shipped-source population to 292. Batch 16 adds one governed shipped research
// module, and exact-head CI measured the current population at 293.
const EXPECTED_FILES = 293;
const EXPECTED_PUBLIC_FILES = 20;

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

const tracked = execFileSync("git", ["ls-files", ...TRACKED_GLOBS], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => !file.startsWith("archive/"));

const files = tracked.filter((file) => !Object.prototype.hasOwnProperty.call(CUSTOMER_DISTRIBUTED, file));

// Two-sided, like every other exemption here: an excluded file that is no
// longer tracked excludes nothing, and is read instead of checked.
const staleExclusions = Object.keys(CUSTOMER_DISTRIBUTED).filter((file) => !tracked.includes(file));

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

const examinedPublic = files.filter((file) => file.startsWith("public/")).length;

if (staleExclusions.length) {
  problems.push(
    `${staleExclusions.length} customer-distributed exclusion(s) name a file git no longer tracks:\n`
    + staleExclusions.map((file) => `      ${file}\n        reason on file: ${CUSTOMER_DISTRIBUTED[file]}`).join("\n")
    + "\n\n    An exclusion that protects nothing is what the next reader believes instead of checking.\n"
    + "    Either the file moved -- update the name -- or it is gone, and the entry should go with it."
  );
}

if (examinedPublic !== EXPECTED_PUBLIC_FILES) {
  problems.push(
    `${examinedPublic} browser-side file(s) examined under public/, and EXPECTED_PUBLIC_FILES says ${EXPECTED_PUBLIC_FILES}.\n`
    + (examinedPublic < EXPECTED_PUBLIC_FILES
      ? "    Fewer: the public/ pathspecs have stopped matching, or a file was removed. The server-side files alone\n"
        + "    would satisfy any overall count, so without this second assertion the browser half could vanish from the\n"
        + "    population in silence -- which is how 21 shipped files had no notice while this check reported success."
      : "    More: browser-side files were added and now carry the notice. Update EXPECTED_PUBLIC_FILES to match, having\n"
        + "    first checked whether any of them is distributed to customers -- see CUSTOMER_DISTRIBUTED above.")
  );
}

if (examined !== EXPECTED_FILES) {
  problems.push(
    `${examined} shipped source file(s) examined, and EXPECTED_FILES says ${EXPECTED_FILES}.\n`
    + (examined < EXPECTED_FILES
      ? "    Fewer: either `git ls-files` returned almost nothing, the glob list stopped matching the tree, or a covered\n"
        + "    file was deleted. A notice check that reads nothing reports every file compliant, which is how 1,002 of\n"
        + "    them had none."
      : "    More: shipped source files were added and carry the notice, which is the good case. Update EXPECTED_FILES to\n"
        + "    match. This asserts equality rather than a floor precisely so that growth is noticed instead of absorbed\n"
        + "    as slack -- twice now, a floor below the population hid exactly the gap it was raised to close.")
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
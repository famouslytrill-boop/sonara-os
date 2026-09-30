#!/usr/bin/env node
"use strict";

// Every repository on the GitHub radar still requires a human before anything
// installs it.
//
// `data/github-radar-repos.ts` holds 15 external repositories under review. Each
// record carries five safety fields: `autoInstall`, and four review flags for the
// owner, legal, security and privacy. AGENTS.md is explicit about what they are
// for -- "Keep screenshot-sourced records non-executing until a separate
// implementation review explicitly promotes them", and external package managers
// and agent frameworks "do not replace SONARA's pnpm, Provider Gateway,
// agent-authority, or controlled-deployment contracts without an explicit
// architecture decision".
//
// ## What was actually checking them, measured 30 September 2026
//
// Four scripts read this file: check-github-radar.mjs, check-github-radar-risk.mjs,
// check-repo-score-thresholds.mjs and check-blocked-repo-claims.mjs. **Nothing ran
// any of them.** No package.json script, no workflow and no test named one; the
// only caller was scripts/verify-all.mjs, which nothing runs either and which dies
// on its second command because 24 of the 34 pnpm scripts it lists no longer
// exist. Two more, check-auto-install-disabled.mjs and check-github-radar-secrets.mjs,
// read `lib/github-radar/*.ts` -- a directory this repository does not have -- and
// exited with ENOENT.
//
// One of the four was also too weak to catch the thing it was written for, which
// is shape 6 in .claude/skills/checks-that-cannot-lie. check-github-radar.mjs
// asked whether the **file** contained the string `autoInstall: false`, once:
//
//     for (const required of ["autoInstall: false", "ownerReviewRequired", ...])
//       if (!text.includes(required)) findings.push(...);
//
// Fourteen of the fifteen records could have carried `autoInstall: true` and it
// would have passed, because the fifteenth still says false. `ownerReviewRequired`
// was checked as a bare substring -- the field NAME -- so every record could have
// set it to `false` and the check would have found the name and been satisfied.
//
// ## The hole that was actually open
//
// `verify:ts-contracts` does type-check this file, and the type declares
// `autoInstall: false` as a literal, so TypeScript already refuses `true`. That is
// the one field that was genuinely protected. The four review flags are declared
// `boolean`, so `ownerReviewRequired: false` type-checks cleanly, passes every gate
// in the release chain, and was checked by nothing. All fifteen records set all
// four to true today -- by convention, not by enforcement.
//
// So this gate asserts the flags per record, and asserts that the literal type on
// `autoInstall` is still a literal, because widening it to `boolean` would remove
// the only check that field had without breaking anything visible.
//
// It also carries the three per-record properties the unrun scripts did have, which
// were reasonable and are not covered anywhere else:
//
//   * a blocked record must use the blocked integration status;
//   * a blocked record must not recommend integrating;
//   * a score must be inside 0-100.
//
// One difference from the script it replaces: the licence test reads the declared
// `license` field rather than matching the whole record, because the old version
// matched `recommendedAction` prose. "Review as GPL-licensed reference" is a
// sentence about a licence, not a licence, and a check that cannot tell the
// difference is a check somebody switches off.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = "data/github-radar-repos.ts";

// 15 records on 30 September 2026. The floor is below that and far above zero, so
// a record split that stops matching cannot pass by finding nothing (shape 1).
const MINIMUM_RECORDS = 10;

// Declared `boolean` in the type, so nothing but this gate stops one being false.
const REVIEW_FLAGS = ["ownerReviewRequired", "legalReviewRequired", "securityReviewRequired", "privacyReviewRequired"];

// A licence that needs a lawyer before the code is used in a hosted product.
// Reciprocal licences trigger on network use, which is exactly what this product
// is; "no licence declared" is all rights reserved, which nobody here can grant.
const LICENCE_NEEDS_LEGAL = /AGPL|GPL|LGPL|OSL|SSPL|non-?commercial|CC BY-NC|no licen[cs]e|unlicensed|unknown|verify/i;

const source = fs.readFileSync(path.join(root, DATA), "utf8");
const failures = [];

// The literal type, not the data. `autoInstall: false` as a literal is the only
// guarantee TypeScript itself enforces here, and widening it to `boolean` would
// silently delete it.
if (!/^\s*autoInstall:\s*false;\s*$/m.test(source)) {
  failures.push(
    `${DATA} no longer declares autoInstall as the literal type \`false\`. That literal is what makes ` +
    "`autoInstall: true` a compile error in verify:ts-contracts; widening it to boolean removes the guarantee " +
    "without breaking anything visible."
  );
}

const marker = "githubRadarRepos: GitHubRadarRepo[] = [";
const start = source.indexOf(marker);
if (start === -1) {
  console.error(`ERROR: ${DATA} has no \`${marker}\` array. The record split has nothing to read.`);
  process.exit(1);
}

const records = source.slice(start).split(/\n  \{/).slice(1);
if (records.length < MINIMUM_RECORDS) {
  console.error(
    `ERROR: only ${records.length} radar record(s) parsed from ${DATA}, against a floor of ${MINIMUM_RECORDS}. ` +
    "The record split has gone blind and a clean result here would mean nothing."
  );
  process.exit(1);
}

let blockedCount = 0;

for (const record of records) {
  const name = /name: "([^"]+)"/.exec(record)?.[1] ?? "(unnamed record)";

  for (const flag of REVIEW_FLAGS) {
    if (!new RegExp(`${flag}:\\s*true`).test(record)) {
      const declared = new RegExp(`${flag}:\\s*(\\w+)`).exec(record)?.[1];
      failures.push(
        `${name}: ${flag} is ${declared ?? "absent"}, and must be true.\n` +
        "    The type declares it boolean, so false compiles and passes every other gate. A radar record that " +
        "needs no review is a repository somebody can adopt without one."
      );
    }
  }

  if (!/autoInstall:\s*false/.test(record)) {
    failures.push(`${name}: autoInstall is not false. Nothing on this register installs itself.`);
  }

  const blocked = /blocked:\s*true/.test(record);
  const integrationStatus = /integrationStatus: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";
  const action = /recommendedAction: "([^"]*)"/.exec(record)?.[1] ?? "";
  const licence = /license: "([^"]*)"/.exec(record)?.[1] ?? "";
  const licenceRisk = /licenseRisk: "([^"]+)"/.exec(record)?.[1] ?? "(absent)";
  const score = Number(/score: (-?\d+)/.exec(record)?.[1] ?? Number.NaN);

  if (blocked) {
    blockedCount += 1;
    if (integrationStatus !== "blocked") {
      failures.push(
        `${name}: blocked: true with integrationStatus "${integrationStatus}". A record blocked in one field and ` +
        "queued in another is read as queued by whatever looks at the status."
      );
    }
    if (!/^do not /i.test(action) && /(integrate|ship|enable|install|adopt)/i.test(action)) {
      failures.push(`${name}: blocked record recommends "${action}". A blocked record cannot recommend adopting it.`);
    }
    if (!/blockedReason: "/.test(record)) {
      failures.push(`${name}: blocked: true with no blockedReason. "Blocked" without a reason is what the next person reads instead of checking.`);
    }
  }

  if (LICENCE_NEEDS_LEGAL.test(licence) && licenceRisk === "allowed" && !/legalReviewRequired:\s*true/.test(record)) {
    failures.push(
      `${name}: license "${licence}" is recorded as licenseRisk "allowed" with no legal review required. ` +
      "A reciprocal licence triggers on network use, which is what this product is, and no declared licence is all " +
      "rights reserved."
    );
  }

  if (!Number.isFinite(score) || score < 0 || score > 100) {
    failures.push(`${name}: score is ${Number.isFinite(score) ? score : "absent or unparseable"}, outside 0-100.`);
  }
}

if (failures.length > 0) {
  console.error(`GitHub radar review flags are not all in order (${failures.length} finding(s)):\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log(
  `GitHub radar review flags verified: ${records.length} repository records in ${DATA}, each with all four review ` +
  `flags true and autoInstall false, ${blockedCount} blocked with a reason and a matching integration status, ` +
  "every score inside 0-100, and the autoInstall literal type intact."
);

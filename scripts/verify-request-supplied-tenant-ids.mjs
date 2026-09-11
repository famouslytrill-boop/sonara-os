#!/usr/bin/env node
"use strict";

// Which code may take a tenant id from the caller, and why.
//
// The service-role key bypasses row-level security, so `organization_id` IS the
// tenant boundary. `scripts/report-tenant-scoped-queries.mjs` already checks
// that a query NAMES an organization -- but naming one and naming the RIGHT one
// are different properties, and only the first is visible in a query string.
//
// That gap was not theoretical. `POST /api/business-builder/employees/invite`
// read `body.organizationId` with the caller's verified membership as a mere
// fallback, so a manager of their own workspace could invite somebody into
// another business entirely; `acceptBusinessEmployeeInvite` then copied that id
// into an active `business_memberships` row, which
// `getCustomerPrimaryOrganization` hands back as the organization a signed-in
// customer belongs to. Every query involved named an organization. The check
// that asks whether one is named could never have caught it, which makes it
// defect six in `.claude/skills/checks-that-cannot-lie` -- too weak for the bug
// it exists for -- and this is the missing half rather than a replacement.
//
// So: reading a tenant id out of a request is allowed, and is exactly four
// places, each with a reason written down. The register is TWO-SIDED, because
// only one direction was the problem and the other is how the reasons rot:
//
//   * A file that reads one and is not registered fails. That is the shape of
//     the bug -- a fifth site nobody looked at.
//   * A registered file whose count moved fails too, in EITHER direction. A
//     rise is a new unreviewed read; a fall means the reason may now describe
//     nothing, and `report-orphan-tables.mjs` is the precedent for treating
//     that as a finding rather than a tidy-up.
//
// WHAT THIS DOES NOT DO, SAID PLAINLY
//
// It catches an unreviewed read ARRIVING. It does not catch a registered read
// being MISUSED: the invite module is allowed four reads, and this would still
// pass if somebody rewrote what those four do. Nothing static can read intent,
// and the guarantee that covers it is
// `tests/an-employee-invite-is-a-credential.test.js`, which refuses a body
// naming another tenant and fails on the exact original line.
//
// This is written down because a check whose stated guarantee is wider than
// what it does is the defect the whole skill is about, and the version of that
// mistake available here was to call this "every tenant id is verified".

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const { withoutComments } = createRequire(import.meta.url)("../lib/sonara-comment-stripping.cjs");
const SOURCE_DIRS = ["lib", "routes", "api"];
const SOURCE_FILES = ["server.js"];

// A tenant id arriving from the caller: the request body, the query string, or
// the workspace header. All three are things the person making the request
// chooses, which is the property that matters -- not which of them it is.
const REQUEST_TENANT_READ =
  /\b(?:req\s*)?(?:\.)?(?:body|query)\s*\??\.\s*(organizationId|organization_id|workspaceId|workspace_id)\b|req\s*\.\s*get\s*\(\s*["']x-business-workspace-id["']\s*\)/g;

// Each entry says what the file does with the id and why that is not the
// invite bug. `reads` is the exact number of reads expected, so a new one in an
// already-registered file is caught too -- the invite module is precisely where
// a fifth read would be added by somebody who saw four already there.
const ALLOWED = [
  {
    file: "server.js",
    reads: 5,
    reason:
      "getBusinessWorkspaceId collects the workspace the request asks for and hands it to " +
      "isBusinessManagerUser, which filters `workspace_id=eq.` on the caller's own memberships. " +
      "The id is a REQUEST, not an authority: it narrows a query against rows that are already " +
      "the caller's, and a workspace they do not belong to returns nothing."
  },
  {
    file: "lib/sonara-business-employee-invites.cjs",
    reads: 4,
    reason:
      "The site the fix was written for. Both ids are read ONLY to compare against the verified " +
      "membership: a request naming a different tenant is refused with `tenant_mismatch`, and the " +
      "values written come from `req.sonaraBusinessMembership`. A platform admin is the exception " +
      "and may name a tenant, because `requireBusinessManager` sets `sonaraAdmin` only after " +
      "`isSupabaseAdminUser` passes."
  },
  {
    file: "routes/sonara-last9-routes.cjs",
    reads: 1,
    reason:
      "A development convenience, inert in production regardless of its variable: " +
      "SONARA_ALLOW_MANUAL_ORG_ID must be 'true' AND NODE_ENV must not be production AND " +
      "VERCEL_ENV must not be production. The comment above it records that gating on the " +
      "variable alone made one wrong dashboard value a cross-tenant write hole."
  },
  {
    file: "routes/sonara-service-lifecycle-routes.cjs",
    reads: 1,
    reason:
      "POST /admin/deliverables sits behind requireAdmin, so the caller is a platform admin who " +
      "administers every organization. Naming one is the point of the form, and the value is " +
      "UUID-checked before use."
  }
];

// Comments are stripped before matching, using lib/sonara-comment-stripping.cjs
// rather than a copy. A prose mention of `body.organizationId` in a comment
// explaining this very bug would otherwise be counted as a read -- not
// hypothetical: an earlier check on this branch matched its own explanatory
// comment in the block it was grepping, and a break below confirms the invite
// module's count rises from four to five without the stripping.
//
// The first draft of this file DID keep its own copy, and did it in two passes
// -- block comments then line comments -- which is precisely the bug that
// module exists for and that
// tests/a-line-comment-cannot-open-a-block-comment.test.js caught on the first
// full run. Four copies of one function is four chances for one of them to be
// subtly wrong, and the wrong one is the one nobody re-reads.

function sourceFiles() {
  const files = [...SOURCE_FILES];
  for (const dir of SOURCE_DIRS) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (!/\.(cjs|mjs|js)$/.test(name)) continue;
      files.push(path.join(dir, name));
    }
  }
  return files;
}

const files = sourceFiles();
const problems = [];

// Shape 1: a check satisfied by reading nothing.
if (files.length < 40) {
  console.error(`Only ${files.length} runtime files found. This check has gone blind; it should see the whole runtime.`);
  process.exit(1);
}
if (ALLOWED.length === 0) {
  console.error("The register is empty, so every read would be a finding and none would be reviewed.");
  process.exit(1);
}

const found = new Map();
for (const relative of files) {
  const source = withoutComments(fs.readFileSync(path.join(root, relative), "utf8"));
  const matches = source.match(REQUEST_TENANT_READ);
  if (matches && matches.length > 0) found.set(relative, matches.length);
}

if (found.size === 0) {
  console.error("No request-supplied tenant reads found at all. The pattern has stopped matching; the four known sites cannot have vanished.");
  process.exit(1);
}

for (const [relative, count] of found) {
  const entry = ALLOWED.find((allowed) => allowed.file === relative);
  if (!entry) {
    problems.push(
      `${relative} reads a tenant id from the request ${count} time(s) and is not registered.\n` +
      "    A tenant id from the caller is not an authority. Either take it from the verified\n" +
      "    membership and refuse a mismatch, or add an entry to ALLOWED saying why this one is safe."
    );
    continue;
  }
  if (entry.reads !== count) {
    problems.push(
      `${relative} reads a tenant id ${count} time(s); the register records ${entry.reads}.\n` +
      (count > entry.reads
        ? "    A new read in an already-registered file is the easiest way to add an unreviewed one.\n" +
          "    Check it against the recorded reason, then update the count."
        : "    Fewer reads than recorded means the reason may now describe nothing. Confirm what is left\n" +
          "    still matches it, then update the count.")
    );
  }
}

for (const entry of ALLOWED) {
  if (!found.has(entry.file)) {
    problems.push(
      `${entry.file} is registered as reading a tenant id from the request and reads none.\n` +
      "    A recorded reason that describes nothing is worse than no entry, because it is what the\n" +
      "    next person reads instead of checking. Remove it."
    );
  }
  if (String(entry.reason || "").trim().length < 80) {
    problems.push(`${entry.file} has no real reason recorded. "Reviewed" is not a reason; say what makes the read safe.`);
  }
}

if (problems.length > 0) {
  console.error("Request-supplied tenant ids are not all accounted for:\n");
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

const total = [...found.values()].reduce((sum, count) => sum + count, 0);
console.log(
  `Request-supplied tenant ids verified: ${total} reads across ${found.size} files, ` +
  `each registered with a reason, out of ${files.length} runtime files scanned. ` +
  "Naming an organization and naming the right one are different properties; " +
  "verify:tenant-queries checks the first and this checks the second."
);

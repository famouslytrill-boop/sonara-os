#!/usr/bin/env node

// A document that states a count about this repository must state the true one.
//
// docs/owner/WHAT-IS-LEFT.md is what the owner reads to decide whether to
// launch. It said "pnpm test is at 1347 passing and the eighteen-command
// verify:launch chain is green" long after the suite reached 1733 tests and the
// chain reached 21 commands. Both numbers were right when written and neither
// was checked again, because a figure typed into prose has nothing watching it.
//
// docs/HANDOFF_PROMPT.md is generated and cannot drift. This is for the ones
// that are written by hand and still make countable claims.
//
// docs/SPRINT_LOG.md is excluded on purpose: it is a dated record of what was
// true on the day, and correcting its history would make it a worse record.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const check = process.argv.includes("--check");

// Generated documents cannot drift, and two of them embed SPRINT_LOG verbatim,
// so every historical "1,733 tests passing" in the log reappears in them. A
// check that reads those is reading the same history twice and calling it a
// live claim.
const EXCLUDED = new Set([
  "docs/SPRINT_LOG.md",
  "docs/HANDOFF_PROMPT.md",
  "docs/SONARA_RECOMMENDED_PRODUCT_CATALOG_2026.md",
  "docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md"
]);
// A document that opens by saying which day it describes is a record of that
// day. docs/SONARA_CURRENT_STATE_AUDIT.md says "Date: 2026-07-15" and
// docs/SONARA_PAID_LAUNCH_VERIFICATION_2026-07-16.md says "Verification date:";
// correcting their counts would make them worse records, exactly as it would
// for the sprint log. The marker has to be near the top, so a date mentioned in
// passing halfway down does not excuse a live document.
const DATED_RECORD = /^(date|audit date|verification date|analysis date|researched|checked|retrieved|surveyed)\s*:/im;
function isExcluded(file, text) {
  // docs/audits/ holds dated engineering and market audits -- 2026-07-27 is in
  // their filenames. Correcting their counts would make them worse records, the
  // same reason SPRINT_LOG is excluded, and their date is in the path rather
  // than in a Date: line the marker below would catch.
  if (EXCLUDED.has(file) || file.startsWith("docs/archive/") || file.startsWith("docs/audits/")) return true;
  return DATED_RECORD.test(String(text || "").slice(0, 400));
}

// The true numbers, read from the repository rather than remembered.
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Counted by expanding the chain, not by splitting its string on `&&`.
//
// Those were the same number while verify:launch was one flat line. Then
// everything after verify:db moved into verify:gates so CI could run the whole
// gate as one step, and this check reported the chain as **7 commands** against
// a document correctly saying 31. The check was accurate about the string and
// wrong about the thing it named.
//
// lib/sonara-release-chain.cjs follows one script into another and drops pure
// groupings, so the figure means "checks that run" and does not move when
// somebody tidies the definition.
const { chainCommands } = createRequire(path.join(root, "package.json"))("./lib/sonara-release-chain.cjs");
const commandCount = chainCommands(packageJson.scripts || {}).length;
const testFiles = fs.readdirSync(path.join(root, "tests")).filter((name) => /\.(test\.js|test\.mjs)$/.test(name)).length;

// Three more figures the owner's documents state and nothing was checking.
//
// This check shipped covering two claim shapes -- chain commands, and a raw
// passing count -- and six live figures drifted underneath it anyway:
// docs/owner/WHAT-IS-LEFT.md said 66 reviewed repositories against a register
// that had reached 82, and 302 tables against 303; docs/SHIP_READINESS.md said
// 77 migrations against 82. Every one was right when written. That is the point:
// a figure typed into prose has nothing watching it, and adding a check for one
// shape of figure does not watch the others.
//
// Only counts that can be *derived exactly* are added here. A judgement recorded
// at review time -- how many licences reach a hosted product, say -- is not
// re-derivable from the register and is deliberately left to a human.
const registerSource = fs.readFileSync(path.join(root, "data", "open-source-tools.ts"), "utf8");
const repositoryCount = (registerSource.match(/slug:\s*"/g) || []).length;
// How many registered repositories declare no licence at all.
//
// The note above says licence *interpretation* is left to a human, and it still
// is -- whether a reciprocal licence reaches a hosted product is a judgement.
// This is not that. A record whose own licence text says nothing was declared is
// a fact about the register, and the figure drifted anyway: docs/owner/WHAT-IS-LEFT.md
// said two while the register held four, which is the sort of number that gets
// quoted at somebody deciding what may be adopted.
const undeclaredLicenceCount = (registerSource.match(/license:\s*\n?\s*"(?:None declared|No licence file|No licence declared)/g) || []).length;
// How many registered repositories carry a reciprocal licence.
//
// Read from the register's own reciprocalLicense field, not from its licence
// prose. The prose cannot be searched for this: one record's licence text reads
// "it appeared in neither the permissive filter (MIT, Apache-2.0, BSD-3-Clause)
// nor the reciprocal filter (AGPL-3.0, GPL-3.0, ...)", so a substring match on
// AGPL counts the one repository that record explicitly rules out and reports
// one too many. That is the failure this file exists to prevent, not commit.
//
// docs/owner/WHAT-IS-LEFT.md quotes this figure at somebody deciding what may
// be adopted, and it drifted from 10 to 11 with nothing watching it.
const reciprocalFlags = registerSource.match(/^\s*reciprocalLicense: (true|false),$/gm) || [];
const reciprocalLicenceCount = reciprocalFlags.filter((line) => line.includes("true")).length;
// Every record must answer. An optional field lets somebody add an AGPL
// repository, omit the flag, and leave the count sitting where it was --
// a check satisfied by an absence, which is the empty-list failure in a
// different coat.
if (reciprocalFlags.length !== repositoryCount) {
  console.error(
    `ERROR: ${repositoryCount} records on the open-source register but ${reciprocalFlags.length} state reciprocalLicense; ` +
      "every record must declare whether its licence is reciprocal, or the count below is measuring a smaller population than it claims."
  );
  process.exit(1);
}
// How many tables end up with RLS enabled and no policy at all -- readable by
// nobody but the service role.
//
// Read from the set `scripts/verify-migration-replay.mjs` pins, which is not a
// hand-written list: the replay asserts it against a real PostgreSQL with all
// migrations applied, and fails if a table joins or leaves. So the chain is
// database -> replay -> here -> the document, and every link is checked.
//
// This exists because `docs/SHIP_READINESS.md` said **thirteen** while the true
// figure was twenty-five, having nearly doubled with nothing watching. The
// sentence also claimed "the deep verification reports it every run", and that
// verification needs the service-role key and had not run since 5 August.
//
// It was spelled as a word, which is precisely the blind spot the comment on
// the register patterns below records: "eight" is invisible to every pattern
// here. The replacement is a digit for that reason, and this pattern is what
// makes the digit worth writing.
const replaySource = fs.readFileSync(path.join(root, "scripts", "verify-migration-replay.mjs"), "utf8");
const closedSetMatch = /closed_set_([a-z0-9_,]+)/.exec(replaySource);
const closedCountMatch = /closed_count_(\d+)/.exec(replaySource);
if (!closedSetMatch || !closedCountMatch) {
  console.error(
    "ERROR: could not read the service-role-only table set out of scripts/verify-migration-replay.mjs. " +
      "That probe is where this figure comes from, so without it the document claim below is unguarded."
  );
  process.exit(1);
}
const serviceRoleOnlyTables = closedSetMatch[1].split(",").filter(Boolean);
const serviceRoleOnlyCount = serviceRoleOnlyTables.length;
// The probe states the figure twice, as a count and as a list. If they disagree
// the probe itself is wrong, and a document agreeing with either would be
// agreeing with something untrue.
if (Number(closedCountMatch[1]) !== serviceRoleOnlyCount) {
  console.error(
    `ERROR: verify-migration-replay.mjs expects closed_count_${closedCountMatch[1]} but lists ` +
      `${serviceRoleOnlyCount} tables. Fix that probe before trusting any document that quotes it.`
  );
  process.exit(1);
}
const migrationCount = fs.readdirSync(path.join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")).length;
// Read as a module rather than parsed: the generated file holds Sets, and
// counting quoted strings in it would count the header comment too.
const tenantModule = createRequire(path.join(root, "package.json"))("./lib/sonara-tenant-scoped-tables.cjs");
const scopedTableCount = tenantModule.TENANT_SCOPED_TABLES.size;
const createdTableCount = scopedTableCount + tenantModule.GLOBAL_TABLES.size;

for (const [label, value, floor] of [
  ["repositories on the open-source register", repositoryCount, 40],
  ["registered repositories declaring no licence", undeclaredLicenceCount, 1],
  ["registered repositories carrying a reciprocal licence", reciprocalLicenceCount, 1],
  ["migrations", migrationCount, 50],
  ["tables created by the migrations", createdTableCount, 100],
  ["organization-scoped tables", scopedTableCount, 80],
  ["tables closed to everyone but the service role", serviceRoleOnlyCount, 10]
]) {
  if (!Number.isFinite(value) || value < floor) {
    // A figure this check cannot establish is one it must not vouch for. The
    // alternative is comparing every document against a zero and reporting
    // every correct number as wrong.
    console.error(`ERROR: only ${value} ${label} could be counted; this check cannot vouch for a figure it cannot measure.`);
    process.exit(1);
  }
}

if (!commandCount) {
  console.error("ERROR: package.json has no verify:launch chain, so no command count could be established.");
  process.exit(1);
}
if (testFiles < 50) {
  console.error(`ERROR: only ${testFiles} test files found; this check cannot vouch for a count it cannot measure.`);
  process.exit(1);
}

const WORDS = { eighteen: 18, nineteen: 19, twenty: 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23 };

function walk(directory) {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(relative));
    else if (entry.name.endsWith(".md")) found.push(relative);
  }
  return found;
}

const problems = [];
let claimsChecked = 0;
// A pattern that matches nothing passes, which is the failure this whole file
// exists to catch one level up. The register count is stated in a live document
// today; if a rewording makes it stop matching, that is a hole opening, not a
// document improving, and it should stop the release rather than go unnoticed.
const REGISTER_CLAIM = "repositories on the open-source register";
let registerClaimsSeen = 0;
// The same guard for the service-role-only table count, and it is here because
// the hole was demonstrated rather than imagined. Rewriting the figure as a
// word -- "Twenty-five" for "25" -- drops it out of every pattern in this file,
// and the check then passes having quietly stopped watching it. That is exactly
// how the previous figure survived being wrong: it was written as "thirteen".
const SERVICE_ROLE_CLAIM = "tables closed to everyone but the service role";
let serviceRoleClaimsSeen = 0;

for (const file of walk("docs")) {
  const raw = fs.readFileSync(path.join(root, file), "utf8");
  if (isExcluded(file, raw)) continue;
  // Emphasis stripped before matching. "**21** verification commands" did not
  // match a pattern anchored on a word boundary before the digits, so the one
  // live claim in the repository was invisible to the check written for it.
  const text = raw.replace(/\*\*/g, "").replace(/`/g, "");

  // "the eighteen-command chain", "18 verification commands", "21 commands"
  for (const match of text.matchAll(/\b([a-z-]+|\d+)[- ](?:verification )?commands?\b/gi)) {
    const raw = String(match[1]).toLowerCase();
    const claimed = WORDS[raw] ?? (/^\d+$/.test(raw) ? Number(raw) : null);
    if (claimed === null) continue;
    claimsChecked += 1;
    if (claimed !== commandCount) {
      problems.push(`${file}: says ${match[0].trim()}; verify:launch chains ${commandCount}`);
    }
  }

  // The derivable counts. Each pattern is anchored on the noun phrase the
  // documents actually use, so a sentence about somebody else's 66 repositories
  // is not read as a claim about ours.
  for (const [pattern, actual, what] of [
    // "reviewed" is required, not optional. It was optional, and the pattern
    // then read "13 repositories above 300 stars pushed in the last year" -- a
    // count of GitHub search results in a sweep document -- as a claim about
    // this register, and failed the release on a sentence that was correct.
    //
    // A check that fires on true statements does not get fixed; the prose gets
    // reworded around it, and then the check is training people to avoid it
    // rather than measuring anything. The narrower pattern would be a quiet
    // weakening on its own, so REGISTER_CLAIMS below refuses to pass if it stops
    // matching anything at all.
    [/\b(\d[\d,]{0,4})\s+reviewed\s+repositories\b/gi, repositoryCount, "repositories on the open-source register"],
    [/\b(\d[\d,]{0,4})\s+declare no licence\b/gi, undeclaredLicenceCount, "registered repositories declaring no licence"],
    [/\b(\d[\d,]{0,4})\s+carry\s+a\s+reciprocal\s+licence\b/gi, reciprocalLicenceCount, "registered repositories carrying a reciprocal licence"],
    // The same figure, written the other way round. docs/architecture/EXTERNAL-SERVICES.md
    // said "The eight reciprocal repositories are a separate decision" and went
    // stale from 8 to 17 with nothing watching it, because the pattern above
    // requires the words "carry a reciprocal licence" and this phrasing has
    // neither. One number, two sentences, one guard: the second sentence needs
    // its own pattern or it is unguarded prose.
    //
    // It also has to be written as a DIGIT. "eight" is invisible to every
    // pattern here, so a derived count spelled as a word cannot be checked at
    // all -- which is worth knowing before writing one.
    [/\b(\d[\d,]{0,4})\s+reciprocal\s+repositories\b/gi, reciprocalLicenceCount, "registered repositories carrying a reciprocal licence"],
    [/\b(\d[\d,]{0,4})\s+migrations\b/gi, migrationCount, "migration files"],
    [/\b(\d[\d,]{0,4})\s+tables\s+created\s+by\s+the\s+migrations\b/gi, createdTableCount, "tables created by the migrations"],
    [/\b(\d[\d,]{0,4})\s+of\s+them\s+organization-scoped\b/gi, scopedTableCount, "organization-scoped tables"],
    [
      /\b(\d[\d,]{0,4})\s+tables\s+have\s+RLS\s+enabled\s+with\s+no\s+explicit\s+policy\b/gi,
      serviceRoleOnlyCount,
      "tables closed to everyone but the service role"
    ]
  ]) {
    for (const match of text.matchAll(pattern)) {
      const claimed = Number(String(match[1]).replace(/,/g, ""));
      if (!Number.isFinite(claimed)) continue;
      claimsChecked += 1;
      if (what === REGISTER_CLAIM) registerClaimsSeen += 1;
      if (what === SERVICE_ROLE_CLAIM) serviceRoleClaimsSeen += 1;
      if (claimed !== actual) problems.push(`${file}: says "${match[0].trim()}"; the true figure is ${actual} (${what})`);
    }
  }

  // "1347 tests passing", "1347 passing". A test *count* moves every sprint, so
  // the rule is narrower: a doc may not state one at all unless it is generated.
  // Thousands separators included, or "1,733 tests passing" is read as 733 and
  // the message quotes a number nobody wrote.
  for (const match of text.matchAll(/\b(\d[\d,]{2,6})\s+(?:tests? )?passing\b/gi)) {
    claimsChecked += 1;
    problems.push(
      `${file}: states "${match[0].trim()}". A passing count is stale the next time anybody adds a test -- ` +
        "say what the suite covers, or let docs/HANDOFF_PROMPT.md carry the number, which is generated."
    );
  }
}

if (!registerClaimsSeen) {
  console.error(
    `ERROR: no document states the reviewed-repository count, so the pattern for it checked nothing. ` +
      "Either a live document lost the claim, or the pattern stopped matching how it is written -- " +
      "both are the check going quiet rather than the documents getting better."
  );
  process.exit(1);
}

if (!serviceRoleClaimsSeen) {
  console.error(
    "ERROR: no document states how many tables are closed to everyone but the service role, so the pattern for it " +
      "checked nothing. The most likely cause is the figure being spelled as a word again -- a word is invisible to " +
      "every pattern in this file, and that is how the previous one stayed wrong at thirteen while the truth was 25."
  );
  process.exit(1);
}

if (problems.length) {
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  console.error(`\nDocument count check failed on ${problems.length} claim(s).`);
  process.exit(1);
}

// Zero claims is not a pass. Every live document could legitimately stop
// stating counts, but the far likelier cause of zero is that the patterns above
// have stopped matching -- which is the shape of failure this repository keeps
// finding, and the one a check about honest numbers should least be able to
// take.
if (claimsChecked === 0) {
  console.error("ERROR: no countable claim was found in any live document. Either the patterns have stopped matching, or docs/owner/WHAT-IS-LEFT.md no longer states the chain length it is supposed to.");
  process.exit(1);
}

console.log(`Document counts verified: ${claimsChecked} countable claim(s) checked against ${commandCount} chain commands and ${testFiles} test files.`);
if (!check) console.log("Nothing to write; this check only reads.");

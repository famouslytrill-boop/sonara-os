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
  if (EXCLUDED.has(file) || file.startsWith("docs/archive/")) return true;
  return DATED_RECORD.test(String(text || "").slice(0, 400));
}

// The true numbers, read from the repository rather than remembered.
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const chain = String(packageJson.scripts?.["verify:launch"] || "");
const commandCount = chain ? chain.split("&&").length : 0;
const testFiles = fs.readdirSync(path.join(root, "tests")).filter((name) => /\.(test\.js|test\.mjs)$/.test(name)).length;

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

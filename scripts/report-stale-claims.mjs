// Which written claims are past the date they should have been re-checked.
//
// This repository writes documents that make dated, checkable claims: what
// competitors charge, what the live Stripe account holds, what the design
// system does, what is left before shipping. Every one of them was true when
// written. Several stopped being true inside a single working session:
//
//   lib/sonara-billing.cjs said the three retired Stripe plans were active
//   prices on archived products. Checked against the live account, all three
//   read inactive on both.
//
//   The form-reachability list called two endpoints "JSON twins" of endpoints
//   that "have a form". Neither was a twin, and two whole tables had no way to
//   be written to.
//
//   docs/SHIP_READINESS.md described the legal position as a question about
//   engaging counsel. The pages were placeholders headed "Section 1".
//
// None of those was careless. They were accurate observations that the code or
// the world moved past, and nothing was watching the gap. The idea of pairing a
// claim with the date it should be re-examined is taken from
// rshankras/claude-code-apple-skills, MIT, where every skill file carries
// last_verified and review_by in its frontmatter. Adapted, not copied: the
// mechanism here is a line in a markdown document and a check over it.
//
// --check fails when a document that makes a dated claim does not say when it
// should be re-checked. It does **not** fail when a date has merely passed.
// A missing review date is a structural omission somebody can fix in a minute;
// a passed date needs a person to go and look at the world again, and failing
// a release for that would block an unrelated deploy on a calendar. Overdue
// documents are printed loudly instead, on every release.

import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const check = process.argv.includes("--check");

// Documents whose claims are about the world or the live system, rather than
// about this repository's own code. A generated file is excluded: its claims
// are re-derived on every build, which is a stronger guarantee than a date.
const GENERATED = new Set(["docs/HANDOFF_PROMPT.md", "docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md"]);

// A chronological log is history, not a standing claim. Its entries describe
// what was true on the day they were written and are not asserting anything
// about today, so there is nothing to re-check.
const HISTORY = new Set(["docs/SPRINT_LOG.md"]);

// A document "makes a dated claim" if it says when it was researched or
// checked. That phrasing is the marker, and it is deliberately narrow: a doc
// that never claims to have looked at anything needs no review date.
const DATED = /^(audit date|analysis date|researched|checked|retrieved|surveyed)\b/im;
const REVIEW = /^review by:\s*(\d{4}-\d{2}-\d{2})\s*$/im;

function walk(directory) {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(relative));
    else if (entry.name.endsWith(".md")) found.push(relative);
  }
  return found;
}

const documents = walk("docs").filter((file) => !GENERATED.has(file) && !HISTORY.has(file) && !file.startsWith("docs/archive/"));
const dated = documents.filter((file) => DATED.test(fs.readFileSync(path.join(root, file), "utf8")));

const missing = [];
const overdue = [];
const today = new Date().toISOString().slice(0, 10);

for (const file of dated) {
  const match = fs.readFileSync(path.join(root, file), "utf8").match(REVIEW);
  if (!match) {
    missing.push(file);
    continue;
  }
  if (match[1] < today) overdue.push({ file, due: match[1] });
}

console.log(`Documents making a dated claim: ${dated.length}`);
console.log(`With a review date: ${dated.length - missing.length}`);

if (overdue.length) {
  console.log("\nPast their review date. Each of these says it checked something; go and check it again:");
  for (const item of overdue.sort((a, b) => a.due.localeCompare(b.due))) {
    console.log(`  ${item.due}  ${item.file}`);
  }
  console.log("\nRe-verify the claim, then move the date. Moving the date without looking is the one thing this cannot catch.");
} else if (dated.length) {
  console.log("Nothing is past its review date.");
}

if (missing.length) {
  for (const file of missing) {
    console.error(`ERROR: ${file} says when it was checked and never says when to check it again. Add a "Review by: YYYY-MM-DD" line.`);
  }
  if (check) {
    console.error(`\nStale-claim check failed: ${missing.length} document(s) with no review date.`);
    process.exit(1);
  }
}

// The guard against this check going quiet. If the marker stops matching --
// because a document phrases its date differently -- the loop above passes over
// an empty list and reports success.
if (check && dated.length < 5) {
  console.error(`ERROR: only ${dated.length} dated documents found; the marker is no longer matching and this check is looking at nothing.`);
  process.exit(1);
}

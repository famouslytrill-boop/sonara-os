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
// checked. That phrasing is the marker, and the narrowness is deliberate: a doc
// that never claims to have looked at anything needs no review date.
//
// **The first marker was narrower than that reasoning.** It required one of six
// words to START a line, which is how a document's own front matter is
// usually written -- and most documents here state their measurement date in a
// sentence instead: "both measured on 5 September 2026", "hand-counted on
// 12 August 2026", "Public-live verified on 2026-07-17". Those make exactly the
// claim this check exists for and were invisible to it.
//
// Found on 15 September 2026 by writing a document that says "Every figure
// below was measured on 15 September 2026" and noticing the dated count did not
// move. Measured over 382 documents: the line-start marker matched 17, and
// seven more make a dated measurement claim in a sentence. That is the second
// shape in .claude/skills/checks-that-cannot-lie -- measuring a different
// population from the one claimed -- on the check whose own output says
// "Documents making a dated claim".
//
// SENTENCE is kept tight rather than matching every "read on": a measurement
// verb, then at most sixty characters of the same sentence, then an explicit
// date. Widening it further pulls in prose about when something happened, which
// is not a claim about what is true now.
// The original six, unchanged. They work as front-matter labels followed by a
// date -- "Researched: 2026-08-11". `measured`, `verified` and `counted` were
// added here in the first draft of this widening and taken back out: they are
// ordinary sentence openers, so they matched
// "Measured live during Phase 1 work:" and "Verified in this repository: `/`
// returns 200" -- claims with no date in them, which this check has nothing to
// say about. Requiring the date is what makes the widening safe, and that is
// DATED_SENTENCE's job.
const DATED_LINE = /^(audit date|analysis date|researched|checked|retrieved|surveyed)\b/im;
const DATED_SENTENCE = new RegExp(
  [
    "\\b(measured|verified|counted|sourced|observed|hand-counted|read)\\b[^.\n]{0,60}\\bon\\s+\\d{1,2}\\s+\\w+\\s+20\\d\\d\\b",
    "\\b(measured|verified|counted|sourced|observed|hand-counted|read)\\b[^.\n]{0,60}\\bon\\s+20\\d\\d-\\d\\d-\\d\\d\\b"
  ].join("|"),
  "i"
);
const DATED = { test: (text) => DATED_LINE.test(text) || DATED_SENTENCE.test(text) };
const REVIEW = /^review by:\s*(\d{4}-\d{2}-\d{2})\s*$/im;

// Documents the widened marker newly reaches, whose claims nobody has re-checked
// yet.
//
// These are not exemptions. **Giving them a review date would be the one thing
// this check says it cannot catch** -- "Moving the date without looking" -- and
// doing it to five documents at once to get a green chain would be that, at
// scale. So each is named with what it still needs and a date by which the
// review has to have happened, after which this check fails on it.
//
// The deadline is a judgement, not a derivation: one month from the day the
// marker was widened. Move it deliberately if that is wrong; what must not
// happen is the entry quietly outliving its reason, which is why the date is
// here and enforced rather than written in prose.
const AWAITING_FIRST_REVIEW = Object.freeze({
  "docs/SONARA_PAID_LAUNCH_VERIFICATION_2026-07-16.md": {
    deadline: "2026-10-15",
    needs: "says \"Public-live verified on 2026-07-17\". Two months old, and it asserts what a live deployment was serving -- which is the claim docs/owner/STRIPE-RUNTIME-KEY-CUTOVER.md shows has since changed."
  },
  "docs/WORKSPACE_WORKFLOW_AUDIT.md": {
    deadline: "2026-10-15",
    needs: "opens \"Measured on 2026-08-05\" and counts workspace surfaces. Re-run the counts rather than reading them."
  },
  "docs/market/2026-08-11-TRADES-AI-TOOL-STACK.md": {
    deadline: "2026-10-15",
    needs: "competitor pricing, which is the category with the shortest half-life here. docs/pricing/ was refreshed against September figures and this was not."
  },
  "docs/SHIP_READINESS.md": {
    deadline: "2026-10-15",
    needs: "says two launch blockers were \"both measured on 5 September 2026\". One of them -- the Stripe runtime key -- is confirmed still blocking by live evidence. The other was not re-checked when this entry was written, and that is the whole reason for the entry: parts of this document were corrected on 15 September and its dated claim was not one of them."
  },
  "docs/owner/WHAT-IS-LEFT.md": {
    deadline: "2026-10-15",
    needs: "one figure is \"hand-counted on 12 August 2026\" and says so. Most of this document's numbers are now derived and gated by scripts/verify-doc-counts.mjs; that one is not, which is why it carries a date at all. Count it and either derive it or re-date it."
  }
});

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

// A document with no review date fails, unless it is on the register above and
// its deadline has not passed. Past the deadline it fails like any other.
const registered = [];
const unregistered = [];
for (const file of missing) {
  const entry = AWAITING_FIRST_REVIEW[file];
  if (entry && entry.deadline >= today) registered.push({ file, ...entry });
  else unregistered.push(file);
}

if (registered.length) {
  console.log("\nAwaiting a first review under the widened marker. Each fails once its deadline passes:");
  for (const item of registered.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`  by ${item.deadline}  ${item.file}`);
    console.log(`      ${item.needs}`);
  }
  console.log("\nThe review is reading the claim and confirming it, then adding the review date. Adding the date first is the one failure this check cannot see.");
}

if (unregistered.length) {
  for (const file of unregistered) {
    const entry = AWAITING_FIRST_REVIEW[file];
    if (entry) {
      console.error(`ERROR: ${file} was registered as awaiting a first review by ${entry.deadline}, and that date has passed. ${entry.needs}`);
    } else {
      console.error(`ERROR: ${file} says when it was checked and never says when to check it again. Add a "Review by: YYYY-MM-DD" line.`);
    }
  }
  if (check) {
    console.error(`\nStale-claim check failed: ${unregistered.length} document(s) with no review date.`);
    process.exit(1);
  }
}

// The other side of the register. An entry that no longer describes anything is
// a reason nobody will recheck, sitting where the next person reads it -- the
// fifth shape in .claude/skills/checks-that-cannot-lie, and the one this
// repository has shipped most often.
const staleRegistrations = [];
for (const file of Object.keys(AWAITING_FIRST_REVIEW)) {
  if (!documents.includes(file)) {
    staleRegistrations.push(`${file} is registered as awaiting review and is not a document this check scans. Remove the entry.`);
    continue;
  }
  if (!dated.includes(file)) {
    staleRegistrations.push(`${file} is registered as awaiting review and no longer makes a dated claim. Remove the entry.`);
    continue;
  }
  if (!missing.includes(file)) {
    staleRegistrations.push(`${file} is registered as awaiting review and now has a review date. Remove the entry -- the review happened.`);
  }
}

if (staleRegistrations.length) {
  for (const line of staleRegistrations) console.error(`ERROR: ${line}`);
  if (check) {
    console.error(`\nStale-claim check failed: ${staleRegistrations.length} registration(s) that describe nothing.`);
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

#!/usr/bin/env node

// Modules nothing requires.
//
// lib/sonara-cohesive-homepage.cjs and lib/sonara-advanced-builder-homepage.cjs
// were each several hundred lines of homepage rendering that no file in this
// repository required. They were noticed three separate times across this
// project's history, mentioned each time, and left there each time -- because
// noticing is free and deleting needs somebody to be sure.
//
// This makes being sure cheap. It reads every module under lib/ and routes/ and
// asks whether any file anywhere -- server.js, api/, scripts/, tests/, or
// another module -- names it. A module nothing names is not "probably unused";
// it is unreachable, because this runtime has no bundler, no dynamic import and
// no code generation left, so the only way in is a literal require.
//
// duriantaco/skylos in the register does this for Python and cannot run here.
// The problem it solves is real in this tree; the tool is not the one that
// fits, so this is the same idea written against this codebase.
//
// It reports rather than deletes. A module can be legitimately unreferenced --
// something staged behind a flag, or a file kept deliberately -- and the
// allowlist below takes those with a reason attached, which is the part that
// stops the list becoming a place to hide things.
//
// ## Tests count as referencers, so there is a second tier below
//
// The searched set includes tests/, so a module only its own test requires
// reads as referenced here. That is a real gap: a lib module nothing in the
// product uses is dead whatever its tests do.
//
// This file used to say the gap had been measured -- 8 September 2026, two
// modules, both legitimate -- and concluded that a runtime-versus-test tier
// "would carry two permanent exemptions and catch nothing". That measurement
// was true when it was taken and the conclusion drawn from it has since
// expired, which is shape 5 in .claude/skills/checks-that-cannot-lie: an
// exemption whose reason no longer describes anything, sitting where the next
// reader looks instead of checking.
//
// Re-measured 21 September 2026: **fourteen**, not two. One of them was
// `lib/sonara-screenshot-tool-radar-batch13.cjs`, four verified repository
// records that reached no catalog, no readiness figure and no page because
// `routes/sonara-requested-repositories-routes.cjs` required batch 12 and then
// batch 14. This report printed "every module is reachable" for five days
// while that was true, because the batch's own test names the module.
//
// So the tier exists now, as an accounted list rather than a count. It is
// two-sided like every other exemption here: a test-only module nobody has
// ruled on fails, and an entry whose module is no longer test-only fails, so a
// reason cannot outlive the thing it describes.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { withoutComments } = createRequire(import.meta.url)("../lib/sonara-comment-stripping.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

// Unreferenced on purpose. A reason is required, because "it is fine" is what
// every one of these looks like until it is not.
const ALLOWED = new Map([
  // Empty. Both entries that would have gone here were deleted instead, which
  // is what this list is for -- making the choice explicit rather than letting
  // "unreferenced" become a resting state.
]);

// Tier 2: reached by tests/ and by nothing else. Each reason says what the
// module is waiting for, because "it is fine" is what every one of these looks
// like until it is the one that was forgotten.
const TEST_ONLY = new Map([
  ["lib/sonara-aggregator-sourcing-policy.cjs",
    "Research-only adapter sourcing economics and verified-depth formulas. It grants no provider or runtime authority; "
    + "keep it test-only until a reviewed connector control-plane surface explicitly consumes the policy."],
  ["lib/sonara-connection-registry.cjs",
    "Research-only Connection Registry contract targeting business_integration_connections. It deliberately requires a future migration "
    + "and keeps runtime authority disabled until the registry is implemented and production-verified."],
  ["lib/sonara-read-only-connector-wave.cjs",
    "Research-only ordered read connector wave and shared sync requirements. It declares zero verified native connectors and "
    + "stays test-only until the shared checkpoint, reconciliation and telemetry runtime consumes it."],
  ["lib/creator-studio-market-radar-2026.cjs",
    "Research-only Creator Studio market radar. It is validated by tests and intentionally grants no runtime authority; "
    + "keep it test-only until a reviewed product surface explicitly consumes the planning contract."],
  ["lib/commerce-market-radar-2026.cjs",
    "Research-only commerce and omnichannel market radar. The module declares runtimeAuthority=none and executionEnabled=false; "
    + "keep it test-only until a reviewed Business Builder surface consumes the planning contract without granting payment, inventory, "
    + "provider, publication, or agent-spend authority."],
  ["lib/sonara-aggregation-control-plane.cjs",
    "Research-only aggregation architecture and deterministic planning formulas. It deliberately grants zero "
    + "provider/runtime authority and is surfaced through docs/public research rather than required by the product; "
    + "it remains test-only until a reviewed aggregation runtime explicitly consumes the contract."],
  ["lib/sonara-compliance-evidence-readiness.cjs",
    "Reports evidence and gaps and deliberately never emits a compliant state. No surface renders it yet; "
    + "wiring it is a product decision about what to show an owner, not a missing require."],
  ["lib/sonara-d1-rollups.cjs",
    "The schema and read rules for the two derived tables D1 may hold. lib/sonara-d1-adapter.cjs is the "
    + "enforcement half and is wired; this half waits on a D1 binding the owner has not provisioned."],
  ["lib/sonara-form-reachability.cjs",
    "A measurement three tests share. Test infrastructure that lives in lib/ on purpose, and the one entry "
    + "here that is correct as a permanent state rather than a staging one."],
  ["lib/sonara-generation-execution-contract.cjs",
    "Declares the operations and pathways a generation run may take. The planner it composes is wired; this "
    + "contract is ahead of the executor that will read it."],
  ["lib/sonara-generation-persistence-contract.cjs",
    "Declares the tables and legal state transitions of the generation lifecycle against migration "
    + "20260916032000. The repository module it names is wired; this contract is ahead of the writer."],
  ["lib/sonara-grounded-retrieval-contract.cjs",
    "Batch 13's grounded-retrieval envelope over lib/sonara-platform-kernel.cjs. Recorded research, not a "
    + "built retrieval path."],
  ["lib/sonara-llm-observability-contract.cjs",
    "Batch 13's model-observation record shape, with no raw prompt or response storage by default. Nothing "
    + "emits one yet; docs/research/SCREENSHOT_TOOL_RADAR_2026-09-16_BATCH13.md records it as intake."],
  ["lib/sonara-media-processing-contract.cjs",
    "Declares the non-destructive media operations an isolated worker would be allowed. There is no worker, "
    + "which is the point -- AGENTS.md keeps FFmpeg and headless browsers out of the request process."],
  ["lib/sonara-module-runtime.cjs",
    "Validates and orders module manifests into an auditable installation plan, and deliberately installs, "
    + "loads and activates nothing. Waiting on a surface that shows the plan to an owner for approval."],
  ["lib/sonara-pgmq-transport.cjs",
    "Staging-only PGMQ transport contract added 24 September 2026. It is intentionally not reachable from "
    + "the production runtime until an isolated Supabase environment exposes pgmq_public, creates one canary "
    + "queue, and proves tenant isolation, visibility timeout, settlement, retry and recovery evidence."],
  ["lib/sonara-sms-keywords.cjs",
    "Turns an inbound \"STOP\" into an intent. The refusal half is already built and wired "
    + "(authoriseOutbound in lib/sonara-telephony.cjs refuses on consent_revoked), and both candidate carriers "
    + "honour the keywords themselves, so nothing is unprotected. There is no inbound SMS webhook for this to "
    + "hang off yet; that is what it waits on."],
  ["lib/sonara-supabase-clients.cjs",
    "Deliberately not yet wired. It is the machinery for moving off the service-role key, and "
    + "tests/the-revoke-reasoning-is-still-true.test.js reasons about it explicitly, including what deleting "
    + "it would mean."]
]);

function walk(directory, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, found);
    } else if (/\.(cjs|mjs|js|ts)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

// Every file that could name a module, including the modules themselves --
// one module requiring another counts as a reference.
const searchable = [
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "routes")),
  ...walk(path.join(root, "api")),
  ...walk(path.join(root, "scripts")),
  ...walk(path.join(root, "tests")),
  ...walk(path.join(root, "data")),
  path.join(root, "server.js")
]
  .filter((file) => fs.existsSync(file))
  // This report's own path, removed from the set it searches.
  //
  // Found by the tier-2 list on the run that introduced it: it reported all
  // thirteen entries as stale, because naming a module in ALLOWED or TEST_ONLY
  // is naming it in a file under scripts/, and scripts/ is searched. The
  // bookkeeping made its own subjects look reachable. `withoutComments` covers
  // the header, which names modules in prose; it does not cover a Map whose
  // keys are code.
  //
  // ALLOWED has been empty for as long as it has existed, so this never bit
  // before, and it would have bitten silently the first time somebody used it
  // -- an exempted module would have read as referenced and dropped out of the
  // population the exemption was written for.
  //
  // Excluding the file is right rather than convenient: a module named only in
  // this report's bookkeeping is not a module the product uses. It requires
  // lib/sonara-comment-stripping.cjs, which four other files also require, so
  // that stays referenced on its own evidence.
  .filter((file) => file !== fileURLToPath(import.meta.url));

// Candidates: modules under lib/ and routes/ that something is supposed to use.
const candidates = [...walk(path.join(root, "lib")), ...walk(path.join(root, "routes"))]
  .filter((file) => /\.cjs$/.test(file));

if (candidates.length === 0) {
  console.error("ERROR: no modules found under lib/ or routes/; this report has gone blind rather than found nothing");
  process.exit(1);
}

// Comments are stripped before matching. This file's own header names two of
// the modules it reports on, and scripts/report-orphan-tables.mjs once shipped
// with exactly this bug -- a table mentioned in a comment counted as a table
// somebody queried, so a table nothing touched looked used.
//
// ## Why this no longer strips them itself
//
// It used to, in two passes: block comments, then line comments. That is the
// obvious order and it is wrong, and lib/sonara-comment-stripping.cjs exists
// because two other reports had the identical bug. This one was not changed
// with them, so it carried the original for as long as the module has existed.
//
// The damage was not hypothetical. In routes/sonara-last9-routes.cjs the line
//
//     // /business-builder/owner/* and this module already receives ...
//
// contains `/*`, the block pass read it as an opener, and everything to the
// next `*/` -- 971 lines later, inside a catch -- stopped being code. The file
// went from 171,348 characters to 74,306: **57% of it erased before matching**,
// taking `require("./sonara-sub-app-routes.cjs")` with it.
//
// That direction of error is the dangerous one here. Losing a reference makes a
// module that IS required look unreferenced, and `--check` fails the build over
// it. The report currently prints zero only because nothing has yet landed in
// one of the swallowed regions.
//
// One left-to-right pass with both forms in one alternation fixes it: at the
// `//` the block branch cannot match, so a `/*` inside a line comment is never
// an opener.

const sources = new Map(searchable.map((file) => [file, withoutComments(fs.readFileSync(file, "utf8"))]));

// Tier 2 needs to tell a test referencer from any other, so the test files are
// identified once here rather than by re-walking the directory per candidate.
const testFiles = new Set(walk(path.join(root, "tests")));

const unreferenced = [];
const testOnly = [];
for (const candidate of candidates) {
  // Keep the allowlist portable across Windows and POSIX. `path.relative`
  // returns backslashes on Windows, while the checked-in registry uses the
  // repository's forward-slash form.
  const relative = path.relative(root, candidate).split(path.sep).join("/");
  const base = path.basename(candidate, ".cjs");
  // The module name as it would appear in a require path. Matching the base
  // name rather than the full path catches ../lib/x.cjs, ./x.cjs and
  // path.join(root, "lib", "x.cjs") alike.
  const pattern = new RegExp(`["'\`/]${base.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(?:\\.cjs)?["'\`]`);
  let referencedByTest = false;
  let referencedByOther = false;
  for (const [file, source] of sources) {
    if (file === candidate) continue;
    if (!pattern.test(source)) continue;
    if (testFiles.has(file)) referencedByTest = true;
    else {
      referencedByOther = true;
      // Nothing further can change the verdict for either tier.
      break;
    }
  }
  if (!referencedByTest && !referencedByOther) unreferenced.push(relative);
  else if (referencedByTest && !referencedByOther) testOnly.push(relative);
}

const unexplained = unreferenced.filter((relative) => !ALLOWED.has(relative));

// Two-sided, both directions stated separately because they are different
// mistakes. Unaccounted means somebody wired a module into tests and nowhere
// else and nobody ruled on it. Stale means a module got wired -- the good case
// -- and its reason was left behind to be read by the next person as though it
// were still true.
const testOnlyUnaccounted = testOnly.filter((relative) => !TEST_ONLY.has(relative));
const testOnlyStale = [...TEST_ONLY.keys()].filter((relative) => !testOnly.includes(relative));

console.log(`Modules under lib/ and routes/: ${candidates.length}`);
console.log(`Files that could reference them: ${sources.size}`);
console.log(`Unreferenced: ${unreferenced.length}${ALLOWED.size ? `, of which ${ALLOWED.size} are allowed with a reason` : ""}`);
for (const relative of unreferenced) {
  const reason = ALLOWED.get(relative);
  console.log(`  ${relative}${reason ? ` -- allowed: ${reason}` : ""}`);
}
console.log(`Reached by tests/ and nothing else: ${testOnly.length}, all ${TEST_ONLY.size} accounted for with a reason`);

if (checkOnly && unexplained.length) {
  console.error("");
  console.error("ERROR: these modules are required by nothing. This runtime has no bundler, no dynamic");
  console.error("import and no code generation, so the only way into a module is a literal require --");
  console.error("which means unreferenced is unreachable, not merely unused. Delete them, or add each");
  console.error("to ALLOWED in this script with the reason it stays.");
  for (const relative of unexplained) console.error(`  ${relative}`);
  process.exit(1);
}

if (checkOnly && (testOnlyUnaccounted.length || testOnlyStale.length)) {
  console.error("");
  if (testOnlyUnaccounted.length) {
    console.error("ERROR: these modules are required by their tests and by nothing else. A test proves a module");
    console.error("works; it does not make the product use it. Wire each one, delete it, or add it to TEST_ONLY");
    console.error("in this script with what it is waiting for:");
    for (const relative of testOnlyUnaccounted) console.error(`  ${relative}`);
  }
  if (testOnlyStale.length) {
    if (testOnlyUnaccounted.length) console.error("");
    console.error("ERROR: these TEST_ONLY entries no longer describe anything -- the module is now reached by the");
    console.error("product, or it is gone. Remove the entry. A reason that outlives its subject is what the next");
    console.error("reader believes instead of checking, which is how this file's own 8 September measurement");
    console.error("stayed here after it stopped being true:");
    for (const relative of testOnlyStale) console.error(`  ${relative} -- reason on file: ${TEST_ONLY.get(relative)}`);
  }
  process.exit(1);
}

if (checkOnly) {
  console.log("Every module under lib/ and routes/ is reachable, and every module reached only by its tests is accounted for.");
}

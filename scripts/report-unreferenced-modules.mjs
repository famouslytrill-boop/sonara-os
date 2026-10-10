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
  ["lib/sonara-mobile-billing-classification.cjs",
    "Storefront-region-aware purchase classification research, test-only pending trusted server catalog / iOS StoreKit / Google Play program and provider verification. Not a route, checkout, entitlement, or payment activation."],
  ["lib/sonara-community-discovery.cjs",
    "Deterministic public-discovery research policy; explicitly NOT runtime-wired. It waits for reviewed server-owned public projections, authenticated consent/tenant checks, moderation and rights evidence, report/takedown controls, and a one-tenant gated pilot. Never activates social publishing."],
  // Explicitly staged governance work from #442/#443; these remain unconnected.
  ["lib/sonara-content-compliance-engine.cjs",
    "Draft content/legal review policy; waits for authenticated tenant evidence and a human-review route. It does not certify compliance or publish."],
  ["lib/sonara-contract-evidence-gates.cjs",
    "Contract checklist and digest; waits for a version-bound agreement review page and qualified jurisdiction review. It does not sign or bind parties."],
  ["lib/sonara-customer-approval-board.cjs",
    "Pure quorum/approval evaluator; waits for independently authenticated approver records, step-up and an action-bound board executor."],
  ["lib/sonara-customer-authorization-calculator.cjs",
    "Proposed role/resource calculator; waits for adversarial validation and explicit route/RLS integration. Existing guards remain authoritative."],
  ["lib/sonara-customer-automation-policy.cjs",
    "Skill and trigger planning; waits for a durable scheduler integrated with the existing agent runner and approval-per-run evidence."],
  ["lib/sonara-customer-money-pathways.cjs",
    "Non-executing funds-role catalog; waits for a reviewed customer explanation page. It creates no charge, custody or settlement evidence."],
  ["lib/sonara-customer-proof-engine.cjs",
    "Evidence packet classifier; waits for independently fetched provider evidence and a consent-bound customer proof dashboard."],
  ["lib/sonara-customer-review-governance.cjs",
    "Review authorship/moderation preflight; waits for separate customer text confirmation and owner publication workflows."],
  ["lib/sonara-deterministic-capacity-planner.cjs",
    "Integer scenario planning; waits for measured workload/pricing inputs and a customer scenario screen. Outputs are not benchmarks."],
  ["lib/sonara-seasonal-vertical-playbooks.cjs",
    "Reviewed test-only seasonal planning and counts-only compression. Waits for measured owner inputs, authenticated tenant adapter, audited approval gates and an explicitly reviewed customer scenario screen; not live dispatch, food compliance or payments."],
  ["lib/sonara-deterministic-risk-assessment.cjs",
    "Risk triage math; waits for a tenant-scoped risk register with measured evidence. It cannot decide credit, housing or insurance eligibility."],
  ["lib/sonara-file-storage-policy.cjs",
    "Storage/cache preflight only; waits for reviewed byte-scanning, tenant storage and signed-access adapters. It uploads and exposes no files."],
  ["lib/sonara-financial-close-controls.cjs",
    "Preview processor/bank tie-out; waits for independently authenticated full bank and processor windows and finance review. No journal or payout is posted."],
  ["lib/sonara-financial-scenario-math.cjs",
    "Informational quote math; waits for verified business inputs and tax-provider integration on a reviewed scenario page. No invoice is issued."],
  ["lib/sonara-governance-workbook-views.cjs",
    "Plain-value governance projections; waits for tenant-scoped approved evidence and a reviewed workbook export route."],
  ["lib/sonara-governed-ai-draft-packets.cjs",
    "Draft-only model packet policy; waits for Provider Gateway and independently derived evidence in an approval-bound drafting flow."],
  ["lib/sonara-lease-ledger.cjs",
    "Draft lease ledger calculations; waits for authenticated lease persistence and jurisdiction-reviewed statements. No rent or deposit is moved."],
  ["lib/sonara-lease-policy-gates.cjs",
    "Non-executing lease checklist; waits for qualified jurisdiction review and a tenant-owned draft review page. It cannot sign, screen or evict."],
  ["lib/sonara-lease-statutory-formulas.cjs",
    "Dated statutory draft calculations; waits for current qualified jurisdiction review and verified property/owner inputs. Not a legal determination."],
  ["lib/sonara-license-compliance.cjs",
    "License/provenance checklist; waits for rights-source verification and a version-bound intake review route. No rights are granted."],
  ["lib/sonara-low-custody-policy.cjs",
    "Non-executing funds boundary; waits for explicit review against connected-payment runtime and customer/provider account evidence. It does not change payment mode."],
  ["lib/sonara-money-pathway-guards.cjs",
    "Draft funds audit/preflight; waits for independently retrieved complete processor/app event windows and authenticated account mapping."],
  ["lib/sonara-offline-sync-policy.cjs",
    "Future native mutation policy; waits for encrypted device persistence, server deduplication and conflict-review integration. It is separate from the location check-in queue."],
  ["lib/sonara-property-vendor-boundary.cjs",
    "Ohio property vendor checklist; waits for documented owner/broker authority and qualified legal review. It grants no brokerage permission."],
  ["lib/sonara-rate-budget-math.cjs",
    "Pure weighted-resource math; waits for shared durable atomic counters and reviewed middleware. It authorizes no requests."],
  ["lib/sonara-rental-customer-protections.cjs",
    "Draft rent/deposit allocations; waits for trusted jurisdiction preflight and an approved customer statement flow. It moves no money."],
  ["lib/sonara-security-geometry-formulas.cjs",
    "Integer spatial evidence math; waits for trusted coordinate provenance and a reviewed spatial-signal consumer. Geometry grants no access."],
  ["lib/sonara-spreadsheet-formulas.cjs",
    "Allowlisted workbook value math; waits for a tenant-scoped schema/input reader and reviewed values-only export route."],
  ["lib/sonara-terms-and-policy-governance.cjs",
    "Terms/consent evidence evaluators; waits for immutable versioned acceptance records and owner-reviewed policy publication. It publishes or signs nothing."],
  ["lib/sonara-time-authority.cjs",
    "Timestamp/calendar calculations; waits for independently recorded anchors and a scheduling evidence consumer. It guarantees no execution time."],
  // The four below became test-only on 1 October 2026, when the operator console
  // was removed at the owner's instruction. Each was read by an /admin page and
  // by nothing else, so the console's removal is the whole reason they are here.
  // None is research-only in the sense the entries further down are: these are
  // working modules whose one consumer went away, and each says what would wire
  // it back.
  ["lib/optional-ai-gateway.cjs",
    "Reads whether an optional AI gateway is configured, without ever rendering a key. Its only consumer was "
    + "/admin/ai-gateway. It stays test-only until a customer-facing surface needs to say whether model drafting is "
    + "available; AGENTS.md keeps Provider Gateway as the boundary either way, so this reports and authorises nothing."],
  ["lib/sonara-model-safety-resilience.cjs",
    "The quarantined model-safety reference: a non-executing record of what defensive evaluation of unmodified models "
    + "would require. Its only consumer was /admin/model-safety-resilience. Deliberately not wired -- enabling it is a "
    + "separate decision -- and tests/model-safety-resilience.test.js holds the dependency and distribution rules."],
  ["lib/sonara-system-design-engine.cjs",
    "The system-design mapping engine: 28 upstream topics mapped to SONARA-owned designs, with copying blocked because no "
    + "upstream licence file was found. Its only consumer was /admin/system-design-intelligence. It is reference material "
    + "for a person, so it waits for a surface that presents it as that rather than as something to run."],
  ["lib/sonara-aggregator-sourcing-policy.cjs",
    "Research-only adapter sourcing economics and verified-depth formulas. It grants no provider or runtime authority; "
    + "keep it test-only until a reviewed connector control-plane surface explicitly consumes the policy."],
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

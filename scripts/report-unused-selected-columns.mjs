#!/usr/bin/env node
// Columns a query asks Supabase for, and then nothing uses.
//
// This exists because of a bug on the most sensitive gate in the product.
// `evaluatePolicy` in routes/creator-generation-routes.cjs selected
// `consent_scope` on every voice job -- the field recording what the person
// actually agreed to -- and compared it to nothing. A permission granted for
// text-to-speech authorised a voice clone.
//
// The column being in the `select` list is precisely what made it look checked.
// Nobody reading the query would have thought the scope went unexamined; it was
// right there in the request. That is this repository's recurring defect in its
// purest form: a signal that reports success without being true.
//
// **Two tiers, because one measure cannot be both right about this codebase and
// sharp enough to find that bug.**
//
//   Tier 1, gating: the column is named nowhere in the whole file. That is
//   strong evidence and there are three of them, each opened and ruled on
//   below. `--check` fails on a fourth nobody has ruled on.
//
//   Tier 2, advisory: the column is named in the file but not in the function
//   that asked for it. **This is the tier that would have caught the consent
//   bug** -- routes/creator-generation-routes.cjs names `consent_scope` eight
//   times, in the consent POST handler, in the permission picker and in a
//   constant, so the one function ignoring it was hidden behind seven that did
//   not.
//
// Tier 2 does not gate, and saying why matters more than the rule. Helpers that
// read a row fetched by their caller are ordinary here and correct --
// `periodSentence` in lib/sonara-billing.cjs and `billingRowOpensProduct` in
// lib/sonara-paid-access.cjs are both that shape. Gating on tier 2 would mean
// nineteen written exemptions, and exemptions written quickly to clear a gate
// are how a reason nobody rechecks ends up being what the next person reads
// instead of checking. So tier 2 prints, and a person looks.
//
// It found the billing page fetching `current_period_end` and never showing it,
// so a customer read "Core monthly: active" with no renewal date -- and never
// asking for `cancel_at_period_end` at all, so somebody who had cancelled read
// the same sentence.
//
// Neither tier says anything about whether a column that IS named is used
// correctly. This is a prompt to open the file, not a proof of a defect.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { withoutComments } = require(path.join(root, "lib", "sonara-comment-stripping.cjs"));

// espree ships inside eslint, which is already a direct devDependency and
// already runs in this chain. Resolved through eslint's own require so it is
// found wherever pnpm put it.
//
// If it cannot be found this script stops. It does NOT fall back to the
// file-level comparison: a check that quietly downgrades to a weaker measure
// while still printing "passed" is the exact failure this script exists to
// catch.
let parse;
try {
  const eslintRequire = createRequire(require.resolve("eslint/package.json"));
  ({ parse } = eslintRequire("espree"));
} catch (error) {
  console.error(`ERROR: could not load espree (${error.message}).`);
  console.error("This check needs a parser to tell one function from another, and there is no weaker version of it worth running.");
  process.exit(1);
}

// Tier 1 rulings, keyed by file. Each was checked by opening the file.
const ACCOUNTED = Object.freeze({
  "routes/sonara-last9-routes.cjs": {
    columns: ["capabilities", "connection_mode"],
    reason: "PUBLIC_GETS serves /api/integrations/providers as JSON. The rows are forwarded whole; the caller uses these fields and this file has no reason to."
  },
  "routes/sonara-route-registry-routes.cjs": {
    columns: ["category"],
    reason: "Notification category is carried into the response rather than rendered. Selected so the shape does not change if a page starts showing it."
  },
  "lib/sonara-paid-entitlement.cjs": {
    columns: ["metadata"],
    reason: "Read by billingRowOpensProduct in lib/sonara-paid-access.cjs, which uses metadata.workspace to decide whether a one-workspace plan opens THIS product. Both files opened to confirm it."
  },
  "routes/sonara-rota-routes.cjs": {
    columns: ["employee_id", "role_label"],
    reason: "The shift rows are handed whole to layOutWeek in lib/sonara-rota-week.cjs, which keys on employee_id to count how many people are rostered and to look each one's name up, and carries role_label onto the shift it draws. The route moves the values, it does not read them. Both files opened to confirm it."
  },
  "routes/sonara-recurring-invoice-routes.cjs": {
    columns: ["service_id"],
    reason: "The arrangement's lines are handed whole to buildInvoice in lib/sonara-recurring-invoices.cjs, which copies service_id onto each customer_invoice_lines row so an invoice line still points at the service it bills for. The route deliberately never touches it -- it moves the value, it does not read it. Both files opened to confirm it."
  },
  "lib/sonara-invoice-paid-notice.cjs": {
    columns: ["amount_cents", "total_cents"],
    reason: "Both rows are handed whole to settle() in lib/sonara-invoice-settlement.cjs, which reads invoice.total_cents directly and payment.amount_cents inside totalPaid(). This file deliberately never touches either: doing its own arithmetic over them is how the balance shown on a notification and the balance shown on the receivables page come to disagree. Both files opened to confirm it."
  },
  "routes/sonara-public-booking-routes.cjs": {
    columns: ["employee_id"],
    reason: "The rota rows are handed whole to shiftSpans and freeStaffFor in lib/sonara-booking-availability.cjs, which key on shift.employee_id to work out who is free and which of them the appointment goes to. The route deliberately never touches it -- rendering a rostered person's id on a page a stranger can open would publish the rota. Both files opened to confirm it."
  }
});


const SOURCE_DIRS = ["routes", "lib"];
const EXTRA_FILES = ["server.js"];

// select=a,b,c inside a PostgREST query string. Two or more columns, because a
// single-column select is almost always a count or an existence probe, and the
// column being unused there is the point rather than a defect.
const SELECT = /select=([a-z0-9_,]{3,})(?=[&`"'])/gi;

// The selects this script cannot audit, counted rather than ignored.
//
// The character class above excludes `*`, so `select=*` was invisible here --
// and "101 multi-column selects across 181 runtime files" read as coverage
// while thirty-five queries went unexamined. That is the second shape in
// .claude/skills/checks-that-cannot-lie: measuring a different population from
// the one claimed.
//
// It is not a hypothetical. /creator-studio/generation/jobs/:jobId selects `*`
// on the asset table, loads each output's provenance -- the service that made
// the file, the rights and consent attestations, the checksum -- and rendered
// none of it. Exactly the defect this script exists to find, in exactly the
// select style it could not see.
//
// A star select cannot be audited column by column, because the query does not
// name its columns; the schema does. Listing every column of the table and
// asking whether each is used would flag a row handed whole to a helper, which
// is normal here and is why tier 2 exists. So this does the one honest thing
// available: it counts them, says so in the summary, and holds a ratchet. The
// blindness may shrink and may not grow.
const STAR_SELECT = /select=\*/gi;

// The other kind this script cannot read: a select whose column list is built
// at run time. `select=${page.select}` and `select=${PROVENANCE_COLUMNS.join(",")}`
// are both perfectly good code and both opaque to a regex over the source.
//
// Found while adding the star count, by noticing the audited total had dropped
// by one: the provenance change earlier the same day replaced a literal
// `select=bucket_id,object_path` with a computed list, which moved one query
// out of the audited bucket without anybody deciding to. Twenty-three of these
// exist. Most are fine -- the list is a frozen constant a test asserts against
// the schema -- but "fine" is a judgement made per query, and the number being
// visible is what makes anybody make it.
const COMPUTED_SELECT = /select=\$\{/g;

// Present on 2 September 2026, counted over stripped source.
//
// These are matched **exactly**, not as ceilings, and the reason is a probe.
// The first draft failed only when a count rose. Breaking the star matcher then
// dropped the count to zero and the check **passed**, printing "0 `select=*`
// (ceiling 34)" -- a confident zero over thirty-four unaudited queries, which
// is the whole defect this repository is organised against.
//
// A fall is good news and still has to be recorded: fix a query, lower the
// number here, say which one. That makes a broken matcher indistinguishable
// from an unrecorded improvement, and both stop the build.
//
// The star figure is 34 rather than the 35 a plain grep reports, because one
// `select=*` sits inside a comment in routes/sonara-last9-routes.cjs explaining
// why star selects were removed from the record pages. Comments are stripped
// before counting, here as everywhere else in this script.
// 34 on 2 September 2026, then 33 the same afternoon: the generation job page's
// asset read was narrowed from `select=*` to the seven columns it actually
// renders. That query is the one that hid the provenance defect, so it is the
// right one to have gone first. Its replacement is written out literally rather
// than joined from a constant -- a computed list is readable to a person and
// opaque to this script, which would have traded one blindness for the other.
// 32 as of the second narrowing: /creator-studio/voice-permissions read the
// whole consent row and renders eight fields. Named literally, like the
// outputs read before it -- a list joined from a constant is readable to a
// person and opaque to this script.
// 31 on 3 September 2026: `readAccount` in lib/sonara-connected-payments.cjs
// fetched all thirteen columns of business_payment_accounts to use one. The
// other four it now names -- charges_enabled, payouts_enabled,
// details_submitted, state_checked_at -- had no reader at all until the same
// change: the function that writes them, `cacheAccountState`, was exported and
// called from nowhere in the repository, so they were null on every row. The
// connected-payments page writes them after Stripe answers and reads them back
// when Stripe cannot be reached.
// 27 on 3 September 2026: the four remaining `select=*` reads in
// routes/creator-generation-routes.cjs, which is the file AGENTS.md governs
// most directly -- "enforce provenance, consent, and anti-clone safety". Its
// HTML pages had already been narrowed; its JSON endpoints had not, so the
// pages and the API over the same records disagreed about what may be
// returned. Two of the four gave something away for nothing:
//
//   - the asset list returned `bucket_id` and `object_path`, a file's location
//     inside a private bucket. Nothing used them -- checked across public/,
//     tests/ and docs/ -- and the download route reads them itself in its own
//     scoped query before signing a 300-second URL.
//   - the job reads returned `provider_response`, the raw body an external
//     provider sent back, which nothing reads either.
//
// The job column list was derived by grepping for `job.` and `job?.` rather
// than by eye. The first pass matched only `job.` and missed `title`, which
// `jobTitle()` reaches through optional chaining -- shipping that would have
// retitled every job page to "Text to speech request".
const STAR_SELECT_COUNT = 27;
const COMPUTED_SELECT_COUNT = 23;

// A column named in a comment is a column discussed, not used. Same reasoning
// and the same expressions as scripts/report-orphan-tables.mjs.
// One implementation, in lib/sonara-comment-stripping.cjs, because this script
// and report-orphan-tables.mjs both had a copy and both copies had the same bug.
// The reason it was wrong is written out there.

function sourceFiles() {
  const files = [...EXTRA_FILES];
  for (const directory of SOURCE_DIRS) {
    for (const name of fs.readdirSync(path.join(root, directory)).sort()) {
      if (name.endsWith(".cjs")) files.push(`${directory}/${name}`);
    }
  }
  return files;
}

// Every function in the file, with its source range and a usable name. Walked
// by hand rather than with a visitor library, because the tree shape needed
// here is just "nodes that have a body and a range".
function functionsIn(ast) {
  const found = [];
  const seen = new Set();
  const walk = (node, inheritedName) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry, inheritedName);
      return;
    }
    // Only a direct binding names a function -- `const foo = () => {}` or
    // `foo: function () {}`. It is passed to the immediate children and no
    // further, so it labels the function it binds rather than everything nested
    // inside it.
    let name = inheritedName;
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
      // A name is NOT inherited from the enclosing function.
      //
      // It was, and it made every route handler in a file report under the
      // register function that wraps them -- so thirteen unrelated handlers
      // merged into one finding with thirteen columns, and which handler had
      // which was gone. An anonymous function is labelled by the line it starts
      // on, which is what somebody needs in order to go and look.
      name = node.id?.name || inheritedName || `anonymous@${node.loc?.start?.line ?? "?"}`;
      found.push({ name, start: node.range[0], end: node.range[1] });
    }
    // A named binding gives an arrow function its name: `const foo = () => {}`
    // and `foo: function () {}` both read better in a report than "(anonymous)".
    const named = node.type === "VariableDeclarator" ? node.id?.name
      : node.type === "Property" ? (node.key?.name || node.key?.value)
        : node.type === "AssignmentExpression" ? node.left?.property?.name
          : null;
    const isFunction = node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
    for (const key of Object.keys(node)) {
      if (key === "range" || key === "loc" || key === "parent") continue;
      // A function's own children inherit nothing: they are their own scope, and
      // the line label above is what identifies them.
      walk(node[key], isFunction ? null : (named || inheritedName));
    }
  };
  walk(ast, null);
  return found;
}

const files = sourceFiles();
if (files.length < 20) {
  console.error(`ERROR: only ${files.length} runtime files found. This report is measuring the wrong tree.`);
  process.exit(1);
}

const findings = [];
let selectsExamined = 0;

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  let ast;
  try {
    ast = parse(source, { ecmaVersion: "latest", sourceType: "script", range: true, loc: true });
  } catch (error) {
    console.error(`ERROR: could not parse ${file}: ${error.message}`);
    process.exit(1);
  }
  const functions = functionsIn(ast);

  for (const match of [...source.matchAll(SELECT)]) {
    const columns = match[1].split(",").filter(Boolean);
    if (columns.length < 2) continue;
    selectsExamined += 1;

    // The innermost function containing this query. A select outside every
    // function -- a module-level constant -- is scoped to the whole file, which
    // is the honest answer for something any function may use.
    const enclosing = functions
      .filter((entry) => entry.start <= match.index && match.index < entry.end)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start))
      .pop();
    const scope = enclosing
      ? { name: enclosing.name, text: source.slice(enclosing.start, enclosing.end) }
      : { name: "(module scope)", text: source };

    // Every select string inside the scope is removed before looking, so one
    // query naming a column does not count as another query using it.
    let body = withoutComments(scope.text);
    for (const other of body.matchAll(SELECT)) body = body.replaceAll(other[0], " ");

    const unused = columns.filter((column) => column !== "id" && !new RegExp(`\\b${column}\\b`).test(body));
    if (!unused.length) continue;

    // Tier 1 or tier 2, decided by whether the name appears anywhere else in
    // the file at all.
    let whole = withoutComments(source);
    for (const other of [...whole.matchAll(SELECT)]) whole = whole.replaceAll(other[0], " ");
    for (const column of unused) {
      const anywhere = new RegExp(`\\b${column}\\b`).test(whole);
      findings.push({ tier: anywhere ? 2 : 1, file, scope: scope.name, column });
    }
  }
}

if (!selectsExamined) {
  console.error("ERROR: no multi-column selects found at all. The pattern has stopped matching the code.");
  process.exit(1);
}

// Counted over the same file list, from the same stripped source, so the two
// figures describe one population split in two rather than two populations.
let starSelects = 0;
let computedSelects = 0;
const starFiles = new Set();
const computedFiles = new Set();
for (const file of files) {
  const stripped = withoutComments(fs.readFileSync(path.join(root, file), "utf8"));
  const stars = stripped.match(STAR_SELECT);
  if (stars) {
    starSelects += stars.length;
    starFiles.add(file);
  }
  const computed = stripped.match(COMPUTED_SELECT);
  if (computed) {
    computedSelects += computed.length;
    computedFiles.add(file);
  }
}

function group(tier, keyOf) {
  const byKey = new Map();
  for (const finding of findings.filter((entry) => entry.tier === tier)) {
    const key = keyOf(finding);
    if (!byKey.has(key)) byKey.set(key, { key, file: finding.file, scope: finding.scope, columns: new Set() });
    byKey.get(key).columns.add(finding.column);
  }
  return [...byKey.values()]
    .map((entry) => ({ ...entry, columns: [...entry.columns].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const tierOne = group(1, (finding) => finding.file);
const tierTwo = group(2, (finding) => `${finding.file}::${finding.scope}`);

const check = process.argv.includes("--check");
const unaccounted = [];
const stale = [];

for (const finding of tierOne) {
  const decision = ACCOUNTED[finding.key];
  if (!decision) {
    unaccounted.push(`${finding.key}: ${finding.columns.join(", ")}`);
    continue;
  }
  const surprises = finding.columns.filter((column) => !decision.columns.includes(column));
  if (surprises.length) unaccounted.push(`${finding.key}: ${surprises.join(", ")} (not covered by the recorded decision)`);
}

// A ruling that no longer describes anything. Somebody used the column, or the
// query changed -- either way the reason must not outlive the thing it excuses.
// That is the failure that left a form-reachability exemption reading "no page
// displays location_zones" while a page displayed them.
const tierOneByKey = new Map(tierOne.map((entry) => [entry.key, entry]));
for (const [key, decision] of Object.entries(ACCOUNTED)) {
  const finding = tierOneByKey.get(key);
  const resolved = decision.columns.filter((column) => !finding || !finding.columns.includes(column));
  if (resolved.length) stale.push(`${key}: ${resolved.join(", ")} is used now, or the query no longer asks for it`);
}

if (!check) {
  console.log(`${files.length} runtime files, ${selectsExamined} multi-column selects examined.\n`);

  console.log(`TIER 1 — asked for and named nowhere in the file (${tierOne.length}):\n`);
  if (!tierOne.length) console.log("  None.\n");
  for (const finding of tierOne) {
    const decision = ACCOUNTED[finding.key];
    console.log(`  ${finding.file}`);
    console.log(`    ${finding.columns.join(", ")}`);
    console.log(`    ${decision ? decision.reason : "NO RECORDED DECISION -- open the file and look."}\n`);
  }

  console.log(`TIER 2 — used elsewhere in the file, not by the function that asked (${tierTwo.length}). Advisory: a helper reading its caller's row is ordinary and correct. Worth a look when hunting this defect.\n`);
  if (!tierTwo.length) console.log("  None.\n");
  for (const finding of tierTwo) {
    console.log(`  ${finding.file} — ${finding.scope}()`);
    console.log(`    ${finding.columns.join(", ")}`);
  }
  console.log("");
}

if (unaccounted.length) {
  console.error(`ERROR: these columns are asked for and named nowhere in the file, and nobody has ruled on them:\n  ${unaccounted.join("\n  ")}\n`);
  console.error("Either use the column, stop selecting it, or record why in ACCOUNTED at the top of this script.");
  process.exit(1);
}
if (stale.length) {
  console.error(`ERROR: these recorded rulings have outlived their reason:\n  ${stale.join("\n  ")}\n`);
  console.error("Remove the entry. A reason nobody rechecks is what the next person reads instead of checking.");
  process.exit(1);
}

if (computedSelects !== COMPUTED_SELECT_COUNT) {
  console.error(
    `ERROR: ${computedSelects} selects build their column list at run time; this file records ${COMPUTED_SELECT_COUNT}.\n` +
      `They are in: ${[...computedFiles].sort().join(", ")}\n`
  );
  console.error(
    "Nothing here can read a computed list, so a column fetched and never used inside one is invisible.\n" +
      "If the count rose, name the columns in the query instead. If it fell, lower COMPUTED_SELECT_COUNT and say\n" +
      "which query was fixed -- a fall nobody records looks exactly like a matcher that has stopped matching."
  );
  process.exit(1);
}

if (starSelects !== STAR_SELECT_COUNT) {
  console.error(
    `ERROR: ${starSelects} \`select=*\` queries; this file records ${STAR_SELECT_COUNT}. Each one is a read this script cannot audit.\n` +
      `They are in: ${[...starFiles].sort().join(", ")}\n`
  );
  console.error(
    "If the count rose, name the columns the caller actually uses -- or, if the whole row really is handed on, raise\n" +
      "STAR_SELECT_COUNT deliberately and say which query it was. If it fell, lower it and say which one was fixed:\n" +
      "a fall nobody records looks exactly like a matcher that has stopped matching, which is how this guard was found."
  );
  process.exit(1);
}

console.log(
  `Selected-column check passed: ${selectsExamined} multi-column selects across ${files.length} runtime files. ` +
    `Tier 1: ${tierOne.length}, all ruled on. Tier 2: ${tierTwo.length}, advisory. ` +
    `Not audited: ${starSelects} \`select=*\` (recorded ${STAR_SELECT_COUNT}) and ${computedSelects} built at run time ` +
    `(recorded ${COMPUTED_SELECT_COUNT}), across ${new Set([...starFiles, ...computedFiles]).size} files -- ` +
    "neither names its columns in the source, so nothing here can say whether they are used."
);

// The files, on a passing run and not only on a failing one.
//
// They were printed only inside the two count mismatches above, so a green run
// said "31 queries this script cannot audit" and gave nobody a way to find
// them. That is a population named by number and not by name, which is the
// thing this script's own header asks for: `110 runtime files, 51 selects
// examined` is checkable, "verified" is not. A count of unauditable reads that
// you cannot locate is the same shape one level up.
console.log(
  `  \`select=*\` in: ${[...starFiles].sort().join(", ")}\n` +
  `  built at run time in: ${[...computedFiles].sort().join(", ")}`
);

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(filePath), `Missing required sync file: ${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function workflowStep(workflow, name) {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow step: ${name}`);
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next === -1 ? workflow.length : next);
}

const workflow = read(".github/workflows/controlled-production-deploy.yml");
const jobEnvStart = workflow.indexOf("    env:\n");
const stepsStart = workflow.indexOf("\n    steps:");
assert.ok(jobEnvStart !== -1 && stepsStart > jobEnvStart, "Unable to isolate controlled deployment job env");

const jobEnv = workflow.slice(jobEnvStart, stepsStart);
assert.doesNotMatch(
  jobEnv,
  /SUPABASE_SERVICE_ROLE_KEY/,
  "The RLS-bypassing service-role key must never be exposed at job scope"
);

const secretBindings = workflow.match(/\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/g) || [];
assert.equal(secretBindings.length, 3, "The service-role key must be bound to exactly three guarded workflow steps");

const guard = workflowStep(workflow, "Require protected production credentials");
assert.match(guard, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/);
// The property is that this step REFUSES to continue without the service-role
// key. It used to be asserted by its spelling -- five literal
// `test -n "${X:-}"` lines -- and on 17 September 2026 that step was rewritten
// to name each missing credential instead, because `test -n` under `set -e`
// exits with no message at all and five secrets shared one silent failure.
//
// So this now accepts either form and still rejects the key being dropped from
// the requirement altogether. Matching the spelling was checking how the
// requirement was written rather than that it was there.
//
// Behaviour, not just text: tests/the-credential-gate-speaks-before-the-chain-runs.test.js
// extracts this step's script and executes it with the key empty, asserting it
// exits non-zero and names it. That is the assertion that cannot be satisfied by
// a form nobody thought of; this one keeps the static gate honest alongside it.
assert.ok(
  /test -n "\$\{SUPABASE_SERVICE_ROLE_KEY:-\}"/.test(guard)
    || /for name in [^\n]*\bSUPABASE_SERVICE_ROLE_KEY\b[^\n]*; do/.test(guard),
  "The credential guard step must require SUPABASE_SERVICE_ROLE_KEY to be non-empty, "
    + "either as a literal `test -n` check or by naming it in the required-credential loop."
);

// Renamed from "...for database verification" on 9 September 2026: the pulled
// environment now also feeds the live Stripe price check, which was moved ahead
// of the migration apply so a failure there stops before touching production's
// schema. The step is the same step and the assertion below is unchanged --
// only what it is called, because it no longer serves only the database.
const pull = workflowStep(workflow, "Pull production environment for configuration verification");
assert.doesNotMatch(pull, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(pull, /vercel@59.19.1 env pull/);

const catalogVerify = workflowStep(workflow, "Verify production catalog database boundary");
assert.match(catalogVerify, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/);
assert.match(catalogVerify, /verify-production-product-catalog\.mjs --database-only/);

const databaseVerify = workflowStep(workflow, "Verify complete production Supabase state");
assert.match(databaseVerify, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/);
assert.match(databaseVerify, /verify-production-supabase\.mjs/);
assert.match(databaseVerify, /--env-file=\.env\.production\.catalog-verification/);

const cleanup = workflowStep(workflow, "Remove temporary production environment material");
assert.match(cleanup, /rm -f \.env\.production\.catalog-verification/);
assert.match(cleanup, /test ! -e \.env\.production\.catalog-verification/);

const workspace = read("pnpm-workspace.yaml");
// The pin moves when the advisory does. GHSA-rgw5-rvv9-x895 made 5.0.8
// vulnerable in turn -- it bypassed the CVE-2026-14257 mitigation this pin was
// added for -- so the floor was 5.0.9. Asserting the range rather than one exact
// string would have let the pin silently fall behind the advisory, which is the
// failure this line exists to prevent.
//
// Moved on 30 September 2026, and this time the pin also had to grow. Three new
// advisories put every installed version in range -- GHSA-6j4f-fj2g-mc7p
// (uncontrolled recursion in parseCommaParts), GHSA-qhr7-859c-m2p7 (uncontrolled
// recursion on nested brace groups) and GHSA-q2hr-2g5m-vwhr (quadratic-time
// expansion of the `{a},b}` rewrite), all denial of service. OSV Scanner 2.6.0
// reported nine findings: 1.1.18, 2.1.4 and 5.0.9 each against all three.
//
// The single `>=4.0.0` range covered only the 5.x install, so two whole majors
// were never pinned at all and the one that was is now itself in range. Three
// ranges, one per installed major, each at the highest of the three patched
// versions the advisories name.
assert.match(
  workspace,
  /"brace-expansion@<2\.0\.0": "1\.1\.21"/,
  "brace-expansion 1.x must stay pinned above GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7 and GHSA-q2hr-2g5m-vwhr"
);
assert.match(
  workspace,
  /"brace-expansion@>=2\.0\.0 <3\.0\.0": "2\.1\.7"/,
  "brace-expansion 2.x must stay pinned above GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7 and GHSA-q2hr-2g5m-vwhr"
);
assert.match(
  workspace,
  /"brace-expansion@>=4\.0\.0 <5\.0\.12": "5\.0\.12"/,
  "brace-expansion 5.x must stay pinned above GHSA-rgw5-rvv9-x895 and the three 30 September denial-of-service advisories"
);
// Moved on 29 September 2026. The pin was `<6.28.0: 6.28.0`, added for
// GHSA-v3r7-h72x-cjcm. GHSA-3wwx-pv8p-q78v then put 6.28.0 itself in range --
// a denial of service through an unhandled error in WebSocket
// permessage-deflate decompression, patched in 6.28.1 -- so the override was
// pinning the tree *to* a vulnerable version rather than away from it, and five
// CI jobs that run `pnpm audit` went red together. Exactly the staleness this
// line's own design anticipates: the string is matched exactly so that a pin
// falling behind an advisory fails here rather than passing quietly.
assert.match(
  workspace,
  /"undici@<6\.28\.1": "6\.28\.1"/,
  "undici must stay pinned above GHSA-v3r7-h72x-cjcm and GHSA-3wwx-pv8p-q78v"
);
// Moved on 2 September 2026, and this line is why it moved deliberately. The
// pin was `>=3.0.0 <3.1.5: 3.1.5`, added for GHSA-7p8r-x3mc-p8w7. Three more
// advisories then put 3.1.5 itself in range -- GHSA-f65p-4m7j-42xc and
// GHSA-fph4-wmhf-6fwf (both SSRF) and GHSA-jqff-g426-hqxp (host confusion), all
// patched in 3.1.6 -- so the override was pinning the tree *to* the vulnerable
// version rather than away from it. The range form `<3.1.6` does not pin to a
// version that can go stale the same way.
// Moved again on 29 September 2026, for the third time and the same reason. Two
// more advisories put 3.1.6 in range -- GHSA-qw65-cvwx-89v3 (authority
// injection via an unvalidated port) and GHSA-58mr-gqgx-xq4g (host confusion
// via an unclosed bracket, which lists no patched version for 3.1.6 at all) --
// both cleared by 3.1.7.
// Moved again on 30 September 2026, for the fourth time and the same reason.
// GHSA-hrr3-gc8f-f4qj -- inconsistent host case normalization via percent-encoded
// octets -- puts 3.1.7 in range, one day after 3.1.7 was pinned for the third
// round. Patched in 3.1.8. The pattern this comment has recorded three times now
// is that this package's advisories arrive faster than the pin: the exact-string
// match is what makes that visible instead of quiet.
assert.match(
  workspace,
  /"fast-uri@<3\.1\.8": "3\.1\.8"/,
  "fast-uri must stay pinned above GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp, " +
    "GHSA-qw65-cvwx-89v3, GHSA-58mr-gqgx-xq4g and GHSA-hrr3-gc8f-f4qj"
);

// `.ai/shared/CURRENT_STATE.md` is the baseline two different assistants read
// before deciding what to do. It is hand-written, so it drifts. The question
// worth asking is therefore not "is it fresh" -- nothing here can keep a
// hand-written file fresh -- but "does it still claim to be fresh once it is
// not".
//
// What this replaces asserted that "PR #100", "PR #101", "PR #103", "PR #104"
// and "production lag" each appeared somewhere in the file, and then printed
// "shared state are aligned". On 4 September 2026 all five were still present
// while the file's two opening claims had been false for six weeks: it said
// `main` was `fa9402a8...` when it was `ccaea37...`, and that no live
// `claude/*` branch existed when origin carried eight. Every substring matched,
// so the chain stayed green over it. A check that cannot fail on the thing it
// names is the defect `CLAUDE.md` describes.
//
// Two halves now, and both must hold.
const currentState = read(".ai/shared/CURRENT_STATE.md");

// Half one, unchanged in intent: the audit record must survive. Deleting it
// erases findings somebody actually made, and this is what stops that.
for (const marker of ["PR #100", "PR #101", "PR #103", "PR #104", "production lag"]) {
  assert.match(currentState, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

// Half two: the file must name the commit it describes, and while that commit
// is not the tip of `main` it must point at what is current instead.
const baseline = /<!--\s*baseline:\s*([0-9a-f]{40})\s*-->/.exec(currentState);
assert.ok(
  baseline,
  ".ai/shared/CURRENT_STATE.md must carry `<!-- baseline: <40-char sha> -->` naming the commit it describes. " +
    "Without it there is no way to tell a current document from a stale one, which is how it went six weeks out of date."
);
const [, baselineSha] = baseline;

function git(...args) {
  // These are local, read-only history questions. In a partial clone, probing
  // an invented SHA otherwise triggers a network fetch for a nonexistent
  // object. Keep the full-history/shallow distinction below without fetching.
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }
  });
}

function resolveRef(ref) {
  const result = git("rev-parse", "--verify", "--quiet", ref);
  return result.status === 0 ? result.stdout.trim() : null;
}

// Is the baseline a real commit? A baseline nobody can resolve is a baseline
// nobody checked, and it would satisfy every line below while meaning nothing.
//
// The catch is that `actions/checkout` clones at depth 1 unless a workflow asks
// for more, and only two here do. In that clone the July baseline is simply not
// present, and `cat-file` cannot tell "this SHA is fiction" from "this SHA was
// never fetched" -- both are exit 128.
//
// The first version asserted the commit existed unconditionally and turned
// three CI jobs red on a document that was correct. The shallow case was
// reasoned about one line further down, for resolving the tip, and not applied
// here: the same hazard, seen once and handled once.
//
// So: verify whenever the history is there to answer. Only when the object is
// missing *and* the repository is truncated is that treated as "cannot prove"
// rather than "is fiction" -- and it says so on stdout, because a check that
// quietly stops checking is what this command was rewritten to stop.
//
// Both branches are reached by a real environment, checked rather than assumed
// by grepping the workflows that run `verify:config`:
//
//   controlled-production-deploy.yml   fetch-depth: 0  -> strict branch
//   sonara-industries-ci.yml           default depth 1 -> exemption branch
//
// The higher-stakes of the two is the one that verifies.
//
// **What that does not cover, stated plainly:** in a shallow clone a fabricated
// SHA is indistinguishable from an unfetched one, so this cannot reject it
// there -- and that includes most development containers, whose clone carries a
// `.git/shallow` file even after being deepened enough to hold the baseline.
// The null OID is the exception: it is git's own sentinel for "no object",
// never a commit at any depth, so it is rejected everywhere. The guarantee that
// survives truncation is the pointer requirement below, which does not depend
// on history at all.
assert.notEqual(
  baselineSha,
  "0".repeat(40),
  ".ai/shared/CURRENT_STATE.md names the null commit as its baseline, which is git's way of saying no object."
);

if (git("cat-file", "-e", `${baselineSha}^{commit}`).status !== 0) {
  assert.equal(
    git("rev-parse", "--is-shallow-repository").stdout.trim(),
    "true",
    `.ai/shared/CURRENT_STATE.md names baseline ${baselineSha}, which is not a commit in this repository.`
  );
  process.stdout.write(
    `Shared state: baseline ${baselineSha} is not in this checkout and the clone is truncated, so whether it is a ` +
      "real commit was NOT verified. The superseded-by pointer below is required regardless.\n"
  );
}

// A shallow CI checkout carries neither ref -- confirmed by cloning this
// repository at depth 1 and running this command in it. That is not a reason to
// pass: an unresolvable tip takes the same branch as a stale baseline, so the
// pointer is then required unconditionally. Erring towards requiring it keeps
// the failure in the safe direction -- the alternative is a check that quietly
// stops checking on exactly the machines it runs on most.
const mainTip = resolveRef("refs/remotes/origin/main") || resolveRef("refs/heads/main");

if (mainTip !== baselineSha) {
  const superseded = /<!--\s*superseded-by:\s*(\S+)\s*-->/.exec(currentState);
  assert.ok(
    superseded,
    `.ai/shared/CURRENT_STATE.md describes ${baselineSha}, which is ${mainTip ? `not the tip of main (${mainTip})` : "not provably the tip of main from this checkout"}. ` +
      "A document that is behind must say where the current picture is: add `<!-- superseded-by: <path> -->`, " +
      "or refresh the file and move the baseline forward."
  );
  const target = path.join(root, superseded[1]);
  assert.ok(
    fs.existsSync(target),
    `.ai/shared/CURRENT_STATE.md points at ${superseded[1]}, which does not exist. A pointer to nothing is worse than no pointer.`
  );
}

const claudeSync = read(".ai/shared/CLAUDE_SYNC_2026-07-26.md");
assert.match(claudeSync, /claude\/fix-deploy-service-role-secret/);
assert.match(claudeSync, /375a2ef1b3809be76ccd4f3a00a107d8d9f788a9/);
assert.match(claudeSync, /fa9402a8671bae7934925c5c64f147a221bf4e16/);
assert.doesNotMatch(claudeSync, /service[_ -]?role[_ -]?key\s*[:=]\s*[A-Za-z0-9._-]{20,}/i);

// The shared assistant index must enumerate current skills and formula catalogues,
// not merely point to files that existed when the documentation was written.
const knowledgeIndex = spawnSync(process.execPath, ["scripts/generate-assistant-knowledge-index.mjs", "--check"], {
  cwd: root, encoding: "utf8"
});
assert.equal(knowledgeIndex.status, 0,
  "Shared assistant knowledge is stale or undiscoverable:\\n" + (knowledgeIndex.stderr || knowledgeIndex.stdout || ""));

// Codex discovers a different skill directory. Require a byte-for-byte
// generated bridge for each canonical Claude/shared skill; missing or stale
// manifests must fail the existing release chain, not silently drop a method.
const codexSkills = spawnSync(process.execPath, ["scripts/generate-codex-skill-bridges.mjs", "--check"], {
  cwd: root, encoding: "utf8"
});
assert.equal(codexSkills.status, 0,
  "Codex individual-model skill bridges are stale or missing:\\n" + (codexSkills.stderr || codexSkills.stdout || ""));

// Validate portable model packaging inputs without generating files or using provider APIs.
const packagedSkills = spawnSync(process.execPath, ["scripts/export-assistant-model-skill-packs.mjs", "--dry-run"], {
  cwd: root, encoding: "utf8"
});
assert.equal(packagedSkills.status, 0,
  "Portable model skill export failed: " + (packagedSkills.stderr || packagedSkills.stdout || ""));

console.log("Agent development sync verified: scoped Supabase secrets, deep database gate, catalog idempotency, dependency override, and shared state are aligned.");

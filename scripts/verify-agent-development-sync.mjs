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
assert.match(guard, /test -n "\$\{SUPABASE_SERVICE_ROLE_KEY:-\}"/);

const pull = workflowStep(workflow, "Pull production environment for database verification");
assert.doesNotMatch(pull, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(pull, /vercel@latest env pull/);

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
// added for -- so the floor is 5.0.9. Asserting the range rather than one exact
// string would have let the pin silently fall behind the advisory, which is the
// failure this line exists to prevent.
assert.match(
  workspace,
  /"brace-expansion@>=4\.0\.0 <5\.0\.9": "5\.0\.9"/,
  "Claude dependency hardening for brace-expansion must remain pinned"
);
assert.match(
  workspace,
  /"undici@<6\.28\.0": "6\.28\.0"/,
  "undici must stay pinned above GHSA-v3r7-h72x-cjcm"
);
// Moved on 2 September 2026, and this line is why it moved deliberately. The
// pin was `>=3.0.0 <3.1.5: 3.1.5`, added for GHSA-7p8r-x3mc-p8w7. Three more
// advisories then put 3.1.5 itself in range -- GHSA-f65p-4m7j-42xc and
// GHSA-fph4-wmhf-6fwf (both SSRF) and GHSA-jqff-g426-hqxp (host confusion), all
// patched in 3.1.6 -- so the override was pinning the tree *to* the vulnerable
// version rather than away from it. The range form `<3.1.6` does not pin to a
// version that can go stale the same way.
assert.match(
  workspace,
  /"fast-uri@<3\.1\.6": "3\.1\.6"/,
  "fast-uri must stay pinned above GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf and GHSA-jqff-g426-hqxp"
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

// The commit has to be real. A baseline nobody can resolve is a baseline nobody
// checked, and it would satisfy every line below while meaning nothing.
const knownCommit = spawnSync("git", ["cat-file", "-e", `${baselineSha}^{commit}`], { cwd: root, encoding: "utf8" });
assert.equal(
  knownCommit.status,
  0,
  `.ai/shared/CURRENT_STATE.md names baseline ${baselineSha}, which is not a commit in this repository.`
);

function resolveRef(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

// A shallow CI checkout may carry neither ref. That is not a reason to pass:
// an unresolvable tip takes the same branch as a stale baseline, so the pointer
// is then required unconditionally. Erring towards requiring it keeps the
// failure in the safe direction -- the alternative is a check that quietly
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

console.log("Agent development sync verified: scoped Supabase secrets, deep database gate, catalog idempotency, dependency override, and shared state are aligned.");

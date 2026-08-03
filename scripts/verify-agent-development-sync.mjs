import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
assert.match(
  workspace,
  /"fast-uri@>=3\.0\.0 <3\.1\.5": "3\.1\.5"/,
  "fast-uri must stay pinned above GHSA-7p8r-x3mc-p8w7"
);

const currentState = read(".ai/shared/CURRENT_STATE.md");
for (const marker of ["PR #100", "PR #101", "PR #103", "PR #104", "production lag"]) {
  assert.match(currentState, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

const claudeSync = read(".ai/shared/CLAUDE_SYNC_2026-07-26.md");
assert.match(claudeSync, /claude\/fix-deploy-service-role-secret/);
assert.match(claudeSync, /375a2ef1b3809be76ccd4f3a00a107d8d9f788a9/);
assert.match(claudeSync, /fa9402a8671bae7934925c5c64f147a221bf4e16/);
assert.doesNotMatch(claudeSync, /service[_ -]?role[_ -]?key\s*[:=]\s*[A-Za-z0-9._-]{20,}/i);

console.log("Agent development sync verified: scoped Supabase secrets, deep database gate, catalog idempotency, dependency override, and shared state are aligned.");

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

for (const script of ["verify:all", "verify:postdeploy", "verify:env", "verify:stripe", "workers:smoke", "test:security", "test:docs"]) {
  assert.ok(packageJson.scripts[script], `missing package script ${script}`);
}

assert.equal(manifest.display, "standalone");
assert.ok(manifest.name);
assert.ok(manifest.short_name);
assert.ok(manifest.start_url);
assert.ok(manifest.theme_color);
assert.ok(manifest.background_color);

for (const file of [
  "supabase/migrations/007_platform_infrastructure_ops.sql",
  "docs/FINAL_PLATFORM_AUDIT.md",
  "docs/SECURITY_AUDIT_RESULTS.md",
  "docs/SUPABASE_DEPLOYMENT_RUNBOOK.md",
  "docs/POST_DEPLOY_VERIFY.md",
  "docs/LAUNCH_READINESS_SCORECARD.md",
]) {
  assert.equal(existsSync(file), true, `missing ${file}`);
}

console.log("Platform prep test passed.");

import { spawnSync } from "node:child_process";
import path from "node:path";
import { listPackages, readJson } from "./workspace.mjs";
import { failIfIssues, exists } from "./check-utils.mjs";

const requiredScripts = ["typecheck", "build", "smoke"];
const requiredRoutes = [
  "packages/web/src/app/about/page.ts",
  "packages/web/src/app/pricing/page.ts",
  "packages/web/src/app/contact/page.ts",
  "packages/web/src/app/support/page.ts",
  "packages/web/src/app/help/page.ts",
  "packages/web/src/app/feedback/page.ts",
  "packages/web/src/app/security/page.ts",
  "packages/web/src/app/business-builder/page.ts",
  "packages/web/src/app/creator-studio/page.ts",
  "packages/web/src/app/growth-studio/page.ts",
  "packages/web/src/app/settings/readiness/page.ts",
  "packages/web/src/app/settings/security/page.ts",
  "packages/web/src/app/auth/callback/page.ts",
  "packages/web/src/app/forgot-password/page.ts",
  "packages/web/src/app/reset-password/page.ts",
  "packages/web/src/app/admin/email-readiness/page.ts",
  "packages/web/src/app/admin/owner-bootstrap/page.ts",
  "packages/web/src/app/admin/github-update-watcher/page.ts"
];

failIfIssues(
  "Route smoke manifest",
  requiredRoutes
    .filter((filePath) => !exists(filePath))
    .map((filePath) => `Missing smoke route file: ${filePath}`)
);

for (const packageDir of listPackages()) {
  const manifest = readJson(path.join(packageDir, "package.json"));
  for (const scriptName of requiredScripts) {
    if (!manifest.scripts?.[scriptName]) {
      throw new Error(`${manifest.name} missing package script: ${scriptName}`);
    }
  }
}

run("scripts/validate-infrastructure.mjs");
run("scripts/typecheck.mjs");
run("scripts/build.mjs");

for (const packageDir of listPackages()) {
  const result = spawnSync(process.execPath, ["scripts/smoke-package.mjs", packageDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Smoke gate passed for every package script.");

function run(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

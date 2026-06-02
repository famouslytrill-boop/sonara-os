import fs from "node:fs";
import path from "node:path";
import { exists, failIfIssues, readJson, repoPath } from "./check-utils.mjs";

const issues = [];
const manifest = readJson("package.json");

for (const scriptName of [
  "lint",
  "typecheck",
  "build",
  "smoke:routes",
  "check:legacy",
  "check:public-claims",
  "check:risky-features",
  "check:env-safety",
  "check-license-risk",
  "check-provider-registry",
  "check-technology-registry",
  "check:github-radar",
  "check:github-radar-risk",
  "check:github-radar-secrets",
  "check:auto-install-disabled",
  "check:supabase-env",
  "check:supabase-service-role",
  "check:supabase-migrations",
  "check:supabase-rls",
  "check:supabase-storage",
  "check:supabase-integrations",
  "check:communications-risk",
  "check:phone-provider-registry",
  "check:call-consent-policy",
  "check:voip-public-claims",
  "check:video-rendering-risk",
  "check:video-rights-policy",
  "check:hyperframes-registry",
  "check:video-public-claims",
  "check-app-store-readiness",
  "check-privacy-data-map",
  "check-email-technology-registry",
  "check-vector-database-registry",
  "check-database-technology-risk",
  "check-alert-redaction-policy",
  "check:vercel-env-docs",
  "check:live-readiness",
  "verify:supabase",
  "verify:supabase-integrations",
  "verify:db",
  "validate:infrastructure",
  "verify:all"
]) {
  if (!manifest.scripts?.[scriptName]) {
    issues.push(`package.json missing script: ${scriptName}`);
  }
}

for (const requiredFile of [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "packages/web/src/index.html",
  "packages/web/src/site.webmanifest",
  "packages/web/src/app/admin/email-readiness/page.ts",
  "packages/web/src/app/settings/readiness/page.ts",
  "docs/audits/MASTER_LIVE_ACTIVATION_PLAN.md",
  "docs/audits/COMBINED_MASTER_GO_LIVE_PLAN.md",
  "docs/audits/FINAL_MASTER_LIVE_ACTIVATION_REPORT.md",
  "docs/deployment/VERCEL_ENVIRONMENT_VARIABLES.md",
  "docs/supabase/SUPABASE_CORE_BACKEND.md",
  "docs/supabase/SUPABASE_RLS_LAUNCH_REVIEW.md",
  "docs/supabase/SUPABASE_STORAGE_BUCKETS.md",
  "docs/app-store/APP_STORE_READINESS.md",
  "docs/legal/APP_PRIVACY_DATA_MAP.md"
]) {
  if (!exists(requiredFile)) {
    issues.push(`Missing live-readiness file: ${requiredFile}`);
  }
}

if (exists("package-lock.json")) {
  issues.push("package-lock.json exists.");
}

const migrationsDir = repoPath("supabase/migrations");
if (fs.existsSync(migrationsDir)) {
  const versions = new Map();
  for (const fileName of fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"))) {
    const version = fileName.split("_")[0];
    versions.set(version, [...(versions.get(version) ?? []), fileName]);
  }
  for (const [version, files] of versions) {
    if (files.length > 1) {
      issues.push(`Duplicate migration version ${version}: ${files.join(", ")}`);
    }
  }
}

const workflowSource = exists(".github/workflows/ci.yml")
  ? fs.readFileSync(path.join(repoPath(".github/workflows/ci.yml")), "utf8")
  : "";
if (!workflowSource.includes("pnpm install --frozen-lockfile")) {
  issues.push("CI workflow must run pnpm install --frozen-lockfile.");
}
if (!workflowSource.includes("cache: pnpm")) {
  issues.push("CI workflow must use pnpm cache.");
}

failIfIssues("Live readiness check", issues);

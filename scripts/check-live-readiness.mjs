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
  "check:vercel-env-docs",
  "check:live-readiness",
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
  "docs/audits/FINAL_MASTER_LIVE_ACTIVATION_REPORT.md",
  "docs/deployment/VERCEL_ENVIRONMENT_VARIABLES.md"
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

import fs from "node:fs";
import path from "node:path";
import { failIfIssues, readJson, repoPath } from "./check-utils.mjs";

const issues = [];
const rootPackage = readJson("package.json");

if (!rootPackage.packageManager?.startsWith("pnpm@")) {
  issues.push("package.json packageManager must declare pnpm as the single package manager.");
}

if (!fs.existsSync(repoPath("pnpm-lock.yaml"))) {
  issues.push("pnpm-lock.yaml is required.");
}

for (const lockfile of ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lockb"]) {
  if (fs.existsSync(repoPath(lockfile))) {
    issues.push(`Unexpected non-pnpm lockfile found: ${lockfile}`);
  }
}

for (const [scriptName, scriptValue] of Object.entries(rootPackage.scripts ?? {})) {
  if (/\bnpm\s+(install|run|audit|ci|exec)\b/.test(String(scriptValue))) {
    issues.push(`package.json script ${scriptName} invokes npm: ${scriptValue}`);
  }
}

const workflowDir = repoPath(".github/workflows");
if (fs.existsSync(workflowDir)) {
  for (const entry of fs.readdirSync(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(ya?ml)$/.test(entry.name)) {
      continue;
    }
    const relativePath = path.posix.join(".github/workflows", entry.name);
    const source = fs.readFileSync(repoPath(relativePath), "utf8");
    if (/\bnpm\s+(install|ci|audit|run)\b/.test(source)) {
      issues.push(`${relativePath} must not invoke npm install/ci/audit/run.`);
    }
    if (!source.includes('node-version: "22"') && !source.includes("node-version: '22'")) {
      issues.push(`${relativePath} should use Node 22.`);
    }
    if (!source.includes("cache: pnpm")) {
      issues.push(`${relativePath} should enable setup-node pnpm caching.`);
    }
    if (!source.includes("cache-dependency-path: pnpm-lock.yaml")) {
      issues.push(`${relativePath} should cache against pnpm-lock.yaml.`);
    }
  }
}

const localSetupPath = repoPath("docs/development/LOCAL_WINDOWS_SETUP.md");
if (fs.existsSync(localSetupPath)) {
  const localSetup = fs.readFileSync(localSetupPath, "utf8");
  if (!localSetup.includes("pnpm approve-builds")) {
    issues.push("Local Windows setup docs must mention pnpm approve-builds.");
  }
}

failIfIssues("Package manager gate", issues);

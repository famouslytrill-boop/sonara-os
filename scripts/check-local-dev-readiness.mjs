import { spawnSync } from "node:child_process";
import { exists, failIfIssues, readJson } from "./check-utils.mjs";

const issues = [];
const warnings = [];

if (!exists("package.json")) {
  issues.push("package.json is missing.");
} else {
  const manifest = readJson("package.json");
  if (!manifest.packageManager?.startsWith("pnpm@")) {
    issues.push("packageManager must use pnpm as the source of truth.");
  }
  if (!manifest.scripts?.dev) {
    issues.push("package.json is missing the dev script.");
  }
}

if (exists("package-lock.json")) {
  issues.push("package-lock.json exists. Remove it and use pnpm only.");
}

for (const command of [
  ["git", ["--version"], true],
  ["node", ["-v"], true],
  ["pnpm", ["-v"], true],
  ["gh", ["--version"], false],
  ["docker", ["--version"], false],
  ["supabase", ["--version"], false],
  ["ffmpeg", ["-version"], false]
]) {
  const [name, args, required] = command;
  const result = spawnSync(name, args, { encoding: "utf8", shell: true });
  if (result.status !== 0) {
    const message = `${name} is not available on PATH.`;
    if (required) {
      issues.push(message);
    } else {
      warnings.push(message);
    }
  }
}

if (!exists(".env.local")) {
  warnings.push(".env.local is missing; local auth/provider features will remain setup-gated.");
}
if (!exists("node_modules")) {
  warnings.push("node_modules is missing; run pnpm install --frozen-lockfile.");
}

for (const warning of warnings) {
  console.warn(`Local dev warning: ${warning}`);
}

failIfIssues("Local development readiness check", issues);

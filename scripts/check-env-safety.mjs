import fs from "node:fs";
import { exists, failIfIssues, listFiles, readJson, relative } from "./check-utils.mjs";

const issues = [];
const rootManifest = readJson("package.json");

if (!rootManifest.packageManager?.startsWith("pnpm@")) {
  issues.push("package.json must declare packageManager as pnpm@...");
}

if (!exists("pnpm-workspace.yaml")) {
  issues.push("pnpm-workspace.yaml is required for this pnpm workspace.");
}

if (!exists("pnpm-lock.yaml")) {
  issues.push("pnpm-lock.yaml is required for frozen installs.");
}

if (exists("package-lock.json")) {
  issues.push("package-lock.json must not exist in the pnpm-only workspace.");
}

for (const filePath of listFiles([".github", "package.json", "packages"])) {
  const rel = relative(filePath);
  if (rel.includes("node_modules/") || rel.includes("/dist/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  if (/\bnpm\s+(ci|install|run|test|audit)\b/i.test(source)) {
    issues.push(`${rel} contains an npm command.`);
  }
  if (
    /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|RESEND_API_KEY|GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|DATABASE_URL|VERCEL_OIDC_TOKEN/.test(
      source
    )
  ) {
    if (/\.(tsx|html|svg)$/.test(rel)) {
      issues.push(`${rel} references server-only environment names in public-rendered code.`);
    }
  }
}

failIfIssues("Environment and package-manager safety check", issues);

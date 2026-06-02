import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registryPath = "packages/web/src/lib/supabase-integrations/integration-registry.ts";
const flagsPath = "packages/web/src/lib/supabase-integrations/integration-feature-flags.ts";

for (const file of [
  registryPath,
  flagsPath,
  "docs/supabase/SUPABASE_INTEGRATION_EXPANSION_PLAN.md",
  "docs/supabase/SUPABASE_BRANCHING_AND_PREVIEW.md",
  "docs/security/SUPABASE_VAULT_POLICY.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing Supabase integration file: ${file}`);
  }
}

const source = fs.existsSync(registryPath) ? read(registryPath) : "";
for (const term of [
  "edge_functions",
  "queues",
  "cron",
  "webhooks",
  "storage",
  "realtime",
  "vector_search",
  "vault",
  "wrappers"
]) {
  if (!source.includes(term)) {
    issues.push(`Supabase integration registry missing ${term}.`);
  }
}

if (/storesSecrets:\s*true/.test(source)) {
  issues.push("Supabase integration registry must not store actual secrets.");
}

failIfIssues("Supabase integration check", issues);

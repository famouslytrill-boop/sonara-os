import fs from "node:fs";
import { failIfIssues, exists } from "./check-utils.mjs";

const issues = [];
const registryPath = "packages/api-provider-registry/src/index.ts";

if (!exists(registryPath)) {
  issues.push("Missing API provider registry package.");
} else {
  const source = fs.readFileSync(registryPath, "utf8");
  for (const provider of ["stripe", "supabase"]) {
    if (!source.includes(provider)) {
      issues.push(`Provider registry missing ${provider}.`);
    }
  }
  if (!/frontendSecretsAllowed:\s*false/.test(source)) {
    issues.push("Provider registry must keep frontendSecretsAllowed false.");
  }
  if (!/blocked/.test(source)) {
    issues.push("Provider registry must include blocked provider status.");
  }
}

failIfIssues("Provider registry check", issues);

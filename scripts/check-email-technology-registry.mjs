import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registry = fs.existsSync("packages/open-source-intake/src/project-registry.ts")
  ? read("packages/open-source-intake/src/project-registry.ts")
  : "";
for (const repo of ["foundation-emails", "laravel-auth", "nuxt-mail"]) {
  if (!registry.includes(`repoName: "${repo}"`)) {
    issues.push(`Email/auth technology registry missing ${repo}.`);
  }
}
if (!fs.existsSync("packages/web/src/lib/email/email-template-policy.ts")) {
  issues.push("Missing email template policy.");
}

failIfIssues("Email technology registry check", issues);

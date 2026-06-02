import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];
const allowedServiceRoleFiles = new Set([
  "packages/web/src/lib/supabase/admin.ts",
  "packages/web/src/lib/supabase/environment-check.ts",
  "packages/web/src/lib/supabase/auth-policy.ts",
  "packages/web/src/lib/supabase/service-role-guard.ts",
  "packages/web/src/lib/server-secrets.ts",
  "packages/web/src/lib/readiness/live-readiness.ts",
  "packages/web/src/lib/support/email-readiness.ts",
  "packages/web/src/lib/ai-models/model-provider-registry.ts",
  "packages/web/src/lib/security/source-leak-prevention.ts"
]);

for (const filePath of listFiles(["packages/web/src", "packages/deployment-sync/src"])) {
  const rel = relative(filePath);
  if (rel.includes(".test.") || rel.includes("/dist/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  if (/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(source) && !allowedServiceRoleFiles.has(rel)) {
    issues.push(`${rel} references forbidden NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY.`);
  }
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(source) && rel.startsWith("packages/web/src/")) {
    if (!allowedServiceRoleFiles.has(rel)) {
      issues.push(
        `${rel} references SUPABASE_SERVICE_ROLE_KEY outside approved server/readiness files.`
      );
    }
  }
}

failIfIssues("Supabase service-role safety check", issues);

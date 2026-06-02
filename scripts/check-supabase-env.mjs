import fs from "node:fs";
import { exists, failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const env = exists(".env.example") ? read(".env.example") : "";

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_DB_PASSWORD"
]) {
  if (!env.includes(`${key}=`)) {
    issues.push(`.env.example missing ${key}.`);
  }
}

if (/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(env)) {
  issues.push(".env.example must not expose a NEXT_PUBLIC service-role key.");
}

for (const key of [
  "NEXT_PUBLIC_ENABLE_SOUND",
  "NEXT_PUBLIC_ENABLE_VIDEO",
  "NEXT_PUBLIC_ENABLE_MIC"
]) {
  if (!new RegExp(`^${key}=false$`, "m").test(env)) {
    issues.push(`${key} should default to false in .env.example.`);
  }
}

for (const file of [
  "packages/web/src/lib/supabase/environment-check.ts",
  "packages/web/src/lib/supabase/service-role-guard.ts",
  "docs/supabase/SUPABASE_CORE_BACKEND.md",
  "docs/supabase/SUPABASE_LAUNCH_CHECKLIST.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing Supabase environment/readiness file: ${file}`);
  }
}

failIfIssues("Supabase environment check", issues);

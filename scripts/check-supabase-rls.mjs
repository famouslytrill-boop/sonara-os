import fs from "node:fs";
import path from "node:path";
import { failIfIssues, repoPath } from "./check-utils.mjs";

const issues = [];
const migrationsDir = repoPath("supabase/migrations");
const combined = fs.existsSync(migrationsDir)
  ? fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf8"))
      .join("\n")
  : "";

for (const table of [
  "customer_records",
  "proof_profiles",
  "payment_options",
  "booking_links",
  "smart_intake_forms",
  "offers",
  "reviews",
  "money_path_events",
  "files_records",
  "external_connections",
  "feature_flags",
  "approval_events"
]) {
  if (!combined.includes(`alter table public.${table} enable row level security`)) {
    issues.push(`RLS not enabled for public.${table}.`);
  }
}

if (/\busing\s*\(\s*true\s*\)/i.test(combined)) {
  issues.push("Private-table RLS must not use broad USING (true) policies.");
}

for (const helper of ["public.is_org_member", "public.is_org_admin"]) {
  if (!combined.includes(helper)) {
    issues.push(`RLS helper missing: ${helper}`);
  }
}

if (!fs.existsSync("docs/supabase/SUPABASE_RLS_LAUNCH_REVIEW.md")) {
  issues.push("Missing docs/supabase/SUPABASE_RLS_LAUNCH_REVIEW.md.");
}

failIfIssues("Supabase RLS check", issues);

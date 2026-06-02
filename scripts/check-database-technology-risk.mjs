import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const source = fs.existsSync("packages/web/src/lib/databases/database-technology-risk.ts")
  ? read("packages/web/src/lib/databases/database-technology-risk.ts")
  : "";
for (const db of ["surrealdb", "cockroachdb", "tdengine"]) {
  if (!source.includes(db)) {
    issues.push(`Database technology risk registry missing ${db}.`);
  }
}
if (!source.includes("AGPL-3.0") || !source.includes("restricted_reference_only")) {
  issues.push("TDengine must remain restricted due AGPL-3.0 risk.");
}
if (!fs.existsSync("docs/databases/SUPABASE_FIRST_DATABASE_POLICY.md")) {
  issues.push("Missing Supabase-first database policy doc.");
}

failIfIssues("Database technology risk check", issues);

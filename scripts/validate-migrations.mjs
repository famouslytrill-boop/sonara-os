import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./workspace.mjs";

const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const source = fs
  .readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort()
  .map((fileName) => fs.readFileSync(path.join(migrationsDir, fileName), "utf8"))
  .join("\n");
const sourceWithoutComments = source.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const requiredTables = [
  "organizations",
  "organization_members",
  "user_profiles",
  "audit_logs",
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
];

const organizationScopedTables = requiredTables.filter(
  (tableName) => !["organizations", "user_profiles"].includes(tableName)
);

const forbiddenColumns = [
  "card_number",
  "cvv",
  "cvc",
  "raw_card",
  "bank_password",
  "provider_secret",
  "secret_key"
];

const issues = [];

for (const tableName of requiredTables) {
  const tablePattern = new RegExp(`create table if not exists public\\.${tableName}\\s*\\(`, "i");
  if (!tablePattern.test(source)) {
    issues.push(`Missing required table: ${tableName}`);
  }
}

for (const tableName of organizationScopedTables) {
  const tableBody = extractTableBody(tableName);
  if (!/organization_id uuid not null references public\.organizations\(id\)/i.test(tableBody)) {
    issues.push(`Missing organization_id ownership field on ${tableName}`);
  }
  const rlsPattern = new RegExp(`alter table public\\.${tableName} enable row level security`, "i");
  if (!rlsPattern.test(source)) {
    issues.push(`Missing RLS enablement for ${tableName}`);
  }
}

for (const column of forbiddenColumns) {
  const columnPattern = new RegExp(`\\b${column}\\b`, "i");
  if (columnPattern.test(sourceWithoutComments)) {
    issues.push(`Forbidden sensitive field found in migrations: ${column}`);
  }
}

if (!/create table if not exists public\.audit_logs/i.test(source)) {
  issues.push("Audit log table is missing.");
}

if (!/create table if not exists public\.feature_flags/i.test(source)) {
  issues.push("Feature flag table is missing.");
}

if (issues.length > 0) {
  throw new Error(`Migration validation failed:\n${issues.join("\n")}`);
}

console.log("Migration validation passed.");

function extractTableBody(tableName) {
  const startPattern = new RegExp(`create table if not exists public\\.${tableName}\\s*\\(`, "i");
  const startMatch = startPattern.exec(source);
  if (!startMatch) {
    return "";
  }
  const startIndex = startMatch.index + startMatch[0].length;
  const endIndex = source.indexOf("\n);", startIndex);
  return endIndex === -1 ? source.slice(startIndex) : source.slice(startIndex, endIndex);
}

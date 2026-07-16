import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationDir = join(root, "supabase", "migrations");
const migrations = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
const versions = new Map();
const failures = [];

for (const name of migrations) {
  const version = name.split("_")[0];
  if (versions.has(version)) failures.push(`duplicate migration version ${version}: ${versions.get(version)} and ${name}`);
  versions.set(version, name);
}

const sql = migrations.map((name) => readFileSync(join(migrationDir, name), "utf8")).join("\n").toLowerCase();
const requiredTables = [
  "profiles",
  "organizations",
  "organization_memberships",
  "user_roles",
  "support_requests",
  "service_requests",
  "service_deliverables",
  "module_outputs",
  "customer_records",
  "order_records",
  "creator_assets",
  "growth_campaigns",
  "growth_leads",
  "billing_webhook_events",
  "billing_subscriptions"
];

for (const table of requiredTables) {
  if (!sql.includes(`create table if not exists public.${table}`)) failures.push(`missing append-safe table definition: ${table}`);
}

const storageMigrationName = "20260716130000_launch_storage_buckets.sql";
if (!migrations.includes(storageMigrationName)) {
  failures.push(`missing storage migration: ${storageMigrationName}`);
} else {
  const storageSql = readFileSync(join(migrationDir, storageMigrationName), "utf8").toLowerCase();
  const buckets = ["avatars", "business-assets", "creator-assets", "music-stems", "release-packages", "support-attachments", "exports"];
  for (const bucket of buckets) {
    if (!storageSql.includes(`'${bucket}'`)) failures.push(`missing private storage bucket: ${bucket}`);
  }
  if (!storageSql.includes("public.is_org_member")) failures.push("storage policies do not check active organization membership");
  if (/values\s*\([^)]*,\s*true\s*[,)]/s.test(storageSql)) failures.push("storage migration contains a public bucket");
}

if (failures.length) {
  console.error("Production schema verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production schema verification passed: ${migrations.length} migrations, ${requiredTables.length} required tables, 7 private buckets.`);

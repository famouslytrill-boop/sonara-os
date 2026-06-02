import fs from "node:fs";
import path from "node:path";
import { failIfIssues, repoPath } from "./check-utils.mjs";

const issues = [];
const migrationsDir = repoPath("supabase/migrations");

if (!fs.existsSync(migrationsDir)) {
  issues.push("supabase/migrations directory is missing.");
} else {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const versions = new Map();
  for (const file of files) {
    const version = file.split("_")[0];
    versions.set(version, [...(versions.get(version) ?? []), file]);
    const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    if (
      /\bdrop\s+(table|schema|database)\b/i.test(source) &&
      !/human approval|destructive/i.test(source)
    ) {
      issues.push(`${file} contains a destructive drop without explicit approval docs.`);
    }
    if (
      /organization_memberships/.test(source) &&
      !/create table if not exists public\.organization_memberships/.test(source)
    ) {
      issues.push(`${file} references organization_memberships without creating it in this repo.`);
    }
  }
  for (const [version, versionFiles] of versions) {
    if (versionFiles.length > 1) {
      issues.push(`Duplicate migration version ${version}: ${versionFiles.join(", ")}`);
    }
  }
  const combined = files
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
  for (const required of [
    "create table if not exists public.organizations",
    "create table if not exists public.organization_members",
    "alter table public.organizations enable row level security",
    "alter table public.organization_members enable row level security"
  ]) {
    if (!combined.includes(required)) {
      issues.push(`Migrations missing required statement: ${required}`);
    }
  }
}

failIfIssues("Supabase migration check", issues);

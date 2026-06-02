import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const registryPath = "packages/web/src/lib/storage/storage-bucket-registry.ts";
const policyPath = "packages/web/src/lib/storage/supabase-storage-policy.ts";
const docsPath = "docs/supabase/SUPABASE_STORAGE_BUCKETS.md";

for (const file of [registryPath, policyPath, docsPath]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing storage policy file: ${file}`);
  }
}

const source = fs.existsSync(registryPath) ? read(registryPath) : "";
for (const bucket of [
  "sonara-public-assets",
  "sonara-private-files",
  "business-builder-documents",
  "creator-studio-media",
  "growth-studio-imports",
  "research-lab-sources",
  "support-attachments",
  "generated-media",
  "exports",
  "vector-knowledge"
]) {
  if (!source.includes(bucket)) {
    issues.push(`Storage registry missing bucket: ${bucket}`);
  }
}

const policy = fs.existsSync(policyPath) ? read(policyPath) : "";
for (const required of [
  "privateByDefault: true",
  "executableUploadsAllowed: false",
  "secretsAllowed: false"
]) {
  if (!policy.includes(required)) {
    issues.push(`Storage policy missing ${required}.`);
  }
}

failIfIssues("Supabase storage policy check", issues);

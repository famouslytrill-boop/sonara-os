import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content);
}

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment was not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: expected source fragment was not unique`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

// 1. Pin the durable generation migration using the repository's own checksum
// convention. This repairs the migration-freeze invariant without weakening it.
{
  const migrationName = "20260916032000_generation_lifecycle_persistence.sql";
  const migrationPath = path.join(root, "supabase", "migrations", migrationName);
  const manifestPath = "supabase/applied-migration-checksums.json";
  const manifest = JSON.parse(read(manifestPath));
  const digest = createHash("sha256")
    .update(fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex");

  if (manifest[migrationName] && manifest[migrationName] !== digest) {
    throw new Error(`${migrationName}: existing pin does not match the migration`);
  }
  manifest[migrationName] = digest;
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

// 2. Four entity tables have acquired real shipped readers. Keeping them in the
// orphan registry makes the registry contradict the application and correctly
// trips verify:orphan-tables. Remove only those four dispositions.
{
  const relative = "lib/sonara-orphan-tables.cjs";
  let source = read(relative);
  const nowQueried = ["entities", "entity_agents", "entity_automations", "entity_connectors"];

  for (const key of nowQueried) {
    const pattern = new RegExp(`\\n  ${key}: Object\\.freeze\\(\\{[\\s\\S]*?\\n  \\}\\),`);
    const matches = source.match(pattern);
    if (!matches) throw new Error(`${relative}: ${key} disposition was not found`);
    source = source.replace(pattern, "");
  }

  source = source.replace(
    "The deletion added the ten entity_* tables below to this list. They were",
    "The deletion originally added ten entity_* tables to this list. Four now have shipped readers (entities, entity_agents, entity_automations, entity_connectors); the remaining six were"
  );
  source = source.replace(
    "// The entity system: ten of the nineteen entity_* tables from migration 008.",
    "// The remaining entity system orphans: six of the nineteen entity_* tables from migration 008."
  );
  source = source.replace(
    "// Nine sibling entity_* tables are not in this list because the agent",
    "// Thirteen sibling entity_* tables are not in this list: nine because the agent"
  );
  source = source.replace(
    "// foundation reads them; scripts/verify-supabase-contract.mjs verifies that\n// separately. The split is real, not an oversight.",
    "// foundation reads them, and four because newer shipped platform paths now query\n// them. scripts/verify-supabase-contract.mjs verifies the agent foundation\n// separately. The split is real, not an oversight."
  );

  write(relative, source);
}

// 3. Customer-facing technology pages already sanitize external repository
// descriptions, but SONARA-native expansion rows bypassed the same vocabulary
// boundary. Route every rendered expansion value through the customer copy
// transformer instead of weakening the plain-language gate.
{
  const relative = "routes/sonara-open-source-routes.cjs";
  let source = read(relative);
  source = replaceExactlyOnce(
    source,
    `    ].map((value) => escape(value));\n  }).join("");\n  const head = ["SONARA capability", "Product form", "Current state", "Customer value", "Next implementation boundary"]`,
    `    ].map((value) => escape(customerCopy(value)));\n  }).join("");\n  const head = ["SONARA capability", "Product form", "Current state", "Customer value", "Next implementation boundary"]`,
    `${relative}: expansion customer-copy boundary`
  );

  source = replaceExactlyOnce(
    source,
    `function customerReferencePurpose(record) {\n  if (!record) return "Review record";\n  if (["blocked", "needs_license_review", "needs_security_review"].includes(record.integrationStatus)) {\n    return "Recorded for review; not offered or connected";\n  }\n  const source = record.useCase?.[0] || record.category?.[0] || "Product research reference";\n  return CUSTOMER_TERM_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(source));\n}\n\nfunction customerReferenceName(record) {\n  return CUSTOMER_TERM_REPLACEMENTS.reduce(\n    (text, [pattern, replacement]) => text.replace(pattern, replacement),\n    displayName(record)\n  );\n}\n`,
    `function customerCopy(value) {\n  return CUSTOMER_TERM_REPLACEMENTS.reduce(\n    (text, [pattern, replacement]) => text.replace(pattern, replacement),\n    String(value == null ? "" : value)\n  );\n}\n\nfunction customerReferencePurpose(record) {\n  if (!record) return "Review record";\n  if (["blocked", "needs_license_review", "needs_security_review"].includes(record.integrationStatus)) {\n    return "Recorded for review; not offered or connected";\n  }\n  const source = record.useCase?.[0] || record.category?.[0] || "Product research reference";\n  return customerCopy(source);\n}\n\nfunction customerReferenceName(record) {\n  return customerCopy(displayName(record));\n}\n`,
    `${relative}: shared customer-copy helper`
  );

  write(relative, source);
}

console.log("Release-gate source repairs applied deterministically.");

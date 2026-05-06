import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "scripts/entity-heartbeat-check.mjs",
  "supabase/migrations/008_entity_agent_operations.sql",
  "app/dashboard/entities/[entitySlug]/heartbeat/page.tsx",
  "docs/ENTITY_HEARTBEATS.md",
];

let failed = false;

for (const file of requiredFiles) {
  if (existsSync(join(root, file))) {
    console.log(`[OK] ${file}`);
  } else {
    console.error(`[FAIL] Missing ${file}`);
    failed = true;
  }
}

const migration = existsSync(join(root, "supabase/migrations/008_entity_agent_operations.sql"))
  ? readFileSync(join(root, "supabase/migrations/008_entity_agent_operations.sql"), "utf8")
  : "";

for (const token of ["entity_heartbeats", "entity_incidents", "entity_health_snapshots", "enable row level security"]) {
  if (!migration.includes(token)) {
    console.error(`[FAIL] Heartbeat migration missing ${token}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Heartbeat verification passed.");

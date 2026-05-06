import { existsSync, readFileSync } from "node:fs";

const checks = [
  ["cron route", "app/api/cron/sonara-maintenance/route.ts"],
  ["sound discovery sync route", "app/api/sound-discovery/sync/route.ts"],
  ["Python ops CLI", "python/sonara_ops/main.py"],
  ["platform jobs migration", "supabase/migrations/007_platform_infrastructure_ops.sql"],
  ["workers docs", "docs/WORKERS.md"],
];

let failed = false;

for (const [label, file] of checks) {
  if (existsSync(file)) {
    console.log(`[OK] ${label}: ${file}`);
  } else {
    console.error(`[FAIL] ${label}: missing ${file}`);
    failed = true;
  }
}

const migration = readFileSync("supabase/migrations/007_platform_infrastructure_ops.sql", "utf8");
if (!migration.includes("platform_jobs")) {
  console.error("[FAIL] platform_jobs table missing from ops migration");
  failed = true;
} else {
  console.log("[OK] platform_jobs table detected");
}

if (failed) {
  process.exit(1);
}

console.log("Worker smoke test passed.");

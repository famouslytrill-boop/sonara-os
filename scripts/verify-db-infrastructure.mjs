import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "supabase/migrations/007_platform_infrastructure_ops.sql",
  "lib/db/audit.ts",
  "lib/db/jobs.ts",
  "lib/db/health.ts",
  "lib/db/activity.ts",
  "types/databaseOps.ts",
  "python/pyproject.toml",
  "python/sonara_ops/main.py",
  "python/sonara_ops/healthcheck.py",
  "docs/DATABASE_INFRASTRUCTURE.md",
  "docs/PYTHON_OPS_LAYER.md",
];

const requiredScripts = ["db:types", "db:diff", "db:push", "db:reset", "python:health", "verify:db"];
const conflictMarkers = ["<".repeat(7), "=".repeat(7), ">".repeat(7)];
const secretPatterns = [/sk_live_[A-Za-z0-9]+/, /sk_test_[A-Za-z0-9]+/, /whsec_[A-Za-z0-9]+/];

let failed = false;

function logOk(message) {
  console.log(`[OK] ${message}`);
}

function logWarn(message) {
  console.warn(`[WARN] ${message}`);
  failed = true;
}

for (const file of requiredFiles) {
  const path = join(root, file);
  if (existsSync(path)) {
    logOk(`found ${file}`);
  } else {
    logWarn(`missing ${file}`);
  }
}

const migrationDir = join(root, "supabase", "migrations");
if (!existsSync(migrationDir)) {
  logWarn("missing supabase/migrations");
} else {
  const migrations = readdirSync(migrationDir).filter((file) => file.endsWith(".sql"));
  logOk(`found ${migrations.length} SQL migration(s)`);

  for (const migration of migrations) {
    const content = readFileSync(join(migrationDir, migration), "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        logWarn(`possible secret-shaped value in ${migration}`);
      }
    }
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const script of requiredScripts) {
  if (packageJson.scripts?.[script]) {
    logOk(`package script ${script}`);
  } else {
    logWarn(`missing package script ${script}`);
  }
}

const filesToScan = [
  ...requiredFiles,
  "package.json",
  ".env.example",
  "python/.env.example",
].filter((file) => existsSync(join(root, file)));

for (const file of filesToScan) {
  const content = readFileSync(join(root, file), "utf8");
  for (const marker of conflictMarkers) {
    if (content.includes(marker)) {
      logWarn(`merge marker ${marker} found in ${file}`);
    }
  }
}

if (failed) {
  console.error("Database infrastructure verification failed.");
  process.exit(1);
}

console.log("Database infrastructure verification passed.");

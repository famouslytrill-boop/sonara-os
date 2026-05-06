import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failed = false;

const requiredFiles = [
  "supabase/migrations/008_entity_agent_operations.sql",
  "lib/entities/security.ts",
  "components/entities/EntityBrowserWorkspace.tsx",
  "app/dashboard/entities/page.tsx",
  "docs/ENTITY_AGENT_SECURITY_MODEL.md",
];

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

for (const file of requiredFiles) {
  if (existsSync(join(root, file))) {
    ok(`found ${file}`);
  } else {
    fail(`missing ${file}`);
  }
}

const migrationPath = join(root, "supabase/migrations/008_entity_agent_operations.sql");
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const migrationMustInclude = [
  "entity_memberships",
  "entity_browser_sessions",
  "entity_proactive_actions",
  "entity_agents",
  "entity_automations",
  "entity_connectors",
  "public.is_entity_member",
  "public.can_manage_entity",
  "enable row level security",
];

for (const token of migrationMustInclude) {
  if (migration.includes(token)) {
    ok(`migration includes ${token}`);
  } else {
    fail(`migration missing ${token}`);
  }
}

if (/USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)/i.test(migration)) {
  fail("entity migration contains broad true RLS policy");
}

const securitySource = existsSync(join(root, "lib/entities/security.ts"))
  ? readFileSync(join(root, "lib/entities/security.ts"), "utf8")
  : "";

for (const token of ["javascript:", "data:", "Local and private-network addresses are blocked", "requiresHumanApproval"]) {
  if (securitySource.includes(token)) {
    ok(`URL/action security includes ${token}`);
  } else {
    fail(`security helper missing ${token}`);
  }
}

const browserSource = existsSync(join(root, "components/entities/EntityBrowserWorkspace.tsx"))
  ? readFileSync(join(root, "components/entities/EntityBrowserWorkspace.tsx"), "utf8")
  : "";

if (browserSource.includes("fetch(") || browserSource.includes("/api/proxy")) {
  fail("entity browser appears to proxy arbitrary websites");
} else {
  ok("entity browser does not proxy arbitrary websites");
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") return [];
    return stat.isDirectory() ? listFiles(path) : [path];
  });
}

const unsafePublicClaims = [
  /fully autonomous production operation/i,
  /guaranteed self-healing/i,
  /official government integration/i,
  /live desktop control/i,
];

for (const file of listFiles(join(root, "docs"))) {
  const content = readFileSync(file, "utf8");
  for (const pattern of unsafePublicClaims) {
    if (pattern.test(content)) {
      fail(`unsafe capability claim in ${file}`);
    }
  }
}

if (failed) process.exit(1);
console.log("Entity security verification passed.");

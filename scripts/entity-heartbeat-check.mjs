import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const entities = [
  {
    slug: "parent-company",
    name: "Parent Company",
    heartbeats: ["system", "database", "auth", "security", "workers", "connectors"],
    env: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    slug: "creator-music-technology",
    name: "Creator/Music Technology Company",
    heartbeats: ["creator_tools", "storage", "browser", "workers", "security"],
    env: ["NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    slug: "business-operations",
    name: "Business Operations Company",
    heartbeats: ["business_ops", "database", "auth", "storage", "stripe", "workers"],
    env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  },
  {
    slug: "community-public-information",
    name: "Community/Public Information Company",
    heartbeats: ["community_info", "public_feed", "browser", "connectors", "security"],
    env: ["NEXT_PUBLIC_APP_URL"],
  },
];

function readEnvExample() {
  const path = join(root, ".env.example");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const envExample = readEnvExample();
const requiredFiles = [
  "supabase/migrations/008_entity_agent_operations.sql",
  "lib/entities/config.ts",
  "lib/entities/security.ts",
  "components/entities/EntityDashboardShell.tsx",
  "app/dashboard/entities/page.tsx",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(join(root, file)));

for (const entity of entities) {
  const missingPlaceholders = entity.env.filter((name) => !envExample.includes(`${name}=`));
  const setupRequired = entity.env.filter((name) => !process.env[name]);
  const filePenalty = missingFiles.length * 8;
  const setupPenalty = setupRequired.length * 5;
  const score = Math.max(20, 90 - filePenalty - setupPenalty);
  const status = missingFiles.length > 0 || missingPlaceholders.length > 0 ? "critical" : setupRequired.length > 0 ? "setup_required" : "healthy";

  console.log(`\n${entity.name}`);
  console.log(`  slug: ${entity.slug}`);
  console.log(`  status: ${status}`);
  console.log(`  health score: ${score}/100`);
  console.log(`  heartbeat types: ${entity.heartbeats.join(", ")}`);
  if (setupRequired.length > 0) {
    console.log(`  setup_required runtime env names: ${setupRequired.join(", ")}`);
  }
  if (missingPlaceholders.length > 0) {
    console.log(`  missing .env.example placeholders: ${missingPlaceholders.join(", ")}`);
  }
}

if (missingFiles.length > 0) {
  console.error(`\nMissing required entity infrastructure files:\n- ${missingFiles.join("\n- ")}`);
  process.exit(1);
}

console.log("\nEntity heartbeat check completed with local-safe checks only.");

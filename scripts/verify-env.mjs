import { readFileSync } from "node:fs";

const envExample = readFileSync(".env.example", "utf8");
const requiredNames = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_TRACKFOUNDRY_STARTER_PRICE_ID",
  "STRIPE_TRACKFOUNDRY_STUDIO_PRICE_ID",
  "STRIPE_TRACKFOUNDRY_LABEL_PRICE_ID",
  "STRIPE_LINEREADY_SINGLE_STORE_PRICE_ID",
  "STRIPE_LINEREADY_OPERATOR_PRICE_ID",
  "STRIPE_LINEREADY_GROUP_PRICE_ID",
  "STRIPE_NOTICEGRID_ORGANIZATION_PRICE_ID",
  "STRIPE_NOTICEGRID_MUNICIPAL_PRICE_ID",
  "SONARA_CRON_SECRET",
  "OPENAI_API_KEY",
  "FREESOUND_API_KEY",
  "OPENVERSE_CLIENT_ID",
  "OPENVERSE_CLIENT_SECRET",
];

const secretAssignments = [
  /^SUPABASE_SERVICE_ROLE_KEY=.+/m,
  /^STRIPE_SECRET_KEY=sk_(live|test)_.+/m,
  /^STRIPE_WEBHOOK_SECRET=whsec_.+/m,
  /^OPENAI_API_KEY=sk-.+/m,
];

let failed = false;

for (const name of requiredNames) {
  if (!envExample.includes(`${name}=`)) {
    console.error(`[FAIL] Missing ${name} in .env.example`);
    failed = true;
  } else {
    console.log(`[OK] ${name}`);
  }
}

for (const pattern of secretAssignments) {
  if (pattern.test(envExample)) {
    console.error("[FAIL] .env.example contains a real-looking secret assignment");
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Environment variable verification passed.");

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
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_CORE",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY",
  "STRIPE_PRICE_SETUP_99",
  "STRIPE_PRICE_SETUP_299",
  "STRIPE_PRICE_SETUP_499",
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

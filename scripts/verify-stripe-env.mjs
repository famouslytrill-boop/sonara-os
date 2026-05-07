import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "app/api/stripe/checkout/route.ts",
  "app/api/stripe/webhook/route.ts",
  "lib/stripe.ts",
  "docs/STRIPE_PRODUCTION_RUNBOOK.md",
  "docs/STRIPE_TESTING_CHECKLIST.md",
];

const requiredEnvNames = [
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
];

let failed = false;

for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`[OK] found ${file}`);
  } else {
    console.error(`[FAIL] missing ${file}`);
    failed = true;
  }
}

if (existsSync("src/config/stripeEnv.ts") || existsSync("config/stripeEnv.ts")) {
  console.log("[OK] found Stripe env helper");
} else {
  console.error("[FAIL] missing Stripe env helper");
  failed = true;
}

const envExample = readFileSync(".env.example", "utf8");
for (const name of requiredEnvNames) {
  if (!envExample.includes(`${name}=`)) {
    console.error(`[FAIL] .env.example missing ${name}`);
    failed = true;
  } else {
    console.log(`[OK] .env.example declares ${name}`);
  }
}

const webhookRoute = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
if (!webhookRoute.includes("constructEvent")) {
  console.error("[FAIL] Stripe webhook route does not appear to verify signatures");
  failed = true;
} else {
  console.log("[OK] Stripe webhook signature verification detected");
}

if (/(sk_live_|sk_test_|whsec_)[A-Za-z0-9]+/.test(webhookRoute)) {
  console.error("[FAIL] Stripe route contains real-looking secret material");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log("Stripe environment verification passed.");

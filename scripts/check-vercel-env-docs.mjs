import fs from "node:fs";
import { exists, failIfIssues, read } from "./check-utils.mjs";

const requiredVariables = [
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
  "NEXT_PUBLIC_AUTH_GOOGLE_PROVIDER_READY",
  "NEXT_PUBLIC_AUTH_PHONE_ENABLED",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_DB_PASSWORD",
  "SUPPORT_EMAIL",
  "SUPPORT_TO_EMAIL",
  "CONTACT_EMAIL",
  "HELP_EMAIL",
  "BILLING_EMAIL",
  "SECURITY_EMAIL",
  "PRIVACY_EMAIL",
  "LEGAL_EMAIL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "GITHUB_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "SONARA_ADMIN_EMAILS",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_CORE",
  "STRIPE_PRICE_CREATOR",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY_SCALE",
  "STRIPE_PRICE_SETUP_99",
  "STRIPE_PRICE_SETUP_299",
  "STRIPE_PRICE_SETUP_499",
  "STRIPE_PRICE_SETUP_999"
];

const issues = [];
const docsPath = "docs/deployment/VERCEL_ENVIRONMENT_VARIABLES.md";
const setupDocs = [
  "docs/deployment/VERCEL_ENV_SETUP.md",
  "docs/deployment/VERCEL_ENV_TROUBLESHOOTING.md"
];

if (!exists(docsPath)) {
  issues.push(`Missing ${docsPath}.`);
} else {
  const source = read(docsPath);
  for (const variable of requiredVariables) {
    if (!source.includes(variable)) {
      issues.push(`${docsPath} missing ${variable}.`);
    }
  }
  if (!/optional/i.test(source) || !/server-only/i.test(source)) {
    issues.push(`${docsPath} must distinguish optional and server-only variables.`);
  }
}

for (const docsPath of setupDocs) {
  if (!exists(docsPath)) {
    issues.push(`Missing ${docsPath}.`);
  } else {
    const source = read(docsPath);
    if (!/vercel env update/i.test(source)) {
      issues.push(`${docsPath} must document vercel env update for existing variables.`);
    }
    if (!/NEXT_PUBLIC/i.test(source) || !/browser/i.test(source)) {
      issues.push(`${docsPath} must document that NEXT_PUBLIC variables are browser-visible.`);
    }
  }
}

if (exists(".env.example")) {
  const envExample = fs.readFileSync(".env.example", "utf8");
  for (const variable of requiredVariables.slice(0, 15)) {
    if (!envExample.includes(`${variable}=`)) {
      issues.push(`.env.example missing ${variable}.`);
    }
  }
}

failIfIssues("Vercel environment documentation check", issues);

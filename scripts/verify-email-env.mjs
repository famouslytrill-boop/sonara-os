import { existsSync, readFileSync } from "node:fs";

const requiredEmailVars = [
  "CONTACT_EMAIL",
  "SUPPORT_EMAIL",
  "HELP_EMAIL",
  "BILLING_EMAIL",
  "SECURITY_EMAIL",
  "PRIVACY_EMAIL",
  "LEGAL_EMAIL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

const routeFiles = ["app/contact/page.tsx", "app/support/page.tsx", "app/help/page.tsx", "app/feedback/page.tsx"];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const result = {};
  const text = readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "").trim();
    result[key] = value;
  }

  return result;
}

const localEnv = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
  ...process.env,
};

function hasValue(name) {
  const value = localEnv[name];
  return typeof value === "string" && value.trim().length > 0 && !/^(todo|pending|placeholder|changeme)$/i.test(value.trim());
}

const formsEnabled = routeFiles.some((file) => existsSync(file));
const strict = process.argv.includes("--strict") || process.env.SONARA_STRICT_EMAIL_ENV === "true" || process.env.VERCEL_ENV === "production";
const missing = [];

console.log("Email environment readiness:");
console.log(`- support/contact forms enabled: ${formsEnabled ? "yes" : "no"}`);
console.log(`- strict mode: ${strict ? "yes" : "no"}`);

for (const name of requiredEmailVars) {
  if (hasValue(name)) {
    console.log(`[OK] ${name}`);
  } else {
    console.log(`[MISSING] ${name}`);
    missing.push(name);
  }
}

if (missing.length) {
  console.log("");
  console.log("Email provider is not fully configured. Add missing values in Vercel and mark RESEND_API_KEY sensitive.");
  console.log("No secret values were printed.");

  if (formsEnabled && strict) {
    console.error(`Email env check failed in strict mode. Missing: ${missing.join(", ")}`);
    process.exit(1);
  }
}

console.log("Email env check completed.");

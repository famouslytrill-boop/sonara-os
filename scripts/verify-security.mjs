import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "next.config.mjs",
  "src/config/securityConfig.ts",
  "src/lib/sonara/security/rateLimit.ts",
  "src/lib/sonara/security/auditLogger.ts",
  "scripts/scan-secrets-local.ps1",
  "docs/SECURITY_HARDENING_CHECKLIST.md",
  "docs/SECURITY_AUDIT_LOGGING.md",
];

let missing = 0;

for (const file of requiredFiles) {
  if (existsSync(join(root, file))) {
    console.log(`[OK] found ${file}`);
  } else {
    missing += 1;
    console.log(`[WARN] missing ${file}`);
  }
}

const nextConfig = existsSync(join(root, "next.config.mjs"))
  ? readFileSync(join(root, "next.config.mjs"), "utf8")
  : "";

const headerChecks = [
  "poweredByHeader: false",
];

for (const check of headerChecks) {
  if (nextConfig.includes(check)) {
    console.log(`[OK] next.config includes ${check}`);
  } else {
    missing += 1;
    console.log(`[WARN] next.config.mjs missing ${check}`);
  }
}

const optionalHeaderChecks = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "https://checkout.stripe.com",
];

for (const check of optionalHeaderChecks) {
  if (nextConfig.includes(check)) {
    console.log(`[OK] next.config.mjs includes optional ${check}`);
  } else {
    console.log(
      `[INFO] next.config.mjs does not include optional ${check}; minimal stable config is active.`
    );
  }
}

if (missing > 0) {
  console.log(`Security verification completed with ${missing} missing item(s).`);
  process.exitCode = 1;
} else {
  console.log("Security verification passed.");
}

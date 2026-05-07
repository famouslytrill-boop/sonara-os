import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "app/page.tsx",
  "app/create/page.tsx",
  "app/store/page.tsx",
  "app/pricing/page.tsx",
  "app/tutorial/page.tsx",
  "app/login/page.tsx",
  "app/trust/page.tsx",
  "app/support/page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/contact/page.tsx",
  "app/dashboard/page.tsx",
  "app/vault/page.tsx",
  "app/export/page.tsx",
  "app/founder/page.tsx",
  "app/api/stripe/checkout/route.ts",
  "app/api/stripe/webhook/route.ts",
  "app/account/billing/page.tsx",
  "src/config/stripeEnv.ts",
  "src/config/pricing.ts",
  "src/config/productPositioning.ts",
  "src/config/cloudArchitecture.ts",
  "src/config/designSystem.ts",
  "src/config/designAudit.ts",
  "src/config/uxCopy.ts",
  "src/config/languageSystem.ts",
  "src/config/promptLimits.ts",
  "src/config/competitiveDifferentiation.ts",
  "src/config/productDNA.ts",
  "src/config/securityConfig.ts",
  "src/lib/sonara/billing/entitlements.ts",
  "src/lib/sonara/writing/wordIntelligenceEngine.ts",
  "src/lib/sonara/readiness/releaseReadinessEngine.ts",
  "src/lib/sonara/authenticity/authenticityScoreEngine.ts",
  "src/lib/sonara/security/rateLimit.ts",
  "src/lib/sonara/security/auditLogger.ts",
  "components/sonara/CheckoutButton.tsx",
  "components/sonara/HelpTip.tsx",
  "components/sonara/EmptyStateCard.tsx",
  "components/sonara/StepProgress.tsx",
  "components/sonara/WordIntelligenceCard.tsx",
  "components/sonara/ReleaseReadinessCard.tsx",
  "components/sonara/AuthenticityScoreCard.tsx",
  "components/sonara/ProductDNACard.tsx",
  "components/PWAInstallPrompt.tsx",
  "components/RegisterServiceWorker.tsx",
  "public/manifest.webmanifest",
  "public/sw.js",
  ".env.example",
  "supabase/migrations/003_sonara_subscriptions.sql",
  "docs/STRIPE_LIVE_SETUP.md",
  "docs/STRIPE_SECRET_ROTATION_CHECKLIST.md",
  "docs/SOFTWARE_REQUIREMENTS_MATRIX.md",
  "docs/SAFE_SOFTWARE_BOOTSTRAP_GUIDE.md",
  "docs/DEPENDENCY_AUDIT_AND_LAUNCH_TOOLING.md",
  "docs/CLOUD_FIRST_ARCHITECTURE.md",
  "docs/MUSIC_CREATOR_OPERATING_SYSTEM.md",
  "docs/VISUAL_IDENTITY_REDESIGN.md",
  "docs/GLOBAL_USABILITY_SYSTEM.md",
  "docs/LYRIC_AND_PROMPT_CHARACTER_LIMITS.md",
  "docs/WORD_INTELLIGENCE_GENERATOR.md",
  "docs/COMPETITIVE_DIFFERENTIATION.md",
  "docs/MOAT_AND_UNIQUENESS_ROADMAP.md",
  "docs/SECURITY_HARDENING_CHECKLIST.md",
  "docs/IP_AND_COPYCAT_PROTECTION.md",
  "docs/PWA_CLOUD_FIRST_PLAN.md",
  "scripts/check-software.mjs",
  "scripts/bootstrap-local.mjs",
  "scripts/dependency-audit.mjs",
  "scripts/scan-secrets-local.ps1",
];

const optionalFiles = [
  "docs/NO_PUBLIC_KIT_MARKETPLACE_LAUNCH_POLICY.md",
  "docs/SUPABASE_PRODUCTION_CHECKLIST.md",
  "docs/MONETIZATION_SETUP.md",
];

function resolveFile(file) {
  const candidates = [join(root, file)];

  if (file.startsWith("app/")) {
    candidates.push(join(root, "src", file));
  }

  if (file.startsWith("components/")) {
    candidates.push(join(root, "src", file));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readResolved(file) {
  const resolved = resolveFile(file);
  return resolved ? readFileSync(resolved, "utf8") : "";
}

let requiredMissing = 0;
let optionalMissing = 0;
const warnings = [];

for (const file of requiredFiles) {
  const resolved = resolveFile(file);
  if (resolved) {
    console.log(`[OK] found ${file}`);
  } else {
    requiredMissing += 1;
    console.log(`[WARN] missing ${file}`);
  }
}

for (const file of optionalFiles) {
  const resolved = resolveFile(file);
  if (resolved) {
    console.log(`[OK] found ${file}`);
  } else {
    optionalMissing += 1;
    console.log(`[WARN] missing optional ${file}`);
  }
}

const homepage = readResolved("app/page.tsx").toLowerCase();
const tutorial = readResolved("app/tutorial/page.tsx").toLowerCase();
const docs = [
  readResolved("docs/SOFTWARE_REQUIREMENTS_MATRIX.md"),
  readResolved("docs/CLOUD_FIRST_ARCHITECTURE.md"),
  readResolved("docs/MUSIC_CREATOR_OPERATING_SYSTEM.md"),
].join("\n").toLowerCase();

if (!homepage.includes("music as a whole")) {
  warnings.push("Homepage should mention music as a whole.");
}

if (/normal users.*(node|npm)|install node|install npm/.test(tutorial)) {
  warnings.push("Tutorial may imply normal users need developer tools.");
}

if (/ai music generator only|only ai|just ai/.test(`${homepage}\n${docs}`)) {
  warnings.push("Public copy may over-narrow SONARA OSâ„¢ to AI generation.");
}

const combinedCopy = `${homepage}\n${docs}`;

if (
  /local gpu required|desktop only/.test(combinedCopy) ||
  (/desktop install required/.test(combinedCopy) &&
    !/no desktop install required/.test(combinedCopy))
) {
  warnings.push("Public copy may imply local GPU or desktop install is required.");
}

for (const warning of warnings) {
  console.log(`[WARN] ${warning}`);
}

console.log("");
console.log(
  `Launch verification summary: ${requiredFiles.length - requiredMissing}/${requiredFiles.length} required files found, ${optionalFiles.length - optionalMissing}/${optionalFiles.length} optional files found, ${warnings.length} content warning(s).`
);

if (requiredMissing > 0) {
  process.exitCode = 1;
}

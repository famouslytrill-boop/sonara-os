import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const unsafeFlags = [
  "JAILBREAK_TOOLS_ENABLED",
  "JAILBREAK_PROMPTS_ENABLED",
  "AUTO_INSTALL_EXTERNAL_REPOS",
  "AUTO_DEPLOY_WITHOUT_APPROVAL",
  "AUTO_PUSH_TO_MAIN",
  "VOICE_CLONING_WITHOUT_CONSENT_ENABLED",
  "FAKE_ENDORSEMENTS_ENABLED",
  "GUARANTEED_REVENUE_CLAIMS",
  "AUTO_CHANGE_PRICING",
  "AUTO_DELETE_DATA",
  "SURVEILLANCE_ENABLED",
  "PIRACY_STREAMING_ENABLED",
  "TACTICAL_ROUTING_ENABLED"
];

const dangerousCustomerCopy =
  /\b(jailbreak marketplace|piracy streaming|spy on|biometric identification|tactical routing|bypass platform rules)\b/i;

const issues = [];

for (const filePath of listFiles(["packages", ".env.example"])) {
  const rel = relative(filePath);
  if (rel.includes(".test.") || rel.includes("/dist/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  for (const flag of unsafeFlags) {
    const unsafeTruePattern = new RegExp(`\\b${flag}\\s*[:=]\\s*true\\b`, "i");
    if (unsafeTruePattern.test(source)) {
      issues.push(`${rel} enables unsafe feature flag ${flag}.`);
    }
  }
  if (dangerousCustomerCopy.test(source)) {
    issues.push(`${rel} contains unsafe customer-facing capability language.`);
  }
}

failIfIssues("Risky feature gate", issues);

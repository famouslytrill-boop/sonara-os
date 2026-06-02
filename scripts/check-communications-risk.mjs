import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
for (const file of [
  "packages/web/src/lib/communications/sip-provider-policy.ts",
  "packages/web/src/lib/communications/voip-provider-policy.ts",
  "packages/web/src/lib/communications/phone-system-risk.ts",
  "docs/communications/SIP_AND_VOIP_RESEARCH.md",
  "docs/research/LINPHONE_REVIEW.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing communications policy file: ${file}`);
  }
}

const featureFlags = fs.existsSync("packages/web/src/lib/shared/feature-flags.ts")
  ? read("packages/web/src/lib/shared/feature-flags.ts")
  : "";
for (const flag of [
  "LINPHONE_PRODUCTION_INTEGRATION_ENABLED: false",
  "LINPHONE_GPL_CODE_COPY_ALLOWED: false",
  "SIP_CREDENTIALS_CLIENT_SIDE_ENABLED: false",
  "ROBOCALLING_ENABLED: false",
  "COVERT_CALL_RECORDING_ENABLED: false",
  "EMERGENCY_CALLING_CLAIMS_ENABLED: false"
]) {
  if (!featureFlags.includes(flag)) {
    issues.push(`Communications unsafe flag not locked: ${flag}`);
  }
}

failIfIssues("Communications risk check", issues);

import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const source = fs.existsSync("packages/web/src/lib/communications/call-consent-policy.ts")
  ? read("packages/web/src/lib/communications/call-consent-policy.ts")
  : "";

for (const required of [
  "explicitConsentRequired: true",
  "covertRecordingAllowed: false",
  "hiddenCallLoggingAllowed: false",
  "autoCallingAllowed: false"
]) {
  if (!source.includes(required)) {
    issues.push(`Call consent policy missing ${required}.`);
  }
}

if (!fs.existsSync("docs/communications/CALL_CONSENT_AND_RECORDING.md")) {
  issues.push("Missing call consent documentation.");
}

failIfIssues("Call consent policy check", issues);

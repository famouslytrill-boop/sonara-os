import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const source = fs.existsSync("packages/web/src/lib/alerts/telegram-alert-policy.ts")
  ? read("packages/web/src/lib/alerts/telegram-alert-policy.ts")
  : "";
for (const required of ["customerDataAllowed: false", "tokenLoggingAllowed: false", "Redact"]) {
  if (!source.includes(required)) {
    issues.push(`Alert redaction policy missing ${required}.`);
  }
}
if (!fs.existsSync("docs/email/INTERNAL_EMAIL_ALERTS.md")) {
  issues.push("Missing internal email alerts documentation.");
}

failIfIssues("Alert redaction policy check", issues);

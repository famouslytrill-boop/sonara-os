import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
for (const file of [
  "docs/app-store/APP_STORE_READINESS.md",
  "docs/app-store/APPLE_APP_STORE_CHECKLIST.md",
  "docs/app-store/GOOGLE_PLAY_CHECKLIST.md",
  "docs/app-store/PRIVACY_LABELS_AND_DATA_SAFETY.md",
  "docs/app-store/MOBILE_APP_METADATA.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing app-store readiness file: ${file}`);
  }
}

const readiness = fs.existsSync("docs/app-store/APP_STORE_READINESS.md")
  ? read("docs/app-store/APP_STORE_READINESS.md")
  : "";
for (const required of ["PWA-first", "Do not claim", "Apple Developer", "Google Play"]) {
  if (!readiness.includes(required)) {
    issues.push(`App-store readiness doc missing ${required}.`);
  }
}

failIfIssues("App-store readiness check", issues);

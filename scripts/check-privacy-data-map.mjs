import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const mapPath = "docs/legal/APP_PRIVACY_DATA_MAP.md";
const source = fs.existsSync(mapPath) ? read(mapPath) : "";

for (const term of [
  "account data",
  "email address",
  "phone number",
  "support data",
  "uploaded files",
  "photos/videos",
  "audio/voice",
  "contacts",
  "location",
  "usage analytics",
  "crash/performance data",
  "payment records",
  "push notification tokens"
]) {
  if (!source.toLowerCase().includes(term)) {
    issues.push(`Privacy data map missing ${term}.`);
  }
}

failIfIssues("Privacy data map check", issues);

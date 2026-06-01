import { readFileSync } from "node:fs";

const text = readFileSync("data/github-radar-repos.ts", "utf8");
const records = text.split(/\n  \{\n/).slice(1);
const findings = [];

for (const record of records) {
  const name = record.match(/name: "([^"]+)"/)?.[1] ?? "Unknown";
  const blocked = /blocked: true/.test(record);
  const integrationStatus = record.match(/integrationStatus: "([^"]+)"/)?.[1] ?? "unknown";
  const licenseRisk = record.match(/licenseRisk: "([^"]+)"/)?.[1] ?? "unknown";
  const legalReview = /legalReviewRequired: true/.test(record);
  if (blocked && integrationStatus !== "blocked") findings.push(`${name}: blocked repo must use blocked integration status`);
  if (/AGPL|GPL|unknown|non-commercial/i.test(record) && licenseRisk === "allowed" && !legalReview) {
    findings.push(`${name}: risky license cannot be allowed without legal review`);
  }
}

if (findings.length) {
  console.error("GitHub Radar risk check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("GitHub Radar risk check passed.");

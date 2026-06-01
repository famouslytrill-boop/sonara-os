import { readFileSync } from "node:fs";

const text = readFileSync("data/technology-registry.ts", "utf8");
const findings = [];

if (!text.includes("humanReviewRequired")) findings.push("technology records must include human review flags");
if (/licenseRisk:\s*"blocked"[\s\S]*integrationStatus:\s*"scaffolded"/.test(text)) {
  findings.push("blocked technology cannot be scaffolded as an integration");
}
if (/hidden sync|local secret storage/i.test(text) && !/blockedUses/.test(text)) {
  findings.push("local edge risks must be listed as blocked uses");
}

if (findings.length) {
  console.error("Technology registry check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Technology registry check passed.");

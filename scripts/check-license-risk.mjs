import { readFileSync } from "node:fs";

const registry = readFileSync("data/open-source-tools.ts", "utf8");
const records = registry.split(/\n  \{\n/).slice(1);
const findings = [];

for (const record of records) {
  const name = record.match(/name: "([^"]+)"/)?.[1] ?? "Unknown record";
  const licenseRisk = record.match(/licenseRisk: "([^"]+)"/)?.[1] ?? "unknown";
  const commercialUseStatus = record.match(/commercialUseStatus: "([^"]+)"/)?.[1] ?? "needs_review";
  const integrationStatus = record.match(/integrationStatus: "([^"]+)"/)?.[1] ?? "needs_license_review";
  const license = record.match(/license: "([^"]+)"/)?.[1] ?? "";

  const highRisk = ["high", "critical", "unknown"].includes(licenseRisk) || /gpl|agpl|non-commercial|piracy|unknown/i.test(license);
  const incorrectlyAllowed = highRisk && commercialUseStatus === "allowed_after_review" && !["reference_only", "research_only"].includes(integrationStatus);

  if (incorrectlyAllowed) {
    findings.push(`${name}: high/unknown license risk cannot be marked allowed for integration`);
  }

  if (/piracy|copyright infringement/i.test(record) && integrationStatus !== "blocked") {
    findings.push(`${name}: piracy/copyright-risk references must be blocked`);
  }
}

if (findings.length) {
  console.error("License risk check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("License risk check passed.");

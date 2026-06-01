import { readFileSync } from "node:fs";

const text = readFileSync("data/github-radar-repos.ts", "utf8");
const findings = [];
for (const record of text.split(/\n  \{\n/).slice(1)) {
  const name = record.match(/name: "([^"]+)"/)?.[1] ?? "Unknown";
  const action = record.match(/recommendedAction: "([^"]+)"/)?.[1] ?? "";
  if (/blocked: true/.test(record) && !/^do not /i.test(action) && /(integrate|ship|enable)/i.test(action)) {
    findings.push(`${name}: blocked record cannot recommend integration`);
  }
}

if (findings.length) {
  console.error("Blocked repo claims check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Blocked repo claims check passed.");

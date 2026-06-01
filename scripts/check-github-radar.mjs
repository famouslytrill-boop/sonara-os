import { readFileSync } from "node:fs";

const text = readFileSync("data/github-radar-repos.ts", "utf8");
const findings = [];

for (const required of ["autoInstall: false", "ownerReviewRequired", "legalReviewRequired", "securityReviewRequired", "privacyReviewRequired"]) {
  if (!text.includes(required)) findings.push(`missing ${required}`);
}

if (findings.length) {
  console.error("GitHub Radar check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("GitHub Radar check passed.");

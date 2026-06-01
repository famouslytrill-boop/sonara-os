import { readFileSync } from "node:fs";

const text = readFileSync("data/github-radar-repos.ts", "utf8");
const findings = [];
for (const match of text.matchAll(/name: "([^"]+)"[\s\S]*?score: (\d+)/g)) {
  const score = Number(match[2]);
  if (score < 0 || score > 100) findings.push(`${match[1]}: score outside 0-100`);
}

if (findings.length) {
  console.error("Repo score threshold check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Repo score threshold check passed.");

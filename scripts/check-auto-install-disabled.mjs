import { readFileSync } from "node:fs";

const files = [
  "data/github-radar-repos.ts",
  "lib/github-radar/github-sync-policy.ts",
  "lib/github-radar/codex-sprint-template.ts",
  "lib/github-radar/generate-codex-prompt.ts",
];
const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/autoInstall:\s*true|auto_install:\s*true|install dependencies automatically/i.test(text)) {
    findings.push(`${file}: auto-install behavior is not allowed`);
  }
}

if (findings.length) {
  console.error("Auto-install check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Auto-install disabled check passed.");

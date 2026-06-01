import { readFileSync } from "node:fs";

const files = [
  "data/github-radar-repos.ts",
  "lib/github-radar/github-client.ts",
  "lib/github-radar/github-token-policy.ts",
];
const findings = [];
const secretPattern = /(ghp_|github_pat_|sk_live_|sk_test_|whsec_|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][A-Za-z0-9_-]+)/i;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (secretPattern.test(text)) findings.push(`${file}: secret-shaped value`);
  if (/NEXT_PUBLIC_GITHUB_TOKEN/i.test(text)) findings.push(`${file}: GitHub token must not be public`);
}

if (findings.length) {
  console.error("GitHub Radar secret check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("GitHub Radar secret check passed.");

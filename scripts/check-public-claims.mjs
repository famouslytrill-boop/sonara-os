import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "data", "lib"];
const blockedClaims = [
  /guaranteed revenue/i,
  /guaranteed customers/i,
  /guaranteed growth/i,
  /infinite databases/i,
  /fully autonomous/i,
  /watch any movie free/i,
  /medical diagnosis/i,
  /legal advice/i,
  /tax advice/i,
  /investment advice/i,
  /emergency dispatch/i,
  /non-commercial model bundled/i,
  /hidden scraping/i,
  /no data leaks/i,
];

const allowedFragments = [
  "does not guarantee revenue",
  "does not guarantee revenue, customers",
  "does not claim guaranteed revenue",
  "no guaranteed revenue",
  "not professional legal, tax, financial, medical",
  "not legal, tax, or financial advice",
  "not legal, tax, financial, medical",
  "no emergency routing",
  "no emergency navigation",
  "no hidden crawling",
];

function walk(dir) {
  const entries = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      entries.push(...walk(path));
    } else if (/\.(ts|tsx|js|jsx|md|mdx)$/.test(entry)) {
      entries.push(path);
    }
  }
  return entries;
}

const findings = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const normalized = text.toLowerCase();
    for (const pattern of blockedClaims) {
      const match = text.match(pattern);
      if (!match) continue;
      if (allowedFragments.some((fragment) => normalized.includes(fragment))) continue;
      findings.push(`${file}: ${match[0]}`);
    }
  }
}

if (findings.length) {
  console.error("Unsafe or overbroad public claims found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Public claims check passed.");

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".tsx")) files.push(full);
  }
  return files;
}

const findings = [];
for (const file of walk("app/research-lab/github-radar")) {
  const text = readFileSync(file, "utf8");
  if (/integrated|bundled|endorsed/i.test(text) && !/does not mean|not automatically/i.test(text)) {
    findings.push(`${file}: public copy may overclaim integration`);
  }
}

if (findings.length) {
  console.error("GitHub Radar public copy check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("GitHub Radar public copy check passed.");

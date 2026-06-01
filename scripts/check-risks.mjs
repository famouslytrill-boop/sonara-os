import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "lib", "data"];
const riskyTerms = [
  /jailbreak marketplace/i,
  /uncensored model/i,
  /piracy feature/i,
  /surveillance feature/i,
  /biometric identification feature/i,
  /robocall/i,
  /auto-send campaigns/i,
  /raw card storage/i,
  /store cvv/i,
  /service_role_key/i,
];

const allowedFiles = [
  "data\\open-source-tools.ts",
  "lib\\permissions",
  "lib\\device",
  "lib\\payments",
  "lib\\research",
  "lib\\env",
  "lib\\supabaseAdmin.ts",
  "data\\provider-registry.ts",
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      files.push(...walk(path));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

const findings = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const normalizedFile = file.replaceAll("/", "\\");
    const text = readFileSync(file, "utf8");
    for (const pattern of riskyTerms) {
      const match = text.match(pattern);
      if (!match) continue;
      if (allowedFiles.some((allowed) => normalizedFile.includes(allowed))) continue;
      findings.push(`${file}: ${match[0]}`);
    }
  }
}

if (findings.length) {
  console.error("Risky feature wording or implementation markers found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Risky feature check passed.");

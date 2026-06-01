import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "lib", "src"];
const clientSecretPatterns = [
  /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|TOKEN)[A-Z0-9_]*/i,
];
const serverSecretNames = [/SUPABASE_SERVICE_ROLE_KEY/i, /STRIPE_SECRET_KEY/i, /STRIPE_WEBHOOK_SECRET/i, /RESEND_API_KEY/i];

function walk(dir) {
  const files = [];
  if (!statExists(dir)) return files;
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

function statExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

const findings = [];

for (const file of roots.flatMap(walk)) {
  const text = readFileSync(file, "utf8");
  for (const pattern of clientSecretPatterns) {
    if (pattern.test(text)) findings.push(`${file}: public secret-like env name`);
  }
  const isServerOnlyHelper = file.includes(join("lib", "env")) || file.includes("supabaseAdmin") || file.includes("stripe");
  if (!isServerOnlyHelper && file.endsWith(".tsx")) {
    for (const pattern of serverSecretNames) {
      if (pattern.test(text)) findings.push(`${file}: server secret referenced from TSX surface`);
    }
  }
}

if (findings.length) {
  console.error("Environment safety check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Environment safety check passed.");

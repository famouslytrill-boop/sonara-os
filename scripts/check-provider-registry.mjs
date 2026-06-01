import { readFileSync } from "node:fs";

const text = readFileSync("data/provider-registry.ts", "utf8");
const findings = [];

if (!text.includes("serverOnlyEnv")) findings.push("provider records must declare serverOnlyEnv");
if (/sk_live_|whsec_|ghp_|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][A-Za-z0-9_-]+/i.test(text)) {
  findings.push("provider registry appears to contain secret-shaped values");
}
if (/session replay is enabled/i.test(text)) findings.push("session replay cannot be enabled by default");
if (/status:\s*"configured_by_env"[\s\S]*risk:\s*"blocked"/.test(text)) {
  findings.push("blocked provider cannot be configured by default");
}

if (findings.length) {
  console.error("Provider registry check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Provider registry check passed.");

import { existsSync, readFileSync } from "node:fs";

const required = [
  "lib/observability/telemetry.ts",
  "lib/observability/error-boundary-policy.ts",
  "lib/observability/agent-trace-schema.ts",
  "docs/observability/OBSERVABILITY_STACK.md",
];

const findings = required.filter((file) => !existsSync(file));
const telemetry = existsSync("lib/observability/telemetry.ts") ? readFileSync("lib/observability/telemetry.ts", "utf8") : "";
if (!/redact/i.test(telemetry)) findings.push("telemetry helper must redact sensitive metadata");

if (findings.length) {
  console.error("Observability config check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Observability config check passed.");

import { existsSync } from "node:fs";

const failures = [];
if (existsSync("package-lock.json")) failures.push("package-lock.json is not allowed in this repo");
if (!existsSync("pnpm-lock.yaml")) failures.push("pnpm-lock.yaml is required");
if (!existsSync(".env.example")) failures.push(".env.example is required");

if (failures.length) {
  console.error("Repo standards check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Repo standards check passed.");

import { readFileSync } from "node:fs";

const packageJson = readFileSync("package.json", "utf8");
if (!packageJson.includes('"packageManager": "pnpm@')) {
  console.error("packageManager must declare pnpm.");
  process.exit(1);
}
console.log("Security basics check passed.");

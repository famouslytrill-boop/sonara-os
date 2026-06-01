import { existsSync } from "node:fs";

const required = ["public/brand/sonara-mark.svg", "public/favicon.svg", "app/icon.svg", "public/manifest.webmanifest"];
const missing = required.filter((file) => !existsSync(file));
if (missing.length) {
  console.error("Missing brand assets:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}
console.log("Brand assets check passed.");

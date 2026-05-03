import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

console.log("SONARA OS™ safe local bootstrap");
console.log("This script installs only project dependencies from the lockfile.\n");

if (!existsSync("package.json")) {
  console.error("Missing package.json. Run this from the SONARA OS™ project root.");
  process.exit(1);
}

if (!existsSync("package-lock.json")) {
  console.error(
    "Missing package-lock.json. Refusing to install without a lockfile."
  );
  process.exit(1);
}

const install = spawnSync("npm ci", {
  stdio: "inherit",
  shell: true,
});

if (install.status !== 0) {
  console.error("npm ci failed. Review the npm output above.");
  process.exit(install.status ?? 1);
}

console.log("");
console.log("Bootstrap complete. Next safe check: npm run launch:local-check");

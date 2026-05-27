import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

console.log("SONARA OS safe local bootstrap");
console.log("This script installs only project dependencies from pnpm-lock.yaml.\n");

if (!existsSync("package.json")) {
  console.error("Missing package.json. Run this from the SONARA OS project root.");
  process.exit(1);
}

if (!existsSync("pnpm-lock.yaml")) {
  console.error("Missing pnpm-lock.yaml. Refusing to install without a lockfile.");
  process.exit(1);
}

const install =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm install --frozen-lockfile"], {
        stdio: "inherit",
      })
    : spawnSync("pnpm", ["install", "--frozen-lockfile"], {
        stdio: "inherit",
      });

if (install.status !== 0) {
  console.error("pnpm install --frozen-lockfile failed. Review the pnpm output above.");
  process.exit(install.status ?? 1);
}

console.log("");
console.log("Bootstrap complete. Next safe check: pnpm run verify:launch");

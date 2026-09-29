import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

console.log("SONARA One safe local bootstrap");
console.log("This script installs only project dependencies from pnpm-lock.yaml.\n");

if (!existsSync("package.json")) {
  console.error("Missing package.json. Run this from the SONARA One project root.");
  process.exit(1);
}

if (!existsSync("pnpm-lock.yaml")) {
  console.error("Missing pnpm-lock.yaml. Refusing to install without a lockfile.");
  process.exit(1);
}

if (platform() === "win32") {
  console.log("Windows local installation uses the pinned pnpm executable through Corepack.");
  console.log("If Smart App Control blocks it, do not disable Windows protection or substitute another package manager.");
  console.log("Use the repository pull request checks on GitHub Actions for a clean Linux install:");
  console.log("https://github.com/famouslytrill-boop/sonara-os/actions");
  console.log("After the executable is publisher-approved, rerun this script to install locally.\n");
}

const install =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm install --frozen-lockfile"], {
        stdio: "inherit",
      })
    : spawnSync("pnpm", ["install", "--frozen-lockfile"], {
        stdio: "inherit",
      });

if (install.error?.code === "UNKNOWN" || install.error?.code === "EPERM") {
  console.error("Windows blocked the pinned pnpm executable with an application-control policy.");
  console.error("No repository change can safely override that device policy.");
  console.error("Use GitHub Actions for dependency installation or obtain publisher approval for pnpm.");
  process.exit(2);
}

if (install.status !== 0) {
  console.error("pnpm install --frozen-lockfile failed. Review the pnpm output above.");
  process.exit(install.status ?? 1);
}

console.log("");
console.log("Bootstrap complete. Next safe check: pnpm run verify:launch");

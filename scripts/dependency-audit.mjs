import { spawnSync } from "node:child_process";

console.log("SONARA One dependency audit");
console.log("This script reports audit findings and does not run automatic fixes.\n");

const audit =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm audit --audit-level moderate"], {
        stdio: "inherit",
      })
    : spawnSync("pnpm", ["audit", "--audit-level", "moderate"], {
        stdio: "inherit",
      });

if (audit.status === 0) {
  console.log("\nDependency audit passed at moderate level.");
} else {
  console.log(
    "\nDependency audit reported issues. Review before upgrading. Do not hide or auto-fix findings."
  );
  process.exitCode = audit.status ?? 1;
}

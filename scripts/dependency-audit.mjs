import { spawnSync } from "node:child_process";

console.log("SONARA OSâ„¢ dependency audit");
console.log("This script reports audit findings and does not run automatic fixes.\n");

const audit = spawnSync("npm audit --audit-level=moderate", {
  stdio: "inherit",
  shell: true,
});

if (audit.status === 0) {
  console.log("\nDependency audit passed at moderate level.");
} else {
  console.log(
    "\nDependency audit reported issues. Review before upgrading. Do not run force fixes blindly."
  );
  process.exitCode = audit.status ?? 1;
}

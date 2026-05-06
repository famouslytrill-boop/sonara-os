import { spawnSync } from "node:child_process";

const commands = [
  ["npm", ["run", "build"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "scan:secrets"]],
  ["npm", ["run", "verify:security"]],
  ["npm", ["run", "verify:db"]],
  ["npm", ["run", "verify:heartbeat"]],
  ["npm", ["run", "verify:entity-security"]],
  ["npm", ["run", "verify:brand"]],
  ["npm", ["run", "verify:env"]],
  ["npm", ["run", "verify:stripe"]],
  ["npm", ["run", "workers:smoke"]],
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result =
    process.platform === "win32" && command === "npm"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${command} ${args.join(" ")}`], { stdio: "inherit" })
      : spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPost-deploy local verification passed. Run the manual live checks in docs/POST_DEPLOY_VERIFY.md next.");

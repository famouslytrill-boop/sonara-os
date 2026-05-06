import { spawnSync } from "node:child_process";

const commands = [
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
  ["npm", ["run", "test:smoke"]],
  ["npm", ["run", "test:docs"]],
  ["npm", ["run", "build"]],
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

console.log("\nAll safe verification checks passed.");

import { spawnSync } from "node:child_process";

const commands = [
  ["pnpm", ["run", "verify:launch"]],
  ["pnpm", ["run", "test:docs"]],
  ["pnpm", ["run", "smoke:live"]],
  ["pnpm", ["run", "workers:smoke"]],
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${command} ${args.join(" ")}`], { stdio: "inherit" })
      : spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPost-deploy local verification passed. Run the manual live checks in docs/POST_DEPLOY_VERIFY.md next.");

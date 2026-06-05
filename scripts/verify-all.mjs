import { spawnSync } from "node:child_process";

const commands = [
  ["pnpm", ["run", "lint"]],
  ["pnpm", ["run", "typecheck"]],
  ["pnpm", ["run", "scan:secrets"]],
  ["pnpm", ["run", "verify:security"]],
  ["pnpm", ["run", "verify:db"]],
  ["pnpm", ["run", "verify:heartbeat"]],
  ["pnpm", ["run", "verify:entity-security"]],
  ["pnpm", ["run", "verify:brand"]],
  ["pnpm", ["run", "verify:env"]],
  ["pnpm", ["run", "verify:email-env"]],
  ["pnpm", ["run", "verify:stripe"]],
  ["pnpm", ["run", "verify:legacy-copy"]],
  ["pnpm", ["run", "check:public-claims"]],
  ["pnpm", ["run", "check:risky-features"]],
  ["pnpm", ["run", "check:env-safety"]],
  ["pnpm", ["run", "check-license-risk"]],
  ["pnpm", ["run", "check-provider-registry"]],
  ["pnpm", ["run", "check-technology-registry"]],
  ["pnpm", ["run", "check-observability-config"]],
  ["pnpm", ["run", "check:github-radar"]],
  ["pnpm", ["run", "check:github-radar-risk"]],
  ["pnpm", ["run", "check:github-radar-secrets"]],
  ["pnpm", ["run", "check:repo-score-thresholds"]],
  ["pnpm", ["run", "check:blocked-repo-claims"]],
  ["pnpm", ["run", "check:auto-install-disabled"]],
  ["pnpm", ["run", "check:github-radar-public-copy"]],
  ["pnpm", ["run", "check-brand-assets"]],
  ["pnpm", ["run", "check-security-basics"]],
  ["pnpm", ["run", "check-repo-standards"]],
  ["pnpm", ["run", "smoke:routes"]],
  ["pnpm", ["run", "workers:smoke"]],
  ["pnpm", ["run", "test:smoke"]],
  ["pnpm", ["run", "test:docs"]],
  ["pnpm", ["run", "build"]],
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

console.log("\nAll safe verification checks passed.");

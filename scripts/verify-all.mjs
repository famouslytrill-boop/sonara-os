import { spawnSync } from "node:child_process";

const gates = [
  ["pnpm", ["run", "lint"]],
  ["pnpm", ["run", "typecheck"]],
  ["pnpm", ["run", "build"]],
  ["pnpm", ["run", "smoke:routes"]],
  ["pnpm", ["run", "check:legacy"]],
  ["pnpm", ["run", "check:public-claims"]],
  ["pnpm", ["run", "check:risky-features"]],
  ["pnpm", ["run", "check:env-safety"]],
  ["pnpm", ["run", "check-license-risk"]],
  ["pnpm", ["run", "check-provider-registry"]],
  ["pnpm", ["run", "check-technology-registry"]],
  ["pnpm", ["run", "check:github-radar"]],
  ["pnpm", ["run", "check:github-radar-risk"]],
  ["pnpm", ["run", "check:github-radar-secrets"]],
  ["pnpm", ["run", "check:auto-install-disabled"]],
  ["pnpm", ["run", "check:vercel-env-docs"]],
  ["pnpm", ["run", "check:live-readiness"]],
  ["pnpm", ["run", "verify:db"]],
  ["pnpm", ["run", "validate:infrastructure"]]
];

for (const [command, args] of gates) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Full verification gate passed.");

import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--quiet");

const result = spawnSync("pnpm", ["--dir", "frontend", "run", "lint", ...forwardedArgs], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error.message);
}

process.exit(1);

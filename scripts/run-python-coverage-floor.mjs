#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "scripts", "verify-python-coverage-floor.py");
const candidates = process.platform === "win32"
  ? [["py", ["-3"]], ["python", []], ["python3", []]]
  : [["python3", []], ["python", []]];

for (const [command, prefix] of candidates) {
  const probe = spawnSync(command, [...prefix, "--version"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (probe.error || probe.status !== 0) continue;

  const run = spawnSync(command, [...prefix, CHECK], {
    cwd: ROOT,
    stdio: "inherit"
  });
  process.exit(run.status ?? 1);
}

process.stderr.write(
  "Python 3 was not found. Install Python 3, then rerun pnpm run verify:python-coverage-floor.\n"
);
process.exit(1);

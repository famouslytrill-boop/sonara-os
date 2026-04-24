import { spawnSync } from "node:child_process";
import path from "node:path";
import { listPackages, readJson } from "./workspace.mjs";

const requiredScripts = ["typecheck", "build", "smoke"];

for (const packageDir of listPackages()) {
  const manifest = readJson(path.join(packageDir, "package.json"));
  for (const scriptName of requiredScripts) {
    if (!manifest.scripts?.[scriptName]) {
      throw new Error(`${manifest.name} missing package script: ${scriptName}`);
    }
  }
}

run("scripts/typecheck.mjs");
run("scripts/build.mjs");

for (const packageDir of listPackages()) {
  const result = spawnSync(process.execPath, ["scripts/smoke-package.mjs", packageDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Smoke gate passed for every package script.");

function run(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

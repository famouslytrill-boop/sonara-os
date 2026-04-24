import { listPackages } from "./workspace.mjs";
import { spawnSync } from "node:child_process";

for (const packageDir of listPackages()) {
  const result = spawnSync(process.execPath, ["scripts/build-package.mjs", packageDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Build completed for all packages.");

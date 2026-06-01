import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];
const autoInstallTruePattern =
  /\b(AUTO_INSTALL_EXTERNAL_REPOS|AUTO_DEPENDENCY_INSTALLS_FROM_EVOLUTION)\s*[:=]\s*true\b/i;

for (const filePath of listFiles(["packages", ".env.example"])) {
  const rel = relative(filePath);
  if (rel.includes("/dist/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  if (autoInstallTruePattern.test(source)) {
    issues.push(`${rel} enables automatic third-party install behavior.`);
  }
}

failIfIssues("Auto-install disabled check", issues);

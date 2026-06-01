import fs from "node:fs";
import { exists, failIfIssues } from "./check-utils.mjs";

const issues = [];
const watcherPath = "packages/github-update-watcher/src/index.ts";

if (!exists(watcherPath)) {
  issues.push("GitHub watcher package is missing.");
} else {
  const source = fs.readFileSync(watcherPath, "utf8");
  if (!/AUTO_INSTALL_EXTERNAL_REPOS:\s*false/.test(source)) {
    issues.push("GitHub watcher must keep AUTO_INSTALL_EXTERNAL_REPOS false.");
  }
  if (!/AUTO_MERGE_DEPENDENCY_UPDATES:\s*false/.test(source)) {
    issues.push("GitHub watcher must keep AUTO_MERGE_DEPENDENCY_UPDATES false.");
  }
  if (!/ownerApprovalRequiredForAdoption:\s*true/.test(source)) {
    issues.push("GitHub watcher report must require owner approval before adoption.");
  }
}

failIfIssues("GitHub Radar risk gate", issues);

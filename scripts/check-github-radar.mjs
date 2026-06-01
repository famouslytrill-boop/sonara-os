import fs from "node:fs";
import { exists, failIfIssues } from "./check-utils.mjs";

const issues = [];
const watcherPath = "packages/github-update-watcher/src/index.ts";

if (!exists(watcherPath)) {
  issues.push("GitHub Radar/Update Watcher package is missing.");
} else {
  const source = fs.readFileSync(watcherPath, "utf8");
  for (const required of [
    "GITHUB_UPDATE_WATCHER_ENABLED",
    "AUTO_INSTALL_EXTERNAL_REPOS",
    "OWNER_APPROVAL_REQUIRED_FOR_ADOPTION",
    "createGitHubUpdateWatchReport"
  ]) {
    if (!source.includes(required)) {
      issues.push(`GitHub watcher missing ${required}.`);
    }
  }
}

if (!exists("docs/GITHUB_UPDATE_WATCHER.md")) {
  issues.push("Missing GitHub watcher policy documentation.");
}

failIfIssues("GitHub Radar check", issues);

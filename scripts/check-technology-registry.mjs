import fs from "node:fs";
import { exists, failIfIssues } from "./check-utils.mjs";

const issues = [];
const intakePath = "packages/open-source-intake/src/project-registry.ts";
const watcherPath = "packages/github-update-watcher/src/index.ts";

if (!exists(intakePath)) {
  issues.push("Missing open-source technology intake registry.");
} else {
  const source = fs.readFileSync(intakePath, "utf8");
  for (const term of ["reference_only", "concept_adapter", "blocked"]) {
    if (!source.includes(term)) {
      issues.push(`Open-source registry missing ${term} status.`);
    }
  }
}

if (!exists(watcherPath)) {
  issues.push("Missing GitHub update watcher registry.");
}

failIfIssues("Technology registry check", issues);

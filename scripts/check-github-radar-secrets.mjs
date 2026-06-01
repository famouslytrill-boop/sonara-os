import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];
const secretPattern =
  /(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|GITHUB_TOKEN\s*=\s*[^\\s#]+)/;

for (const filePath of listFiles([
  "packages/github-update-watcher",
  "packages/web/src",
  ".env.example"
])) {
  const rel = relative(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  if (secretPattern.test(source) && !rel.endsWith(".env.example")) {
    issues.push(`${rel} appears to contain a GitHub token or token assignment.`);
  }
  if (rel.includes("packages/web/src") && /GITHUB_TOKEN/.test(source)) {
    issues.push(`${rel} references GITHUB_TOKEN in browser source.`);
  }
}

failIfIssues("GitHub Radar secret check", issues);

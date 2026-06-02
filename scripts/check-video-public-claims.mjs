import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];
const unsafe = [
  /HeyGen partnership/i,
  /HyperFrames (is|has been) integrated/i,
  /unlimited video rendering/i,
  /guaranteed (conversion|revenue)/i,
  /automatic publishing/i
];

for (const filePath of listFiles(["packages/web/src", "docs"])) {
  const rel = relative(filePath);
  if (rel.includes("docs/audits/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  for (const pattern of unsafe) {
    if (
      pattern.test(source) &&
      !/no |not |do not|not integrated|reference only|blocked|without|review/i.test(source)
    ) {
      issues.push(`${rel} contains unsafe video public claim matching ${pattern}.`);
    }
  }
}

failIfIssues("Video public claims check", issues);

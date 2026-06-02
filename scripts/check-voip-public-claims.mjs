import fs from "node:fs";
import { failIfIssues, listFiles, relative } from "./check-utils.mjs";

const issues = [];
const unsafeClaimPatterns = [
  /Linphone (is|has been) integrated/i,
  /production SIP calling is live/i,
  /emergency (calling|dispatch|routing) (is|ready|supported)/i,
  /robocall/i,
  /covert recording/i
];

for (const filePath of listFiles(["packages/web/src", "docs"])) {
  const rel = relative(filePath);
  if (rel.includes("docs/audits/")) continue;
  const source = fs.readFileSync(filePath, "utf8");
  for (const pattern of unsafeClaimPatterns) {
    if (
      pattern.test(source) &&
      !/blocked|not integrated|reference only|no |without|review/i.test(source)
    ) {
      issues.push(`${rel} contains unsafe VoIP public claim matching ${pattern}.`);
    }
  }
}

failIfIssues("VoIP public claims check", issues);

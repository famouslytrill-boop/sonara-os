import {
  failIfIssues,
  isAllowedSafetyContext,
  linesWith,
  listFiles,
  relative
} from "./check-utils.mjs";

const riskyClaims = [
  /guaranteed revenue/i,
  /guaranteed success/i,
  /fully autonomous/i,
  /uncensored/i,
  /watch any movie free/i,
  /medical diagnosis/i,
  /legal advice/i,
  /tax advice/i,
  /investment advice/i,
  /emergency dispatch/i,
  /no data leaks/i,
  /infinite database/i,
  /production ready/i
];

const scannedFiles = listFiles(["packages/web/src", "packages/ui/src", "README.md"]).filter(
  (filePath) =>
    !relative(filePath).includes(".test.") &&
    !relative(filePath).includes("lib/shared/safety-rules.ts")
);

const issues = [];

for (const filePath of scannedFiles) {
  for (const claim of riskyClaims) {
    for (const hit of linesWith(filePath, claim)) {
      if (!isAllowedSafetyContext(hit.line)) {
        issues.push(
          `${relative(filePath)}:${hit.lineNumber} has an unsupported public claim: ${hit.line.trim()}`
        );
      }
    }
  }
}

failIfIssues("Public claims check", issues);

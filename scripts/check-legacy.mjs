import {
  failIfIssues,
  isAllowedSafetyContext,
  linesWith,
  listFiles,
  relative
} from "./check-utils.mjs";

const legacyTerms = [
  /TrackFoundry/i,
  /LineReady/i,
  /NoticeGrid/i,
  /Independent systems\. Shared infrastructure\. Stronger markets\./i
];

const activeFiles = listFiles(["packages/web/src", "packages/ui/src"]).filter(
  (filePath) => !relative(filePath).includes(".test.")
);

const issues = [];

for (const filePath of activeFiles) {
  for (const term of legacyTerms) {
    for (const hit of linesWith(filePath, term)) {
      if (!isAllowedSafetyContext(hit.line)) {
        issues.push(
          `${relative(filePath)}:${hit.lineNumber} contains legacy public copy: ${hit.line.trim()}`
        );
      }
    }
  }
}

failIfIssues("Legacy public copy check", issues);

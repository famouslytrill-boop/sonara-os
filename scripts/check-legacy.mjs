import {
  failIfIssues,
  isAllowedSafetyContext,
  linesWith,
  listFiles,
  relative
} from "./check-utils.mjs";

const legacyTerms = [
  /SONARA OS/i,
  /TrackFoundry/i,
  /trackfoundry/i,
  /LineReady/i,
  /lineready/i,
  /NoticeGrid/i,
  /noticegrid/i,
  /Signal OS/i,
  /trackfoundry-media/i,
  /lineready-documents/i,
  /noticegrid-imports/i,
  /Independent systems\. Shared infrastructure\. Stronger markets\./i
];

const activeFiles = listFiles([
  "package.json",
  "README.md",
  ".env.example",
  "packages/web/src",
  "packages/ui/src",
  "packages/brand-experience-system/src",
  "scripts",
  "docs"
]).filter(
  (filePath) =>
    !relative(filePath).includes(".test.") &&
    !relative(filePath).includes("docs/archive/") &&
    !relative(filePath).includes("docs/audits/")
);

const issues = [];

for (const filePath of activeFiles) {
  for (const term of legacyTerms) {
    for (const hit of linesWith(filePath, term)) {
      if (
        !isAllowedSafetyContext(hit.line) &&
        !isAllowedLegacyRedirectReference(filePath, hit.line)
      ) {
        issues.push(
          `${relative(filePath)}:${hit.lineNumber} contains legacy public copy: ${hit.line.trim()}`
        );
      }
    }
  }
}

failIfIssues("Legacy public copy check", issues);

function isAllowedLegacyRedirectReference(filePath, line) {
  const file = relative(filePath);
  if (
    [
      "scripts/check-legacy.mjs",
      "scripts/check-old-branding.mjs",
      "scripts/smoke-package.mjs"
    ].includes(file)
  ) {
    return true;
  }
  return (
    file === "packages/web/src/app.ts" &&
    /\["\/(trackfoundry|lineready|line-ready|noticegrid|notice-grid|signal-os|os)/i.test(line)
  );
}

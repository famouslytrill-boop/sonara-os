import { failIfIssues, linesWith, listFiles, relative } from "./check-utils.mjs";

const oldBrandingPatterns = [
  /SONARA OS/i,
  /Signal OS/i,
  /TrackFoundry/i,
  /trackfoundry/i,
  /LineReady/i,
  /lineready/i,
  /NoticeGrid/i,
  /noticegrid/i,
  /trackfoundry-media/i,
  /lineready-documents/i,
  /noticegrid-imports/i
];

const scannedFiles = listFiles([
  "package.json",
  "README.md",
  ".env.example",
  "packages",
  "scripts",
  "docs"
]).filter((filePath) => {
  const file = relative(filePath);
  return (
    !file.includes("docs/audits/") &&
    !file.includes("docs/archive/") &&
    !file.includes("node_modules/") &&
    !file.includes("/dist/")
  );
});

const issues = [];

for (const filePath of scannedFiles) {
  for (const pattern of oldBrandingPatterns) {
    for (const hit of linesWith(filePath, pattern)) {
      if (!isAllowedCompatibilityReference(filePath)) {
        issues.push(
          `${relative(filePath)}:${hit.lineNumber} contains old public branding: ${hit.line.trim()}`
        );
      }
    }
  }
}

failIfIssues("Old public branding check", issues);

function isAllowedCompatibilityReference(filePath) {
  const file = relative(filePath);
  return [
    "packages/web/src/app.ts",
    "packages/web/src/debugging.test.ts",
    "packages/web/src/routeManifest.test.ts",
    "scripts/smoke-package.mjs",
    "scripts/check-legacy.mjs",
    "scripts/check-old-branding.mjs",
    "scripts/check-metadata-branding.mjs"
  ].includes(file);
}

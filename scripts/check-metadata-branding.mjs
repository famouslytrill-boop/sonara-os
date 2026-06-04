import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const indexHtml = read("packages/web/src/index.html");
const manifest = read("packages/web/src/site.webmanifest");
const deployment = read("packages/web/src/config/deployment.ts");

for (const [name, source] of [
  ["index.html", indexHtml],
  ["site.webmanifest", manifest],
  ["deployment.ts", deployment]
]) {
  if (!source.includes("SONARA Industries")) {
    issues.push(`${name} must use SONARA Industries metadata.`);
  }
  for (const forbidden of ["SONARA OS", "Signal OS", "TrackFoundry", "LineReady", "NoticeGrid"]) {
    if (source.includes(forbidden)) {
      issues.push(`${name} contains old public branding: ${forbidden}`);
    }
  }
}

for (const required of [
  'property="og:title"',
  'property="og:description"',
  'name="twitter:title"',
  'name="twitter:description"',
  'rel="manifest"',
  'rel="icon"'
]) {
  if (!indexHtml.includes(required)) {
    issues.push(`index.html missing metadata tag: ${required}`);
  }
}

failIfIssues("Metadata branding check", issues);

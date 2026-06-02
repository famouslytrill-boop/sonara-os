import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
for (const file of [
  "packages/web/src/lib/video/video-rendering-policy.ts",
  "packages/web/src/lib/video/video-quota-policy.ts",
  "docs/research/HYPERFRAMES_REVIEW.md",
  "docs/infrastructure/VIDEO_RENDERING_QUEUE_POLICY.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing video rendering policy file: ${file}`);
  }
}

const flags = fs.existsSync("packages/web/src/lib/shared/feature-flags.ts")
  ? read("packages/web/src/lib/shared/feature-flags.ts")
  : "";
for (const flag of [
  "HYPERFRAMES_PRODUCTION_RENDERING_ENABLED: false",
  "UNLIMITED_VIDEO_RENDERING_ENABLED: false",
  "AUTO_PUBLISH_GENERATED_VIDEO: false",
  "HEYGEN_PARTNERSHIP_CLAIMS_ENABLED: false",
  "VIDEO_RENDERING_WITHOUT_QUEUE_OR_QUOTA: false"
]) {
  if (!flags.includes(flag)) {
    issues.push(`Video unsafe flag not locked: ${flag}`);
  }
}

failIfIssues("Video rendering risk check", issues);

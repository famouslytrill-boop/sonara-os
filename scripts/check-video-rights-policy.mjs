import fs from "node:fs";
import { failIfIssues, read } from "./check-utils.mjs";

const issues = [];
const safety = fs.existsSync("packages/web/src/lib/video/video-asset-safety.ts")
  ? read("packages/web/src/lib/video/video-asset-safety.ts")
  : "";

for (const required of [
  "copyrightedAssetMisuseBlocked: true",
  "fakeEndorsementsBlocked: true",
  "nonConsensualLikenessBlocked: true",
  "impliedVendorPartnershipClaimsBlocked: true"
]) {
  if (!safety.includes(required)) {
    issues.push(`Video asset safety missing ${required}.`);
  }
}

for (const file of [
  "docs/creator/VIDEO_RENDERING_SAFETY.md",
  "docs/storage/VIDEO_ASSET_STORAGE_POLICY.md"
]) {
  if (!fs.existsSync(file)) {
    issues.push(`Missing video rights file: ${file}`);
  }
}

failIfIssues("Video rights policy check", issues);

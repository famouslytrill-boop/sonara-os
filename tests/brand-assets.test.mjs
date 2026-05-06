import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const assets = [
  "public/brand/logos/parent-mark.svg",
  "public/brand/logos/creator-mark.svg",
  "public/brand/logos/business-mark.svg",
  "public/brand/logos/community-mark.svg",
  "public/brand/logos/launchpad-mark.svg",
  "public/brand/icons/parent-icon.svg",
  "public/favicon.svg",
  "public/icon.svg",
];

for (const asset of assets) {
  const path = join(root, asset);
  assert.equal(existsSync(path), true, `${asset} must exist`);
  assert.match(readFileSync(path, "utf8"), /<svg[\s>]/, `${asset} must be SVG`);
}

const manifestPath = join(root, "public/manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.name, "Umbrella Technologies");

for (const icon of manifest.icons ?? []) {
  const iconPath = join(root, "public", icon.src.replace(/^\//, ""));
  assert.equal(existsSync(iconPath), true, `manifest icon ${icon.src} must exist`);
}

console.log("Brand assets test passed.");

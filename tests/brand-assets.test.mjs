import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const assets = [
  "public/brand/sonara-logo.svg",
  "public/brand/sonara-mark.svg",
  "public/brand/business-builder-icon.svg",
  "public/brand/creator-studio-icon.svg",
  "public/brand/growth-studio-icon.svg",
  "public/icon.svg",
];

for (const asset of assets) {
  const path = join(root, asset);
  assert.equal(existsSync(path), true, `${asset} must exist`);
  assert.match(readFileSync(path, "utf8"), /<svg[\s>]/, `${asset} must be SVG`);
}

const manifestPath = join(root, "public/manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.name, "SONARA Industries");

for (const icon of manifest.icons ?? []) {
  const iconPath = join(root, "public", icon.src.replace(/^\//, ""));
  assert.equal(existsSync(iconPath), true, `manifest icon ${icon.src} must exist`);
}

console.log("Brand assets test passed.");

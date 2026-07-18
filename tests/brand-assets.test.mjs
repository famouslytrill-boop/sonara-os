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

const manifestPath = join(root, "public/site.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.name, "SONARA Industries");
assert.equal(manifest.id, "/");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");

for (const icon of manifest.icons ?? []) {
  const iconPath = join(root, "public", icon.src.replace(/^\//, ""));
  assert.equal(existsSync(iconPath), true, `manifest icon ${icon.src} must exist`);
}

for (const shortcut of manifest.shortcuts ?? []) {
  assert.match(shortcut.url, /^\/(business-builder|creator-studio|growth-studio)$/);
  for (const icon of shortcut.icons ?? []) {
    const iconPath = join(root, "public", icon.src.replace(/^\//, ""));
    assert.equal(existsSync(iconPath), true, `shortcut icon ${icon.src} must exist`);
  }
}

console.log("Brand assets test passed.");

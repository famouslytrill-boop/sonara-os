"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "lib", "sonara-route-registry.cjs");
let source = fs.readFileSync(file, "utf8");

source = ensureAfter(
  source,
  '  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",\n  "/account/integrations"',
  '  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",\n  "/account/integrations", "/product-lifecycle"',
  '"/product-lifecycle"'
);
source = ensureAfter(
  source,
  '    "/business-builder/owner/vendors",',
  '    "/business-builder/owner/vendors", "/business-builder/product-lifecycle",',
  '"/business-builder/product-lifecycle"'
);
source = ensureAfter(
  source,
  '    "/creator-studio/generation", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis"',
  '    "/creator-studio/generation", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis", "/creator-studio/product-lifecycle"',
  '"/creator-studio/product-lifecycle"'
);
source = ensureAfter(
  source,
  '    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs"',
  '    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs", "/growth-studio/product-lifecycle"',
  '"/growth-studio/product-lifecycle"'
);

if (!source.includes('"/growth-studio/product-lifecycle": "Growth Product Lifecycle"')) {
  const anchor = '  "/creator-studio/generation": "Generation Studio"';
  if (!source.includes(anchor)) throw new Error("Product Lifecycle title compatibility anchor missing");
  source = source.replace(anchor, `${anchor},\n  "/product-lifecycle": "Product Lifecycle",\n  "/business-builder/product-lifecycle": "Business Product Lifecycle",\n  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",\n  "/growth-studio/product-lifecycle": "Growth Product Lifecycle"`);
}

fs.writeFileSync(file, source);
console.log("Market Intelligence lifecycle anchors normalized");

function ensureAfter(text, before, after, marker) {
  if (text.includes(marker)) return text;
  if (!text.includes(before)) throw new Error(`Compatibility anchor missing: ${before.slice(0, 100)}`);
  return text.replace(before, after);
}

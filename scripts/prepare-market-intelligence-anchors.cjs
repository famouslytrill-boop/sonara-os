"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "lib", "sonara-route-registry.cjs");
let source = fs.readFileSync(file, "utf8");

source = ensureCanonicalPair(
  source,
  '  "/account/profile", "/account/security", "/account/preferences", "/account/setup", "/account/workspaces",\n  "/account/integrations"',
  "/product-lifecycle",
  "/market-intelligence"
);
source = ensureCanonicalPair(
  source,
  '    "/business-builder/owner/vendors"',
  "/business-builder/product-lifecycle",
  "/business-builder/market-intelligence"
);

source = source.replace(
  '"/creator-studio/tools/release-checklist", "/creator-studio/product-lifecycle"',
  '"/creator-studio/tools/release-checklist"'
);
source = ensureCanonicalPair(
  source,
  '    "/creator-studio/generation", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis"',
  "/creator-studio/product-lifecycle",
  "/creator-studio/market-intelligence"
);

source = source.replace(
  '"/growth-studio/tools/readiness", "/growth-studio/product-lifecycle"',
  '"/growth-studio/tools/readiness"'
);
source = ensureCanonicalPair(
  source,
  '    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs"',
  "/growth-studio/product-lifecycle",
  "/growth-studio/market-intelligence"
);

if (!source.includes('"/growth-studio/market-intelligence": "Growth Market Intelligence"')) {
  const anchor = '  "/creator-studio/generation": "Generation Studio"';
  if (!source.includes(anchor)) throw new Error("Market Intelligence title compatibility anchor missing");
  source = source.replace(anchor, `${anchor},\n  "/product-lifecycle": "Product Lifecycle",\n  "/business-builder/product-lifecycle": "Business Product Lifecycle",\n  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",\n  "/growth-studio/product-lifecycle": "Growth Product Lifecycle",\n  "/market-intelligence": "Market Intelligence",\n  "/business-builder/market-intelligence": "Business Market Intelligence",\n  "/creator-studio/market-intelligence": "Creator Market Intelligence",\n  "/growth-studio/market-intelligence": "Growth Market Intelligence"`);
}

fs.writeFileSync(file, source);
console.log("Market Intelligence final route anchors normalized");

function ensureCanonicalPair(text, anchor, lifecycleRoute, marketRoute) {
  const lifecycleAnchor = `${anchor}, "${lifecycleRoute}"`;
  const canonical = `${lifecycleAnchor}, "${marketRoute}"`;
  if (text.includes(canonical)) return text;
  if (text.includes(lifecycleAnchor)) return text.replace(lifecycleAnchor, canonical);
  if (!text.includes(anchor)) throw new Error(`Compatibility anchor missing: ${anchor.slice(0, 100)}`);
  return text.replace(anchor, canonical);
}

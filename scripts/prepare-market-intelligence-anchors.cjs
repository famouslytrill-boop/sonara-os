"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchMarketIntelligenceApplyScript();
normalizeRouteRegistry();

console.log("Market Intelligence final route anchors and idempotent manifest transforms normalized");

function patchMarketIntelligenceApplyScript() {
  const file = path.join(process.cwd(), "scripts", "apply-market-intelligence-system.cjs");
  let source = fs.readFileSync(file, "utf8");

  const sentinel = 'source = ensureCompanyManifestValues(source, "business_builder", "routes"';
  if (source.includes(sentinel)) return;

  const routeBlock = `  source = replaceOnce(
    source,
    'routes: ["/business-builder", "/business-builder/dashboard", "/business-builder/owner", "/business-builder/billing", "/business-builder/employees", "/business-builder/launch-readiness"]',
    'routes: ["/business-builder", "/business-builder/dashboard", "/business-builder/owner", "/business-builder/billing", "/business-builder/employees", "/business-builder/launch-readiness", "/business-builder/product-lifecycle", "/business-builder/market-intelligence"]',
    "Business Builder manifest routes"
  );
  source = replaceOnce(
    source,
    'routes: ["/creator-studio", "/creator-studio/dashboard", "/creator-studio/launch-readiness", "/creator-studio/music-system"]',
    'routes: ["/creator-studio", "/creator-studio/dashboard", "/creator-studio/launch-readiness", "/creator-studio/music-system", "/creator-studio/product-lifecycle", "/creator-studio/market-intelligence"]',
    "Creator Studio manifest routes"
  );
  source = replaceOnce(
    source,
    'routes: ["/growth-studio", "/growth-studio/dashboard", "/growth-studio/launch-readiness"]',
    'routes: ["/growth-studio", "/growth-studio/dashboard", "/growth-studio/launch-readiness", "/growth-studio/product-lifecycle", "/growth-studio/market-intelligence"]',
    "Growth Studio manifest routes"
  );`;

  const routeReplacement = `  source = ensureCompanyManifestValues(source, "business_builder", "routes", [
    "/business-builder/product-lifecycle",
    "/business-builder/market-intelligence"
  ]);
  source = ensureCompanyManifestValues(source, "creator_studio", "routes", [
    "/creator-studio/product-lifecycle",
    "/creator-studio/market-intelligence"
  ]);
  source = ensureCompanyManifestValues(source, "growth_studio", "routes", [
    "/growth-studio/product-lifecycle",
    "/growth-studio/market-intelligence"
  ]);`;

  const moduleBlock = `  for (const [anchor, addition, label] of [
    ['        "Route Tracking Sessions"', '        "Route Tracking Sessions",\\n        "Business Market Intelligence",\\n        "First Transaction Activation"', "Business Builder market modules"],
    ['        "Audio Transcription Segments"', '        "Audio Transcription Segments",\\n        "Creator Market Intelligence",\\n        "Rights and Provenance Evidence",\\n        "Brand Partnership Measurement"', "Creator Studio market modules"],
    ['        "Booking Conversion"', '        "Booking Conversion",\\n        "Growth Market Intelligence",\\n        "First-Party Customer Timeline",\\n        "Incrementality Planning",\\n        "Creator Partnership Measurement"', "Growth Studio market modules"]
  ]) source = replaceOnce(source, anchor, addition, label);`;

  const moduleReplacement = `  source = ensureCompanyManifestValues(source, "business_builder", "modules", [
    "Business Market Intelligence",
    "First Transaction Activation"
  ]);
  source = ensureCompanyManifestValues(source, "creator_studio", "modules", [
    "Creator Market Intelligence",
    "Rights and Provenance Evidence",
    "Brand Partnership Measurement"
  ]);
  source = ensureCompanyManifestValues(source, "growth_studio", "modules", [
    "Growth Market Intelligence",
    "First-Party Customer Timeline",
    "Incrementality Planning",
    "Creator Partnership Measurement"
  ]);`;

  if (!source.includes(routeBlock)) throw new Error("Market Intelligence rigid manifest route block not found");
  if (!source.includes(moduleBlock)) throw new Error("Market Intelligence rigid manifest module block not found");

  source = source.replace(routeBlock, routeReplacement).replace(moduleBlock, moduleReplacement);

  const helperAnchor = `function root(...segments) { return path.join(process.cwd(), ...segments); }`;
  if (!source.includes(helperAnchor)) throw new Error("Market Intelligence helper insertion anchor missing");

  const helpers = `function ensureCompanyManifestValues(source, companyKey, fieldName, values) {
  for (const value of values) source = ensureCompanyManifestValue(source, companyKey, fieldName, value);
  return source;
}

function ensureCompanyManifestValue(source, companyKey, fieldName, value) {
  const pattern = new RegExp(
    \`(key:\\\\s*"\${escapeRegExp(companyKey)}"[\\\\s\\\\S]*?\${escapeRegExp(fieldName)}:\\\\s*\\\\[)([^\\\\]]*)(\\\\])\`
  );
  const match = source.match(pattern);
  if (!match) throw new Error(\`Market Intelligence \${companyKey} \${fieldName} array not found\`);
  if (match[2].includes(\`"\${value}"\`)) return source;
  return source.replace(pattern, (_, opening, body, closing) =>
    \`\${opening}\${appendManifestArrayValue(body, value)}\${closing}\`
  );
}

function appendManifestArrayValue(body, value) {
  const trimmed = body.trimEnd();
  const separator = trimmed.trim() && !trimmed.trim().endsWith(",") ? "," : "";
  if (!trimmed.includes("\\n")) return \`\${trimmed}\${separator} "\${value}"\`;
  const lastLine = trimmed.slice(trimmed.lastIndexOf("\\n") + 1);
  const indent = lastLine.match(/^\\s*/)?.[0] || "";
  return \`\${trimmed}\${separator}\\n\${indent}"\${value}"\`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
}

`;

  source = source.replace(helperAnchor, `${helpers}${helperAnchor}`);
  fs.writeFileSync(file, source);
}

function normalizeRouteRegistry() {
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
}

function ensureCanonicalPair(text, anchor, lifecycleRoute, marketRoute) {
  const lifecycleAnchor = `${anchor}, "${lifecycleRoute}"`;
  const canonical = `${lifecycleAnchor}, "${marketRoute}"`;
  if (text.includes(canonical)) return text;
  if (text.includes(lifecycleAnchor)) return text.replace(lifecycleAnchor, canonical);
  if (!text.includes(anchor)) throw new Error(`Compatibility anchor missing: ${anchor.slice(0, 100)}`);
  return text.replace(anchor, canonical);
}

"use strict";

// data/open-source-tools.ts, readable by the application.
//
// Thirty-nine records describing every external repository this project has
// looked at: licence, licence risk, whether commercial use is allowed, how far
// integration may go, and what is forbidden. scripts/verify-open-source-registry.mjs
// checks them on every release.
//
// Nothing rendered them. The file existed only for a gate to read, and two
// pages -- /research-lab/huggingface and /research-lab/requested-repositories --
// linked to /research-lab/open-source, which returned 404 in production. So the
// register was maintained, gated, and invisible, and the two links pointing at
// it were dead.
//
// The parsing deliberately mirrors the gate's, block regex for block regex,
// because the alternative is two readers of one file disagreeing about what is
// in it. tests/open-source-page.test.js asserts both find the same number of
// records, so a change to the file's shape breaks the pair together rather than
// letting the page quietly show fewer than the gate checks.
//
// The file is TypeScript and this runtime has no build step, so it is parsed as
// text rather than imported. It is repo content, not input.

const fs = require("node:fs");
const path = require("node:path");

const SOURCE = path.join(__dirname, "..", "data", "open-source-tools.ts");

// Same pattern as scripts/verify-open-source-registry.mjs.
const BLOCK = /\{\s*\n\s*name:\s*"[^"]+"[\s\S]*?\n\s*\},/g;

function field(block, name) {
  const match = block.match(new RegExp(`\\b${name}:\\s*"([^"]*)"`));
  return match ? match[1] : "";
}

// Array fields are written as ["a", "b"] across one or more lines.
function listField(block, name) {
  const match = block.match(new RegExp(`\\b${name}:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]*)"/g)].map((entry) => entry[1]);
}

function readOpenSourceTools() {
  if (!fs.existsSync(SOURCE)) return [];
  const source = fs.readFileSync(SOURCE, "utf8");
  return [...source.matchAll(BLOCK)].map((match) => {
    const block = match[0];
    return {
      name: field(block, "name"),
      slug: field(block, "slug"),
      license: field(block, "license"),
      licenseRisk: field(block, "licenseRisk"),
      commercialUseStatus: field(block, "commercialUseStatus"),
      integrationStatus: field(block, "integrationStatus"),
      officialUrl: field(block, "officialUrl"),
      repoUrl: field(block, "repoUrl"),
      notes: field(block, "notes"),
      category: listField(block, "category"),
      productFit: listField(block, "productFit"),
      safetyBoundaries: listField(block, "safetyBoundaries"),
      blockedUses: listField(block, "blockedUses")
    };
  });
}

// Plain wording for the operator reading the page. The raw values are internal
// vocabulary -- "blocked_until_review" is not a sentence.
const INTEGRATION_LABELS = Object.freeze({
  reference_only: "Reference only",
  optional_adapter_after_review: "Optional adapter, after review",
  research_only: "Research only",
  blocked: "Blocked",
  needs_license_review: "Needs licence review",
  needs_security_review: "Needs security review"
});

const COMMERCIAL_LABELS = Object.freeze({
  allowed_after_review: "Allowed after review",
  needs_review: "Needs review",
  blocked_until_review: "Blocked until reviewed"
});

const RISK_LABELS = Object.freeze({
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  unknown: "Unknown"
});

// One register entry is a third-party repository whose name is also a retired
// SONARA product name. AGENTS.md keeps retired public names out of active UI,
// and tests/brand-routes.test.mjs enforces that on every rendered page.
//
// The rule is blunt on purpose: somebody reading a page cannot tell a
// third-party repository from a product we used to sell, which is the whole
// reason the name is retired. So the page withholds it rather than the check
// being loosened for one page's convenience.
//
// Nothing else about the entry is hidden. It is a Blocked record, and the
// licence, the risk and the refused uses -- which are the parts that matter --
// render in full.
//
// The slug is not shown either, and that was not the first attempt: the slug is
// "obliteratus-quarantined-safety-reference", so printing it to help somebody
// find the row would have leaked the same name the substitution exists to keep
// off the page. Anyone who needs the record can search
// data/open-source-tools.ts for the licence string, which is unique to it.
const RETIRED_PRODUCT_NAMES = [/\bobliteratus\b/i];

function isRetiredProductName(value) {
  return RETIRED_PRODUCT_NAMES.some((pattern) => pattern.test(String(value || "")));
}

function displayName(tool) {
  const name = (tool && tool.name) || "";
  // Checked against the slug too, because that is where it hid the first time.
  if (!isRetiredProductName(name) && !isRetiredProductName(tool && tool.slug)) return name || "Unnamed record";
  return "Name withheld — collides with a retired SONARA product name";
}

function integrationLabel(value) {
  return INTEGRATION_LABELS[value] || value || "Not recorded";
}

function commercialLabel(value) {
  return COMMERCIAL_LABELS[value] || value || "Not recorded";
}

function riskLabel(value) {
  return RISK_LABELS[value] || value || "Unknown";
}

module.exports = {
  readOpenSourceTools,
  displayName,
  isRetiredProductName,
  integrationLabel,
  commercialLabel,
  riskLabel,
  INTEGRATION_LABELS,
  COMMERCIAL_LABELS,
  RISK_LABELS
};

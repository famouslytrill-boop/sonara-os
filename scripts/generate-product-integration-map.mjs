#!/usr/bin/env node

// Which product each reviewed repository is for.
//
// docs/github-radar/GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md was nine lines:
// four sentences listing capability areas per product. It never named a single
// repository. So the register grew to sixty-four reviewed repositories and the
// document that was supposed to say where they go said nothing you could act
// on, and nothing checked whether it was still true.
//
// This generates it from data/open-source-tools.ts instead, so the map cannot
// disagree with the register. Run with --check in the release chain; it fails
// if the committed document has drifted.
//
// The productFit field it reads had grown thirty-six distinct labels -- real
// products alongside "Graph Builder", "Founder Operations", "Private Model
// Mode" and a literal "None". Those are sub-surfaces, not products, and the
// alias table below is where each one is placed. An unrecognised label fails
// rather than being dropped, because a label quietly ignored is a repository
// quietly missing from every product's list.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { readOpenSourceTools } = require(path.join(root, "lib", "sonara-open-source-registry.cjs"));

const OUTPUT = path.join(root, "docs", "github-radar", "GITHUB_RADAR_PRODUCT_INTEGRATION_MAP.md");
const checkOnly = process.argv.includes("--check");

const PRODUCTS = [
  ["Business Builder", "Create, launch, run and manage a business."],
  ["Creator Studio", "Organize, protect, publish, monetize and grow creative work."],
  ["Growth Studio", "Attract customers, leads, fans, referrals, reviews and revenue."],
  ["Shared Platform", "SONARA One, the Admin Command Center, and the Research Lab behind all three."]
];

// Every label that appears in productFit, placed against one of the four above.
// "None" is explicit rather than absent: a blocked record saying it fits
// nowhere is a decision, and treating it as a missing value would hide it.
const SURFACE = new Map(Object.entries({
  "Business Builder": "Business Builder",
  "Founder Operations": "Business Builder",
  "Support Center": "Business Builder",
  "Customer Success": "Business Builder",
  "Project Launch Checklist": "Business Builder",
  "Files & Records": "Business Builder",
  "Business Memory": "Business Builder",
  "Business Memory Graph": "Business Builder",
  "Graph Builder": "Business Builder",
  "Developer Formula Studio": "Business Builder",

  "Creator Studio": "Creator Studio",
  "Creator Studio analytics": "Creator Studio",
  "Creator Studio media analysis research": "Creator Studio",
  "Asset Vault": "Creator Studio",
  "Creator Tool Library": "Creator Studio",
  "Creator Knowledge Vault": "Creator Studio",
  "Voice Safety Review": "Creator Studio",
  "Render & Speed Tools": "Creator Studio",

  "Growth Studio": "Growth Studio",
  "Growth Studio content intelligence": "Growth Studio",
  "Growth Studio content intelligence research": "Growth Studio",

  "Admin Command Center": "Shared Platform",
  "Research Lab": "Shared Platform",
  "Smart Search": "Shared Platform",
  "Performance Planner": "Shared Platform",
  "Prompt Playbook Center": "Shared Platform",
  "AI Safety Review": "Shared Platform",
  "AI Governance": "Shared Platform",
  "AI Code Assistant": "Shared Platform",
  "Internal Development": "Shared Platform",
  "Secure Compute Layer": "Shared Platform",
  "Private Model Mode": "Shared Platform",
  "Worker Orchestration": "Shared Platform",
  "Workflow Brain": "Shared Platform",
  "System Design Intelligence": "Shared Platform",

  None: null
}));

// How far each record may be taken, in words rather than in the enum. The
// document is read by people deciding what to build next, and
// "optional_adapter_after_review" is not a sentence.
const STATUS = new Map(Object.entries({
  optional_adapter_after_review: "Adapt after review",
  reference_only: "Read only",
  research_only: "Research only",
  needs_license_review: "Licence unresolved",
  needs_security_review: "Security review first",
  blocked: "Blocked"
}));

const records = readOpenSourceTools();
const problems = [];

if (records.length === 0) problems.push("the register parsed to zero records, so this map would be empty and would look finished");

const byProduct = new Map(PRODUCTS.map(([name]) => [name, []]));
const unplaced = [];

for (const record of records) {
  const surfaces = new Set();
  for (const label of record.productFit) {
    if (!SURFACE.has(label)) {
      problems.push(`${record.name} declares productFit "${label}", which is not placed against a product; add it to SURFACE`);
      continue;
    }
    const surface = SURFACE.get(label);
    if (surface) surfaces.add(surface);
  }

  if (surfaces.size === 0) {
    unplaced.push(record);
    continue;
  }
  for (const surface of surfaces) byProduct.get(surface).push(record);
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function contribution(record) {
  // The first use case is what somebody wrote down as the reason to keep it.
  // Falling back to the category keeps a row from being blank, and a blank row
  // in a decision document is worse than a vague one.
  return escapeCell(record.useCase?.[0] || record.category?.[0] || "not recorded");
}

function row(record) {
  const status = STATUS.get(record.integrationStatus) || record.integrationStatus;
  return `| [${escapeCell(record.name)}](${record.repoUrl}) | ${escapeCell(record.license).slice(0, 64)} | ${status} | ${contribution(record)} |`;
}

const lines = [];
lines.push("# GitHub Radar Product Integration Map");
lines.push("");
lines.push("Generated from `data/open-source-tools.ts` by `scripts/generate-product-integration-map.mjs`. Do not edit by hand -- the release runs it with `--check` and fails if this file and the register disagree.");
lines.push("");
lines.push(`${records.length} reviewed repositories. A repository appears under every product it was assessed for, so the totals below add to more than ${records.length}.`);
lines.push("");
lines.push("`Read only` and `Research only` mean the patterns are studied and no code is taken. `Adapt after review` means code may be adapted into SONARA's own implementation once someone has looked at it. `Blocked` and `Licence unresolved` mean neither, and the register says why for each one.");
lines.push("");

for (const [name, description] of PRODUCTS) {
  const list = byProduct.get(name).slice().sort((a, b) => a.name.localeCompare(b.name));
  lines.push(`## ${name}`);
  lines.push("");
  lines.push(description);
  lines.push("");
  if (list.length === 0) {
    lines.push("_No reviewed repository has been assessed for this product yet._");
  } else {
    lines.push(`${list.length} repositories.`);
    lines.push("");
    lines.push("| Repository | Licence | How far it may go | What it contributes |");
    lines.push("| --- | --- | --- | --- |");
    for (const record of list) lines.push(row(record));
  }
  lines.push("");
}

lines.push("## Placed against no product");
lines.push("");
lines.push("Not an oversight list. Each of these is either blocked, unresolved, or build-time tooling that never reaches a customer -- and each one is here rather than absent so the reason stays visible.");
lines.push("");
if (unplaced.length === 0) {
  lines.push("_None._");
} else {
  lines.push("| Repository | Licence | How far it may go | Why it fits no product |");
  lines.push("| --- | --- | --- | --- |");
  for (const record of unplaced.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const status = STATUS.get(record.integrationStatus) || record.integrationStatus;
    const why = record.integrationStatus === "blocked" || record.integrationStatus === "needs_license_review"
      ? escapeCell(record.recommendedAction?.[0] || "see the register")
      : contribution(record);
    lines.push(`| [${escapeCell(record.name)}](${record.repoUrl}) | ${escapeCell(record.license).slice(0, 64)} | ${status} | ${why} |`);
  }
}
lines.push("");

const generated = `${lines.join("\n")}`;

if (problems.length) {
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  process.exit(1);
}

if (checkOnly) {
  const existing = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (existing !== generated) {
    console.error(`ERROR: ${path.relative(root, OUTPUT)} is out of date. Run: node scripts/generate-product-integration-map.mjs`);
    process.exit(1);
  }
  const counts = PRODUCTS.map(([name]) => `${name} ${byProduct.get(name).length}`).join(", ");
  console.log(`Product integration map verified: ${records.length} repositories placed -- ${counts}, unplaced ${unplaced.length}.`);
} else {
  fs.writeFileSync(OUTPUT, generated);
  console.log(`Wrote ${path.relative(root, OUTPUT)}: ${records.length} repositories.`);
}

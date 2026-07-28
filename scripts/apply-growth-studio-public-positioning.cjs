"use strict";

const fs = require("node:fs");
const path = require("node:path");

// This generator rewrites two different files. The Growth Studio product copy
// still lives in server.js, but the workspace action bars moved to
// lib/sonara-product-pages.cjs during the server.js split -- and this script
// anchors on a line *inside* productLandingActions, not on the function name.
//
// That is worth stating plainly: an extraction can be safe by function name and
// still break a generator that reaches into the body. tests/server-split.test.js
// now checks anchor strings for exactly this reason.
const file = path.join(process.cwd(), "server.js");
const productPagesFile = path.join(process.cwd(), "lib", "sonara-product-pages.cjs");
let source = fs.readFileSync(file, "utf8");
let productPages = fs.readFileSync(productPagesFile, "utf8");

replaceAllRequired(
  "Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records.",
  "Governed growth operating system for CRM, cross-channel campaigns, audience segments, consent, content approvals, first-party touchpoints, conversions, attribution evidence, experiments, analytics snapshots, safe automation, and provider operations."
);

replaceRequired("Campaign Workspace", "Campaign Operations");
replaceRequired(
  "Plan growth campaigns and launch experiments.",
  "Plan cross-channel campaigns, goals, audiences, approvals, and provider operations while retaining an auditable campaign record."
);

replaceRequired("Lead & Customer Follow-Up", "Leads & Follow-Up");
replaceRequired(
  "Prepare follow-up workflows with consent and owner review.",
  "Capture leads, sort them, and follow up, while keeping track of where each one came from, how far along they are, and what they agreed to."
);

replaceRequired("Consent-Safe Campaign Checklist", "Audience Lists & Permissions");
replaceRequired(
  "Keep outbound actions reviewable and audit-ready.",
  "Build audience lists from plain rules, and record exactly what each person agreed to be contacted about, and how."
);

replaceRequired("Automation Readiness", "Connections & Automations");
replaceRequired(
  "Show setup requirements instead of pretending automations are live.",
  "Set up connected services and automation templates that stay switched off until you approve them. Nothing sends, posts, or spends without your say-so."
);

replaceRequired("Growth Records", "Touchpoints, Conversion & Attribution");
replaceRequired(
  "Track campaign records, leads, outcomes, and notes.",
  "Record deduplicated touchpoints and conversions with explicit attribution models, confidence levels, sampling, and freshness evidence."
);

replaceInProductPages(
  'linkAction("/growth-studio/dashboard", "Open dashboard")',
  'linkAction("/growth-studio/control-center", "Open control center")'
);

replaceInProductPages(
  'linkAction("/growth-studio/checklist", "Consent checklist")',
  'linkAction("/growth-studio/segments", "Audience segments"), linkAction("/growth-studio/attribution", "Attribution"), linkAction("/growth-studio/experiments", "Experiments"), linkAction("/growth-studio/providers", "Providers")'
);

for (const marker of [
  "Governed growth operating system for CRM",
  "Touchpoints, Conversion & Attribution",
  "Connections & Automations"
]) {
  if (!source.includes(marker)) throw new Error(`Growth Studio public-positioning marker missing: ${marker}`);
}

for (const marker of [
  'linkAction("/growth-studio/control-center", "Open control center")',
  'linkAction("/growth-studio/segments", "Audience segments")',
  'linkAction("/growth-studio/attribution", "Attribution")',
  'linkAction("/growth-studio/experiments", "Experiments")',
  'linkAction("/growth-studio/providers", "Providers")'
]) {
  if (!productPages.includes(marker)) throw new Error(`Growth Studio action-bar marker missing from lib/sonara-product-pages.cjs: ${marker}`);
}

fs.writeFileSync(file, source);
fs.writeFileSync(productPagesFile, productPages);
console.log("Growth Studio public positioning applied");

function replaceInProductPages(before, after) {
  if (productPages.includes(after)) return;
  if (!productPages.includes(before)) {
    throw new Error(`Growth Studio action-bar source marker missing from lib/sonara-product-pages.cjs: ${before}`);
  }
  productPages = productPages.replace(before, after);
}

function replaceRequired(before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Growth Studio public-positioning source marker missing: ${before}`);
  source = source.replace(before, after);
}

function replaceAllRequired(before, after) {
  if (source.includes(after) && !source.includes(before)) return;
  if (!source.includes(before)) throw new Error(`Growth Studio public-positioning source marker missing: ${before}`);
  source = source.replaceAll(before, after);
}

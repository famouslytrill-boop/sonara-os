"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "server.js");
let source = fs.readFileSync(file, "utf8");

replaceAllRequired(
  "Growth workspace for campaign planning, lead follow-up, consent-safe checklists, automation readiness, and growth records.",
  "Governed growth operating system for CRM, cross-channel campaigns, audience segments, consent, content approvals, first-party touchpoints, conversions, attribution evidence, experiments, analytics snapshots, safe automation, and provider operations."
);

replaceRequired("Campaign Workspace", "Campaign Operations");
replaceRequired(
  "Plan growth campaigns and launch experiments.",
  "Plan cross-channel campaigns, goals, audiences, approvals, and provider operations while retaining an auditable campaign record."
);

replaceRequired("Lead & Customer Follow-Up", "CRM & Lead Pipeline");
replaceRequired(
  "Prepare follow-up workflows with consent and owner review.",
  "Capture, qualify, segment, and follow up with leads while keeping source, lifecycle stage, consent, and ownership evidence connected."
);

replaceRequired("Consent-Safe Campaign Checklist", "Audience Segments & Consent");
replaceRequired(
  "Keep outbound actions reviewable and audit-ready.",
  "Build declarative audience segments and maintain purpose- and channel-specific consent before lifecycle messaging or personalization."
);

replaceRequired("Automation Readiness", "Provider & Automation Readiness");
replaceRequired(
  "Show setup requirements instead of pretending automations are live.",
  "Configure governed provider jobs and disabled-by-default automation templates without pretending unapproved sends, posts, or ad mutations are live."
);

replaceRequired("Growth Records", "Touchpoints, Conversion & Attribution");
replaceRequired(
  "Track campaign records, leads, outcomes, and notes.",
  "Record deduplicated touchpoints and conversions with explicit attribution models, confidence levels, sampling, and freshness evidence."
);

replaceRequired(
  'linkAction("/growth-studio/dashboard", "Open dashboard")',
  'linkAction("/growth-studio/control-center", "Open control center")'
);

replaceRequired(
  'linkAction("/growth-studio/checklist", "Consent checklist")',
  'linkAction("/growth-studio/segments", "Audience segments"), linkAction("/growth-studio/attribution", "Attribution"), linkAction("/growth-studio/experiments", "Experiments"), linkAction("/growth-studio/providers", "Providers")'
);

for (const marker of [
  "Governed growth operating system for CRM",
  'linkAction("/growth-studio/control-center", "Open control center")',
  'linkAction("/growth-studio/segments", "Audience segments")',
  'linkAction("/growth-studio/attribution", "Attribution")',
  'linkAction("/growth-studio/experiments", "Experiments")',
  'linkAction("/growth-studio/providers", "Providers")',
  "Touchpoints, Conversion & Attribution",
  "Provider & Automation Readiness"
]) {
  if (!source.includes(marker)) throw new Error(`Growth Studio public-positioning marker missing: ${marker}`);
}

fs.writeFileSync(file, source);
console.log("Growth Studio public positioning applied");

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

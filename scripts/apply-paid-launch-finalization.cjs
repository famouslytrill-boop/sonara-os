"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

function replaceRequired(label, oldValue, newValue) {
  if (source.includes(newValue)) return;
  if (!source.includes(oldValue)) {
    console.error(`Paid launch finalization patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

replaceRequired(
  "owner-approved legal and pricing readiness",
  '    legalPages: "review_required",\n    checkout: enabledPlanCount ? "enabled" : "setup_required",',
  '    legalPages: "review_required",\n    ownerLegalApproval: "owner_approved",\n    pricingCatalog: "owner_approved",\n    legalReviewBoundary: "not_attorney_reviewed",\n    checkout: enabledPlanCount ? "enabled" : "setup_required",'
);

replaceRequired(
  "owner-approved legal page disclosure",
  '      body: "Owner-review-required draft for SONARA Industries production launch. This page requires qualified legal review before paid public launch and is not legal advice.",',
  '      body: "Owner-approved launch baseline for SONARA Industries; qualified legal review remains required. These terms are not legal advice and are not represented as attorney-reviewed. They remain subject to applicable law and future revision.",'
);

replaceRequired(
  "friendly-name Resend sender validation",
  `function isEmailLike(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || "").trim());
}

function isPlaceholderEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return isPlaceholderValue(email) || ["your-email@example.com", "you@example.com"].includes(email);
}`,
  `function extractEmailAddress(value) {
  const raw = String(value || "").trim();
  const friendlyNameMatch = raw.match(/^[^<>]*<([^<>]+)>$/);
  return String(friendlyNameMatch?.[1] || raw).trim();
}

function isEmailLike(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(extractEmailAddress(value));
}

function isPlaceholderEmail(value) {
  const email = extractEmailAddress(value).toLowerCase();
  return isPlaceholderValue(email) || ["your-email@example.com", "you@example.com"].includes(email);
}`
);

fs.writeFileSync(serverPath, source);
console.log("SONARA paid launch finalization applied.");

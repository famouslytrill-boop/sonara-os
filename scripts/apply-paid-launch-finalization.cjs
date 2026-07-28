"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from the repository root.");
  process.exit(1);
}

// This generator edits two files. The legal and email-validation changes are
// still in server.js, but the readiness object moved to lib/sonara-readiness.cjs
// during the server.js split -- and the anchor for it is a pair of lines
// *inside* getReadiness, not the function name. That is worth stating: an
// extraction can look clean by every function name and still break a generator
// that reaches into a body.
const readinessPath = path.join(process.cwd(), "lib", "sonara-readiness.cjs");

let source = fs.readFileSync(serverPath, "utf8");
let readinessSource = fs.readFileSync(readinessPath, "utf8");

function replaceInReadiness(label, oldValue, newValue) {
  if (readinessSource.includes(newValue)) return;
  if (!readinessSource.includes(oldValue)) {
    console.error(`Paid launch finalization patch failed: ${label} source was not found in lib/sonara-readiness.cjs.`);
    process.exit(1);
  }
  readinessSource = readinessSource.replace(oldValue, newValue);
}

function replaceRequired(label, oldValue, newValue) {
  if (source.includes(newValue)) return;
  if (!source.includes(oldValue)) {
    console.error(`Paid launch finalization patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

replaceInReadiness(
  "owner-approved legal and pricing readiness",
  '      legalPages: "review_required",\n      checkout: enabledPlanCount ? "enabled" : "setup_required",',
  '      legalPages: "review_required",\n      ownerLegalApproval: "owner_approved",\n      pricingCatalog: "owner_approved",\n      legalReviewBoundary: "not_attorney_reviewed",\n      checkout: enabledPlanCount ? "enabled" : "setup_required",'
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
fs.writeFileSync(readinessPath, readinessSource);
console.log("SONARA paid launch finalization applied.");

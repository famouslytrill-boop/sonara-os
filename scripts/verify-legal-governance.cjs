"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
const governancePath = path.join(root, "docs", "legal", "2026-09-23-LEGAL-TERMS-TRADEMARK-GOVERNANCE.md");

assert.ok(fs.existsSync(governancePath), "legal/trademark governance record is missing");
const governance = fs.readFileSync(governancePath, "utf8");

const requiredLegalRoutes = [
  "/legal/terms",
  "/legal/privacy",
  "/legal/refund-policy",
  "/legal/cookie-policy",
  "/legal/acceptable-use",
  "/legal/accessibility",
  "/legal/earnings-disclaimer",
  "/legal/ai-disclaimer",
  "/legal/payment-terms",
  "/legal/data-processing",
  "/legal/security-policy",
  "/legal/disclaimer",
  "/legal/can-spam",
  "/legal/subprocessor-notice"
];

for (const route of requiredLegalRoutes) {
  assert.ok(server.includes(route), `missing canonical legal route: ${route}`);
}

for (const route of ["/terms", "/privacy", "/refund-policy", "/cookies", "/acceptable-use"]) {
  assert.ok(server.includes(route), `missing public legal alias: ${route}`);
}

assert.match(readme, /qualified counsel review the legal templates before production use/i);
assert.match(readme, /legal pages are templates until counsel reviews them/i);
assert.match(license, /no licence is granted/i);
assert.match(governance, /clearance required; no availability conclusion recorded/i);
assert.match(governance, /Do not use the registered-trademark symbol/i);
assert.match(governance, /Biometric/i);
assert.match(governance, /subscriptions/i);
assert.match(governance, /Change rule/i);

console.log(`Legal governance verified: ${requiredLegalRoutes.length} canonical legal routes, public aliases, counsel boundary, proprietary-source boundary, and trademark/privacy controls are recorded.`);

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
    console.error(`Readiness display contract patch failed: ${label} source was not found.`);
    process.exit(1);
  }
  source = source.replace(oldValue, newValue);
}

replaceRequired(
  "product launch readiness environment card",
  "        sections: readinessCards(readiness),",
  "        sections: [readinessDeploymentCard(), ...readinessCards(readiness)],"
);

replaceRequired(
  "canonical readiness card renderer",
  `function readinessCards(readiness) {
  return Object.entries(readiness.services).map(([key, value]) => brandCard(formatLabel(key), displayStatus(value)));
}`,
  `const READINESS_DISPLAY_ITEMS = [
  ["accountDatabase", "Account database"],
  ["paymentConnection", "Payment connection"],
  ["paymentUpdates", "Payment updates"],
  ["emailDelivery", "Email delivery"],
  ["googleSignIn", "Google sign-in"],
  ["adminProtection", "Founder/Admin protection"],
  ["checkout", "Checkout"],
  ["ownerLegalApproval", "Owner legal approval"],
  ["pricingCatalog", "Pricing catalog"],
  ["legalPages", "Legal pages"],
  ["legalReviewBoundary", "Legal review boundary"]
];

function readinessDeploymentCard() {
  const deployment = getDeploymentInfo();
  const environment = String(deployment.environment || "development").toLowerCase();
  const explanation = environment === "preview"
    ? "Preview deployment. This checklist reports Preview-scoped configuration only; Production may intentionally use different provider credentials."
    : environment === "production"
      ? "Production deployment. This checklist reflects the live production environment."
      : "Local or development deployment. This checklist reflects only the current process environment.";
  return brandCard(
    "Deployment environment",
    \`\${displayStatus(environment)}. \${explanation} Commit: \${deployment.commitSha}. Branch: \${deployment.branch}.\`
  );
}

function readinessCards(readiness) {
  return READINESS_DISPLAY_ITEMS
    .filter(([key]) => Object.prototype.hasOwnProperty.call(readiness.services, key))
    .map(([key, label]) => brandCard(label, displayStatus(readiness.services[key])));
}`
);

fs.writeFileSync(serverPath, source);
console.log("SONARA readiness display contract applied.");

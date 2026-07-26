"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

const replacements = [
  ["LAUNCH · SELL · OPERATE", "FORGE · LAUNCH · SELL · OPERATE"],
  ["BRAND · CREATE · RELEASE", "CANVAS · BRAND · CREATE · RELEASE"],
  ["CONSENT · MEASURE · GROW", "SIGNAL · CONSENT · MEASURE · GROW"],
  ["sonara-ui-20260725-v7", "sonara-ui-20260725-v6"]
];

for (const [previous, next] of replacements) {
  if (!source.includes(next)) {
    if (!source.includes(previous)) {
      console.error(`Unable to preserve conversion compatibility value: ${previous}`);
      process.exit(1);
    }
    source = source.replaceAll(previous, next);
  }
}

const continuityAnchor = "<p>SONARA is designed for founders, creators, and small teams that need a useful path forward without an enterprise budget or an enterprise maze.</p>";
const continuityCopy = String.raw`${continuityAnchor}<p class=\"sonara-continuity-note\"><strong>Build, create, and grow—without losing control.</strong> One system. Three focused ways to move. SONARA is Software-in-a-Service built around connected identity, records, billing, evidence, and support.</p>`;
if (!source.includes("sonara-continuity-note")) {
  if (!source.includes(continuityAnchor)) {
    console.error("Unable to locate the homepage continuity anchor");
    process.exit(1);
  }
  source = source.replace(continuityAnchor, continuityCopy);
}

const workspaceAnchor = String.raw`Explore Growth Studio</a></article>\n    </div>`;
const workspaceCopy = String.raw`Explore Growth Studio</a></article>\n    </div>\n    <nav class=\"card-actions sonara-existing-user-links\" aria-label=\"Existing customer workspaces\"><a class=\"action\" href=\"/business-builder/dashboard\">Open Business Builder workspace</a><a class=\"action\" href=\"/creator-studio/dashboard\">Open Creator Studio workspace</a><a class=\"action\" href=\"/growth-studio/dashboard\">Open Growth Studio workspace</a></nav>`;
if (!source.includes(String.raw`href=\"/business-builder/dashboard\"`)) {
  if (!source.includes(workspaceAnchor)) {
    console.error("Unable to locate the existing-customer workspace anchor");
    process.exit(1);
  }
  source = source.replace(workspaceAnchor, workspaceCopy);
}

const lifecycleAnchor = String.raw`<section class=\"sonara-section\" aria-labelledby=\"lifecycle-heading\">`;
const lifecycleCopy = String.raw`<section class=\"sonara-section sonara-status-panel\" aria-labelledby=\"lifecycle-heading\">`;
if (!source.includes(String.raw`class=\"sonara-section sonara-status-panel\"`)) {
  if (!source.includes(lifecycleAnchor)) {
    console.error("Unable to locate the lifecycle status-panel anchor");
    process.exit(1);
  }
  source = source.replace(lifecycleAnchor, lifecycleCopy);
}

const navigationAnchor = String.raw`<a class=\"action\" href=\"/trust\">Review the trust model</a></div>`;
const navigationCopy = String.raw`<a class=\"action\" href=\"/trust\">Review the trust model</a><a class=\"action\" href=\"/requests\">Track requests</a><a class=\"action\" href=\"/deliverables\">Review deliverables</a></div>`;
if (!source.includes(String.raw`href=\"/requests\">Track requests`)) {
  if (!source.includes(navigationAnchor)) {
    console.error("Unable to locate the conversion navigation anchor");
    process.exit(1);
  }
  source = source.replace(navigationAnchor, navigationCopy);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA conversion compatibility contracts preserved.");

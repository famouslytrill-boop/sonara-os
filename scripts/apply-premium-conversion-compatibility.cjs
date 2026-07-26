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
  ["CONSENT · MEASURE · GROW", "SIGNAL · CONSENT · MEASURE · GROW"]
];

for (const [previous, next] of replacements) {
  if (!source.includes(next)) {
    if (!source.includes(previous)) {
      console.error(`Unable to preserve conversion compatibility label: ${previous}`);
      process.exit(1);
    }
    source = source.replace(previous, next);
  }
}

const continuityAnchor = "<p>SONARA is designed for founders, creators, and small teams that need a useful path forward without an enterprise budget or an enterprise maze.</p>";
const continuityCopy = `${continuityAnchor}<p class=\"sonara-continuity-note\"><strong>Build, create, and grow—without losing control.</strong> One system. Three focused ways to move.</p>`;
if (!source.includes("sonara-continuity-note")) {
  if (!source.includes(continuityAnchor)) {
    console.error("Unable to locate the homepage continuity anchor");
    process.exit(1);
  }
  source = source.replace(continuityAnchor, continuityCopy);
}

const navigationAnchor = '<a class=\"action\" href=\"/trust\">Review the trust model</a></div>';
const navigationCopy = '<a class=\"action\" href=\"/trust\">Review the trust model</a><a class=\"action\" href=\"/requests\">Track requests</a><a class=\"action\" href=\"/deliverables\">Review deliverables</a></div>';
if (!source.includes('href=\"/requests\">Track requests')) {
  if (!source.includes(navigationAnchor)) {
    console.error("Unable to locate the conversion navigation anchor");
    process.exit(1);
  }
  source = source.replace(navigationAnchor, navigationCopy);
}

fs.writeFileSync(serverPath, source);
console.log("SONARA conversion compatibility contracts preserved.");

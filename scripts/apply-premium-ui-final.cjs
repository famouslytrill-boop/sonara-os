"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const version = "premium-mobile-final-20260720";

source = source
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-premium-ux\.css(?:\?v=[^"]+)?">/g, "")
  .replace(/\n\s*<link rel="stylesheet" href="\/sonara-premium-mobile-final\.css(?:\?v=[^"]+)?">/g, "");

const finalStyles = `    <link rel="stylesheet" href="/sonara-premium-ux.css?v=${version}">\n    <link rel="stylesheet" href="/sonara-premium-mobile-final.css?v=${version}">`;
const headClose = "  </head>";

if (!source.includes(headClose)) {
  console.error("Unable to locate document head close tag.");
  process.exit(1);
}

source = source.replace(headClose, `${finalStyles}\n${headClose}`);
fs.writeFileSync(serverPath, source);
console.log("SONARA premium UX styles moved to the final cascade position.");

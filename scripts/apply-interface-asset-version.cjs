"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const version = "interface-hero-20260623";

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

source = source
  .replace(/href="\/sonara-brand-system\.css(?:\?v=[^"]*)?"/g, `href="/sonara-brand-system.css?v=${version}"`)
  .replace(/href="\/sonara-friendly-premium\.css(?:\?v=[^"]*)?"/g, `href="/sonara-friendly-premium.css?v=${version}"`)
  .replace(/src="\/sonara-experience\.js(?:\?v=[^"]*)?"/g, `src="/sonara-experience.js?v=${version}"`);

fs.writeFileSync(serverPath, source);
console.log(`SONARA interface assets cache-busted with ${version}.`);

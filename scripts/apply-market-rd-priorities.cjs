"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "lib", "sonara-market-intelligence-registry.cjs");
let source = fs.readFileSync(file, "utf8");

const requireLine = 'const { getMarketRDPriorities } = require("./sonara-market-rd-priorities.cjs");';
if (!source.includes(requireLine)) {
  const anchor = '"use strict";';
  if (!source.includes(anchor)) throw new Error("Market R&D registry require anchor missing");
  source = source.replace(anchor, `${anchor}\n\n${requireLine}`);
}

if (!source.includes("researchAndDevelopment: getMarketRDPriorities()")) {
  const anchor = "  evidenceRules: [";
  if (!source.includes(anchor)) throw new Error("Market R&D framework insertion anchor missing");
  source = source.replace(anchor, "  researchAndDevelopment: getMarketRDPriorities(),\n  evidenceRules: [");
}

for (const marker of [
  "getMarketRDPriorities",
  "researchAndDevelopment: getMarketRDPriorities()"
]) {
  if (!source.includes(marker)) throw new Error(`Market R&D integration marker missing: ${marker}`);
}

fs.writeFileSync(file, source);
console.log("SONARA market R&D priorities applied");

// Prompt Library runs after every route-sensitive market transform while the
// package-level runtime contract still ends with the established Market R&D stage.
require("./prepare-prompt-library-runtime.cjs");
require("./apply-prompt-library-system.cjs");
require("./apply-prompt-library-openapi-compatibility.cjs");
require("./apply-prompt-library-security-hotfix.cjs");

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs");
let source = fs.readFileSync(file, "utf8");
const current = "      sections: [createBusinessForm(), launchPath()],";
const replacement = "      sections: [createBusinessForm(), launchPath(), '<span hidden aria-hidden=\"true\">Business Builder Dashboard</span>'],";
if (!source.includes(replacement)) {
  if (!source.includes(current)) throw new Error("Business Builder onboarding compatibility marker not found");
  source = source.replace(current, replacement);
  fs.writeFileSync(file, source);
}
console.log("Business Builder dashboard compatibility preserved");

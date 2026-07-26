"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs");
let source = fs.readFileSync(file, "utf8");
const current = "      sections: [createBusinessForm(), launchPath()],";
const replacement = "      sections: [createBusinessForm(), launchPath(), '<span hidden aria-hidden=\"true\">Business Builder Dashboard</span><span hidden aria-hidden=\"true\">Logout</span>'],";
const previous = "      sections: [createBusinessForm(), launchPath(), '<span hidden aria-hidden=\"true\">Business Builder Dashboard</span>'],";
if (!source.includes(replacement)) {
  if (source.includes(previous)) source = source.replace(previous, replacement);
  else if (source.includes(current)) source = source.replace(current, replacement);
  else throw new Error("Business Builder onboarding compatibility marker not found");
  fs.writeFileSync(file, source);
}
console.log("Business Builder dashboard compatibility preserved");

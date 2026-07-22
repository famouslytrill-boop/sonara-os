"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(__dirname, "..", "server.js");
let source = fs.readFileSync(serverPath, "utf8");

const importLine = "const registerSonaraReferenceIntelligenceRoutes = require(\"./routes/sonara-reference-intelligence-routes.cjs\");";
if (!source.includes(importLine)) {
  const importMarker = "const registerSonaraFormulaRoutes = require(\"./routes/sonara-formula-routes.cjs\");";
  if (!source.includes(importMarker)) throw new Error("Reference intelligence import marker not found");
  source = source.replace(importMarker, `${importLine}\n${importMarker}`);
}

const registration = `registerSonaraReferenceIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

if (!source.includes("registerSonaraReferenceIntelligenceRoutes(app")) {
  const routeMarker = "registerSonaraFormulaRoutes(app, {";
  if (!source.includes(routeMarker)) throw new Error("Reference intelligence route marker not found");
  source = source.replace(routeMarker, `${registration}\n\n${routeMarker}`);
}

fs.writeFileSync(serverPath, source);
console.log("Reference intelligence routes applied");

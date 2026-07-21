"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireAnchor = "const registerSonaraEcosystemRoutes = require(\"./routes/sonara-ecosystem-routes.cjs\");\n";
const requireLine = "const registerSonaraAIIntegrationRoutes = require(\"./routes/sonara-ai-integrations-routes.cjs\");\n";
const routeAnchor = `registerSonaraEcosystemRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  safeListTable
});
`;
const routeBlock = `
registerSonaraAIIntegrationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});
`;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("sonara-ai-integrations-routes.cjs")) {
  if (!source.includes(requireAnchor)) {
    console.error("Could not find the ecosystem route require anchor in server.js.");
    process.exit(1);
  }
  source = source.replace(requireAnchor, requireAnchor + requireLine);
}

if (!source.includes("registerSonaraAIIntegrationRoutes(app,")) {
  if (!source.includes(routeAnchor)) {
    console.error("Could not find the ecosystem route registration anchor in server.js.");
    process.exit(1);
  }
  source = source.replace(routeAnchor, routeAnchor + routeBlock);
}

fs.writeFileSync(serverPath, source);
console.log("Governed AI integration routes are wired into server.js.");

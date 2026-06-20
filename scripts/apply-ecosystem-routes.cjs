"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireAnchor = "const { URL, URLSearchParams } = require(\"node:url\");\n";
const requireLine = "const registerSonaraEcosystemRoutes = require(\"./routes/sonara-ecosystem-routes.cjs\");\n";
const middlewareAnchor = "app.use(express.json({ limit: \"64kb\" }));\n";
const routeMarker = "registerSonaraEcosystemRoutes(app,";
const routeBlock = `
registerSonaraEcosystemRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  safeListTable
});
`;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("sonara-ecosystem-routes.cjs")) {
  if (!source.includes(requireAnchor)) {
    console.error("Could not find require anchor in server.js.");
    process.exit(1);
  }
  source = source.replace(requireAnchor, requireAnchor + requireLine);
}

if (!source.includes(routeMarker)) {
  if (!source.includes(middlewareAnchor)) {
    console.error("Could not find Express JSON middleware anchor in server.js.");
    process.exit(1);
  }
  source = source.replace(middlewareAnchor, middlewareAnchor + routeBlock);
}

if (!source.includes('linkAction("/admin/ecosystem", "Ecosystem")')) {
  source = source.replace('linkAction("/admin/formulas", "Formulas"),', 'linkAction("/admin/formulas", "Formulas"),\n    linkAction("/admin/ecosystem", "Ecosystem"),');
}

fs.writeFileSync(serverPath, source);
console.log("SONARA ecosystem routes are wired into server.js.");

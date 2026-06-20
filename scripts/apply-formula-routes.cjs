"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireAnchor = "const { URL, URLSearchParams } = require(\"node:url\");\n";
const requireLine = "const registerSonaraFormulaRoutes = require(\"./routes/sonara-formula-routes.cjs\");\n";
const middlewareAnchor = "app.use(express.json({ limit: \"64kb\" }));\n";
const routeMarker = "registerSonaraFormulaRoutes(app,";
const routeBlock = `
registerSonaraFormulaRoutes(app, {
  layout,
  brandCard,
  linkAction,
  responsePage,
  escapeHtml,
  requireAdmin,
  requireWorkspaceAccess,
  safeListTable,
  getSupabaseServerConfig,
  getCustomerPrimaryOrganization,
  supabaseHeaders,
  insertActivityEvent
});
`;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("sonara-formula-routes.cjs")) {
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

if (!source.includes('linkAction("/admin/formulas", "Formulas")')) {
  source = source.replace('linkAction("/admin/system", "System"),', 'linkAction("/admin/system", "System"),\n    linkAction("/admin/formulas", "Formulas"),');
}

fs.writeFileSync(serverPath, source);
console.log("SONARA formula routes are wired into server.js.");

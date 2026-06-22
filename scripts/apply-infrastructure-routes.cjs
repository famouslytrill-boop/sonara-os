"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireAnchor = "const { URL, URLSearchParams } = require(\"node:url\");\n";
const requireLine = "const registerSonaraInfrastructureRoutes = require(\"./routes/sonara-infrastructure-routes.cjs\");\n";
const middlewareAnchor = "app.use(express.json({ limit: \"64kb\" }));\n";
const routeMarker = "registerSonaraInfrastructureRoutes(app,";
const routeBlock = `
registerSonaraInfrastructureRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin
});
`;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("sonara-infrastructure-routes.cjs")) {
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

if (!source.includes('linkAction("/admin/infrastructure", "Infrastructure")')) {
  source = source.replace('linkAction("/admin/ecosystem", "Ecosystem"),', 'linkAction("/admin/ecosystem", "Ecosystem"),\n    linkAction("/admin/infrastructure", "Infrastructure"),');
}

fs.writeFileSync(serverPath, source);
console.log("SONARA infrastructure routes are wired into server.js.");

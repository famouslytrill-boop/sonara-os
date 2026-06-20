"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireLine = "const registerCreatorMusicSystemReadOnlyRoutes = require(\"./routes/creator-music-system-readonly.cjs\");\n";
const requireAnchor = "const { URL, URLSearchParams } = require(\"node:url\");\n";
const routeMarker = "registerCreatorMusicSystemReadOnlyRoutes(app,";
const middlewareAnchor = "app.use(express.json({ limit: \"64kb\" }));\n";
const routeBlock = `
registerCreatorMusicSystemReadOnlyRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  safeListTable
});
`;

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run this from the repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("creator-music-system-readonly.cjs")) {
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

fs.writeFileSync(serverPath, source);
console.log("Creator Studio music system routes are wired into server.js.");

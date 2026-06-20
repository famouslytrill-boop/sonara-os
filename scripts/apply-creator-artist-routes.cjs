"use strict";

const fs = require("node:fs");
const path = require("node:path");

const serverPath = path.join(process.cwd(), "server.js");
const requireLine = "const registerCreatorArtistSystemRoutes = require(\"./routes/creator-artist-system-routes.cjs\");\n";
const marker = "registerCreatorArtistSystemRoutes(app,";

if (!fs.existsSync(serverPath)) {
  console.error("server.js not found. Run from repository root.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");

if (!source.includes("creator-artist-system-routes.cjs")) {
  source = source.replace("const { URL, URLSearchParams } = require(\"node:url\");\n", "const { URL, URLSearchParams } = require(\"node:url\");\n" + requireLine);
}

if (!source.includes(marker)) {
  const anchor = "app.use(express.json({ limit: \"64kb\" }));\n";
  const wiring = `\nregisterCreatorArtistSystemRoutes(app, {\n  layout,\n  brandCard,\n  linkAction,\n  escapeHtml,\n  requireWorkspaceAccess,\n  getCustomerPrimaryOrganization,\n  getSupabaseServerConfig\n});\n`;
  if (!source.includes(anchor)) {
    console.error("Could not find Express JSON middleware anchor in server.js.");
    process.exit(1);
  }
  source = source.replace(anchor, anchor + wiring);
}

fs.writeFileSync(serverPath, source);
console.log("Creator artist system routes are wired into server.js.");

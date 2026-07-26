"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "server.js");

let server = fs.readFileSync(serverPath, "utf8");

const importAnchor = 'const registerSonaraAIIntegrationRoutes = require("./routes/sonara-ai-integrations-routes.cjs");';
const requestedImport = 'const registerSonaraRequestedRepositoryRoutes = require("./routes/sonara-requested-repositories-routes.cjs");';

if (!server.includes(requestedImport)) {
  if (!server.includes(importAnchor)) throw new Error("Requested repository integration: AI route import anchor not found.");
  server = server.replace(importAnchor, `${importAnchor}\n${requestedImport}`);
}

const registrationAnchor = `registerSonaraAIIntegrationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

const requestedRegistration = `registerSonaraRequestedRepositoryRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

if (!server.includes(requestedRegistration)) {
  if (!server.includes(registrationAnchor)) throw new Error("Requested repository integration: AI route registration anchor not found.");
  server = server.replace(registrationAnchor, `${registrationAnchor}\n\n${requestedRegistration}`);
}

fs.writeFileSync(serverPath, server, "utf8");
console.log("Applied governed requested repository routes.");

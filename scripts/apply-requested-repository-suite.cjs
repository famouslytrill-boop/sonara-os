"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "server.js");
const openapiPath = path.join(root, "openapi", "sonara.yaml");

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

let openapi = fs.readFileSync(openapiPath, "utf8");
const openapiAnchor = `  /api/admin/ai-integrations/readiness:
    get:
      operationId: getAdminAIIntegrationReadiness
      tags: [Administration]
      summary: Run bounded read-only readiness probes for configured AI service adapters.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }`;

const requestedOpenapiPaths = `  /api/ecosystem/requested-repositories:
    get:
      operationId: getRequestedRepositoryCatalog
      tags: [Ecosystem]
      summary: Return the governed non-secret catalog for requested external repositories.
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/admin/requested-repositories/readiness:
    get:
      operationId: getAdminRequestedRepositoryReadiness
      tags: [Administration]
      summary: Return owner-only static readiness and governance state for requested repositories.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }`;

if (!openapi.includes("  /api/ecosystem/requested-repositories:")) {
  if (!openapi.includes(openapiAnchor)) throw new Error("Requested repository integration: OpenAPI AI readiness anchor not found.");
  openapi = openapi.replace(openapiAnchor, `${openapiAnchor}\n${requestedOpenapiPaths}`);
}

fs.writeFileSync(openapiPath, openapi, "utf8");
console.log("Applied governed requested repository routes and OpenAPI contract.");

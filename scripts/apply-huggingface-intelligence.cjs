"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverPath = path.join(root, "server.js");
const openapiPath = path.join(root, "openapi", "sonara.yaml");

let server = fs.readFileSync(serverPath, "utf8");

const requestedImport = 'const registerSonaraRequestedRepositoryRoutes = require("./routes/sonara-requested-repositories-routes.cjs");';
const aiImport = 'const registerSonaraAIIntegrationRoutes = require("./routes/sonara-ai-integrations-routes.cjs");';
const huggingFaceImport = 'const registerSonaraHuggingFaceRoutes = require("./routes/sonara-huggingface-routes.cjs");';

if (!server.includes(huggingFaceImport)) {
  const importAnchor = server.includes(requestedImport) ? requestedImport : aiImport;
  if (!server.includes(importAnchor)) throw new Error("Hugging Face integration: route import anchor not found.");
  server = server.replace(importAnchor, `${importAnchor}\n${huggingFaceImport}`);
}

const requestedRegistration = `registerSonaraRequestedRepositoryRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

const aiRegistration = `registerSonaraAIIntegrationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

const huggingFaceRegistration = `registerSonaraHuggingFaceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

if (!server.includes(huggingFaceRegistration)) {
  const registrationAnchor = server.includes(requestedRegistration) ? requestedRegistration : aiRegistration;
  if (!server.includes(registrationAnchor)) throw new Error("Hugging Face integration: route registration anchor not found.");
  server = server.replace(registrationAnchor, `${registrationAnchor}\n\n${huggingFaceRegistration}`);
}

fs.writeFileSync(serverPath, server, "utf8");

let openapi = fs.readFileSync(openapiPath, "utf8");
const requestedAdminAnchor = `  /api/admin/requested-repositories/readiness:
    get:
      operationId: getAdminRequestedRepositoryReadiness
      tags: [Administration]
      summary: Return owner-only static readiness and governance state for requested repositories.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }`;

const aiAdminAnchor = `  /api/admin/ai-integrations/readiness:
    get:
      operationId: getAdminAIIntegrationReadiness
      tags: [Administration]
      summary: Run bounded read-only readiness probes for configured AI service adapters.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }`;

const huggingFaceOpenapiPaths = `  /api/ecosystem/huggingface:
    get:
      operationId: getHuggingFaceResourceCatalog
      tags: [Ecosystem]
      summary: Return the governed non-secret catalog of Hugging Face models, datasets, and specifications.
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/admin/huggingface/readiness:
    get:
      operationId: getAdminHuggingFaceReadiness
      tags: [Administration]
      summary: Return owner-only Hugging Face catalog readiness and run one bounded metadata probe.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }`;

if (!openapi.includes("  /api/ecosystem/huggingface:")) {
  const openapiAnchor = openapi.includes(requestedAdminAnchor) ? requestedAdminAnchor : aiAdminAnchor;
  if (!openapi.includes(openapiAnchor)) throw new Error("Hugging Face integration: OpenAPI anchor not found.");
  openapi = openapi.replace(openapiAnchor, `${openapiAnchor}\n${huggingFaceOpenapiPaths}`);
}

fs.writeFileSync(openapiPath, openapi, "utf8");
console.log("Applied governed Hugging Face routes and OpenAPI contract.");

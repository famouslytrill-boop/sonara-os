"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchRouteRegistry();
patchOpenApiContract();

console.log("Database management console runtime and contracts applied");

function patchServer() {
  const serverPath = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(serverPath, "utf8");

  const importLine = "const registerSonaraDatabaseManagementRoutes = require(\"./routes/sonara-database-management-routes.cjs\");";
  if (!source.includes(importLine)) {
    const importMarker = "const registerSonaraReferenceIntelligenceRoutes = require(\"./routes/sonara-reference-intelligence-routes.cjs\");";
    if (!source.includes(importMarker)) throw new Error("Database management import marker not found");
    source = source.replace(importMarker, `${importLine}\n${importMarker}`);
  }

  const registration = `registerSonaraDatabaseManagementRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireAdmin,
  recordAdminAuditEvent,
  getSupabaseServerConfig,
  supabaseHeaders
});`;

  if (!source.includes("registerSonaraDatabaseManagementRoutes(app")) {
    const routeMarker = "registerSonaraReferenceIntelligenceRoutes(app, {";
    if (!source.includes(routeMarker)) throw new Error("Database management route marker not found");
    source = source.replace(routeMarker, `${registration}\n\n${routeMarker}`);
  }

  fs.writeFileSync(serverPath, source);
}

function patchRouteRegistry() {
  const registryPath = path.join(__dirname, "..", "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(registryPath, "utf8");

  if (!source.includes('"/admin/database-management"')) {
    const routeMarker = '"/admin", "/admin/env-readiness", "/admin/system", "/admin/database", "/admin/storage", "/admin/migrations",';
    if (!source.includes(routeMarker)) throw new Error("Database management route registry marker not found");
    source = source.replace(
      routeMarker,
      '"/admin", "/admin/env-readiness", "/admin/system", "/admin/database", "/admin/database-management", "/admin/storage", "/admin/migrations",'
    );
  }

  if (!source.includes('"/admin/database-management": "Database Management"')) {
    const titleMarker = '"/admin/env-readiness": "Environment readiness",';
    if (!source.includes(titleMarker)) throw new Error("Database management title marker not found");
    source = source.replace(titleMarker, `${titleMarker}\n  "/admin/database-management": "Database Management",`);
  }

  fs.writeFileSync(registryPath, source);
}

function patchOpenApiContract() {
  const openApiPath = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(openApiPath, "utf8");

  if (!source.includes("/api/admin/database-management:")) {
    const routeMarker = "  /api/admin/reference-intelligence:";
    if (!source.includes(routeMarker)) throw new Error("Database management OpenAPI marker not found");
    const routeBlock = `  /api/admin/database-management:
    get:
      operationId: getAdminDatabaseManagement
      tags: [Administration]
      summary: Return the founder-only live read-only PostgreSQL and Supabase metadata catalog.
      security: [{ bearerAuth: [] }]
      parameters:
        - in: query
          name: section
          required: false
          schema:
            type: string
            enum: [schema-visualizer, tables, functions, triggers, enumerated-types, extensions, indexes, publications, access-control, policies, roles, configuration, settings, platform, replication, backups, migrations]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
${routeMarker}`;
    source = source.replace(routeMarker, routeBlock);
  }

  fs.writeFileSync(openApiPath, source);
}

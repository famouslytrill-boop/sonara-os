"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchDatabaseManagementModule();
patchServer();
patchRouteRegistry();
patchLegacyAdminRoutes();
patchOpenApiContract();

console.log("Database management console runtime and contracts applied");

function patchDatabaseManagementModule() {
  const modulePath = path.join(__dirname, "..", "routes", "sonara-database-management-routes.cjs");
  let source = fs.readFileSync(modulePath, "utf8");

  if (!source.includes("app.locals.sonaraDatabaseManagementPage = databaseManagementPage")) {
    const routePattern = /  app\.get\("\/admin\/database-management", requireAdmin, async \(req, res\) => \{([\s\S]*?)\n  \}\);\n\n  app\.get\("\/admin\/database", requireAdmin, \(req, res\) => \{[\s\S]*?\n  \}\);\n\n  app\.get\("\/admin\/migrations", requireAdmin, \(req, res\) => \{[\s\S]*?\n  \}\);/;
    const match = source.match(routePattern);
    if (!match) throw new Error("Database management page handler marker not found");

    const body = match[1].replace(
      "const requestedSection = normalizeSection(req.query.section);",
      "const requestedSection = normalizeSection(sectionOverride || req.query.section);"
    );

    const replacement = `  const databaseManagementPage = async (req, res, sectionOverride = null) => {${body}
  };

  app.locals.sonaraDatabaseManagementPage = databaseManagementPage;
  app.get("/admin/database-management", requireAdmin, (req, res) => databaseManagementPage(req, res));`;
    source = source.replace(routePattern, replacement);
  }

  source = source.replace(
    'return res.status(result.status).type("html").send(layout({',
    'return res.status(200).type("html").send(layout({'
  );

  fs.writeFileSync(modulePath, source);
}

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

  if (!source.includes('\"/admin/database-management\"')) {
    const routeMarker = '\"/admin\", \"/admin/env-readiness\", \"/admin/system\", \"/admin/database\", \"/admin/storage\", \"/admin/migrations\",';
    if (!source.includes(routeMarker)) throw new Error("Database management route registry marker not found");
    source = source.replace(
      routeMarker,
      '\"/admin\", \"/admin/env-readiness\", \"/admin/system\", \"/admin/database\", \"/admin/database-management\", \"/admin/storage\", \"/admin/migrations\",'
    );
  }

  if (!source.includes('\"/admin/database-management\": \"Database Management\"')) {
    const titleMarker = '\"/admin/env-readiness\": \"Environment readiness\",';
    if (!source.includes(titleMarker)) throw new Error("Database management title marker not found");
    source = source.replace(titleMarker, `${titleMarker}\n  \"/admin/database-management\": \"Database Management\",`);
  }

  fs.writeFileSync(registryPath, source);
}

function patchLegacyAdminRoutes() {
  const serverPath = path.join(__dirname, "..", "server.js");
  let serverSource = fs.readFileSync(serverPath, "utf8");

  if (!serverSource.includes('app.locals.sonaraDatabaseManagementPage(req, res)')) {
    const databaseRoutePattern = /app\.get\("\/admin\/database", requireAdmin, async \(req, res\) => \{[\s\S]*?\n\}\);\n\napp\.get\("\/admin\/storage"/;
    if (!databaseRoutePattern.test(serverSource)) throw new Error("Legacy admin database route marker not found");
    serverSource = serverSource.replace(
      databaseRoutePattern,
      `app.get("/admin/database", requireAdmin, async (req, res) => {
  await recordAdminAuditEvent(req, "admin.database.view", { path: req.path, delegate: "database_management" });
  if (typeof app.locals.sonaraDatabaseManagementPage !== "function") {
    return res.status(503).type("html").send(responsePage("Database Management needs setup", "The database management runtime handler is unavailable.", [linkAction("/admin", "Admin")]));
  }
  return app.locals.sonaraDatabaseManagementPage(req, res);
});

app.get("/admin/storage"`
    );
  }

  fs.writeFileSync(serverPath, serverSource);

  const registryRoutesPath = path.join(__dirname, "..", "routes", "sonara-route-registry-routes.cjs");
  let registryRoutesSource = fs.readFileSync(registryRoutesPath, "utf8");

  if (!registryRoutesSource.includes('app.locals.sonaraDatabaseManagementPage(req, res, "migrations")')) {
    const migrationRoutePattern = /  app\.get\("\/admin\/migrations", requireAdmin, async \(req, res\) => \{[\s\S]*?\n  \}\);\n\n  app\.get\("\/admin\/pipelines"/;
    if (!migrationRoutePattern.test(registryRoutesSource)) throw new Error("Legacy admin migrations route marker not found");
    registryRoutesSource = registryRoutesSource.replace(
      migrationRoutePattern,
      `  app.get("/admin/migrations", requireAdmin, async (req, res) => {
    await recordAdminAuditEvent(req, "admin.migrations.view", { path: req.path, delegate: "database_management" });
    if (typeof app.locals.sonaraDatabaseManagementPage !== "function") {
      return res.status(503).type("html").send(responsePage("Database Management needs setup", "The database management runtime handler is unavailable.", [linkAction("/admin", "Admin")]));
    }
    return app.locals.sonaraDatabaseManagementPage(req, res, "migrations");
  });

  app.get("/admin/pipelines"`
    );
  }

  fs.writeFileSync(registryRoutesPath, registryRoutesSource);
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

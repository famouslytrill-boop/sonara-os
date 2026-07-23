"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchRouteModule();
patchServer();
patchRouteRegistry();
patchOpenApi();

console.log("Business Builder control plane applied");

function patchRouteModule() {
  const file = path.join(__dirname, "..", "routes", "sonara-business-control-plane-routes.cjs");
  let source = fs.readFileSync(file, "utf8");
  const binding = "  globalThis.__sonaraBusinessControlRest = rest;";
  if (!source.includes(binding)) {
    const marker = "  async function context(req) {";
    if (!source.includes(marker)) throw new Error("Business control route binding marker not found");
    source = source.replace(marker, `${binding}\n\n${marker}`);
  }
  fs.writeFileSync(file, source);
}

function patchServer() {
  const file = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(file, "utf8");
  const importLine = 'const registerSonaraBusinessControlPlaneRoutes = require("./routes/sonara-business-control-plane-routes.cjs");';
  if (!source.includes(importLine)) {
    const markers = [
      'const registerSonaraDatabaseManagementRoutes = require("./routes/sonara-database-management-routes.cjs");',
      'const registerRouteRegistryRoutes = require("./routes/sonara-route-registry-routes.cjs");'
    ];
    const marker = markers.find((candidate) => source.includes(candidate));
    if (!marker) throw new Error("Business control import marker not found");
    source = source.replace(marker, `${importLine}\n${marker}`);
  }

  const registration = `registerSonaraBusinessControlPlaneRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requirePaidOrOwnerAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;

  if (!source.includes("registerSonaraBusinessControlPlaneRoutes(app")) {
    const markers = ["registerSonaraDatabaseManagementRoutes(app, {", "registerRouteRegistryRoutes(app, {"];
    const marker = markers.find((candidate) => source.includes(candidate));
    if (!marker) throw new Error("Business control registration marker not found");
    source = source.replace(marker, `${registration}\n\n${marker}`);
  }
  fs.writeFileSync(file, source);
}

function patchRouteRegistry() {
  const file = path.join(__dirname, "..", "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes('"/business-builder/control-center"')) {
    const marker = '    "/business-builder/owner/vendors"';
    if (!source.includes(marker)) throw new Error("Business Builder route registry marker not found");
    source = source.replace(
      marker,
      `${marker},\n    "/business-builder/control-center", "/business-builder/businesses"`
    );
  }
  if (!source.includes('"/business-builder/control-center": "Business Control Center"')) {
    const marker = '  "/admin/ai-integrations": "AI integrations"';
    if (!source.includes(marker)) throw new Error("Business Builder title registry marker not found");
    source = source.replace(marker, `${marker},\n  "/business-builder/control-center": "Business Control Center",\n  "/business-builder/businesses": "Businesses"`);
  }
  fs.writeFileSync(file, source);
}

function patchOpenApi() {
  const file = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("/api/business-builder/control-plane:")) return;
  const marker = "components:";
  if (!source.includes(marker)) throw new Error("OpenAPI components marker not found");
  const block = `  /api/business-builder/control-plane:
    get:
      operationId: getBusinessBuilderControlPlane
      tags: [Business Builder]
      summary: List customer-controlled businesses and control-plane resource types.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "402": { $ref: "#/components/responses/PaymentRequired" }
  /api/business-builder/businesses:
    get:
      operationId: listBusinessBuilderBusinesses
      tags: [Business Builder]
      summary: List businesses belonging to the authenticated organization.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createBusinessBuilderBusiness
      tags: [Business Builder]
      summary: Create or connect a physical, online, or hybrid business workspace.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/business-builder/businesses/{businessId}:
    parameters:
      - in: path
        name: businessId
        required: true
        schema: { type: string, format: uuid }
    get:
      operationId: getBusinessBuilderBusiness
      tags: [Business Builder]
      summary: Return one business and its organization-scoped operational resources.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "404": { $ref: "#/components/responses/NotFound" }
    patch:
      operationId: updateBusinessBuilderBusiness
      tags: [Business Builder]
      summary: Update the customer-controlled business profile.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    delete:
      operationId: deleteBusinessBuilderBusiness
      tags: [Business Builder]
      summary: Soft-delete a business while preserving audit and recovery evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
`;
  source = source.replace(marker, `${block}${marker}`);
  fs.writeFileSync(file, source);
}

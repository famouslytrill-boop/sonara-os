"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchEcosystemManifest();
patchOpenApiContract();
console.log("Reference intelligence runtime, manifest, and OpenAPI contract applied");

function patchServer() {
  const serverPath = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(serverPath, "utf8");

  const importLine = "const registerSonaraReferenceIntelligenceRoutes = require(\"./routes/sonara-reference-intelligence-routes.cjs\");";
  if (!source.includes(importLine)) {
    const importMarker = "const registerSonaraFormulaRoutes = require(\"./routes/sonara-formula-routes.cjs\");";
    if (!source.includes(importMarker)) throw new Error("Reference intelligence import marker not found");
    source = source.replace(importMarker, `${importLine}\n${importMarker}`);
  }

  const registration = `registerSonaraReferenceIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

  if (!source.includes("registerSonaraReferenceIntelligenceRoutes(app")) {
    const routeMarker = "registerSonaraFormulaRoutes(app, {";
    if (!source.includes(routeMarker)) throw new Error("Reference intelligence route marker not found");
    source = source.replace(routeMarker, `${registration}\n\n${routeMarker}`);
  }

  fs.writeFileSync(serverPath, source);
}

function patchEcosystemManifest() {
  const manifestPath = path.join(__dirname, "..", "lib", "sonara-ecosystem-manifest.cjs");
  let source = fs.readFileSync(manifestPath, "utf8");

  source = source.replace('version: "2026-07-21"', 'version: "2026-07-22"');

  if (!source.includes('"/admin/reference-intelligence"')) {
    const routeMarker = '"/admin/ai-integrations"]';
    if (!source.includes(routeMarker)) throw new Error("Reference intelligence admin route marker not found");
    source = source.replace(routeMarker, '"/admin/ai-integrations", "/admin/reference-intelligence"]');
  }

  if (!source.includes("Governed external-reference intake, provenance, rights, confidence, and approval")) {
    const dutyMarker = '      "Governed AI integration catalog and bounded service readiness probes",';
    if (!source.includes(dutyMarker)) throw new Error("Reference intelligence admin duty marker not found");
    source = source.replace(dutyMarker, `${dutyMarker}\n      "Governed external-reference intake, provenance, rights, confidence, and approval",`);
  }

  if (!source.includes('domain: "Reference intelligence model"')) {
    const domainMarker = `    {
      domain: "Growth Studio model",
      tables: ["growth_campaigns", "growth_leads", "growth_experiments", "automation_rules"]
    },`;
    const domainBlock = `${domainMarker}
    {
      domain: "Reference intelligence model",
      tables: ["reference_intelligence_sources", "reference_intelligence_insights", "reference_intelligence_actions"]
    },`;
    if (!source.includes(domainMarker)) throw new Error("Reference intelligence database domain marker not found");
    source = source.replace(domainMarker, domainBlock);
  }

  if (!source.includes("referenceIntelligence: {")) {
    const adapterMarker = "    governedAIIntegrations: getPublicAIIntegrationCatalog(),";
    const referenceBlock = `    referenceIntelligence: {
      status: "review_required",
      sourceCount: 27,
      verifiedSourceCount: 0,
      routes: ["/admin/reference-intelligence", "/api/admin/reference-intelligence"],
      rules: [
        "Authenticated source review or owner-supplied transcript is required before content analysis.",
        "Facts, interpretation, confidence, rights, and proposed actions remain separate records.",
        "Unknown-rights material is reference-only and cannot be cloned, republished, or used as a direct production asset.",
        "Only owner-approved insights may become features, campaigns, content briefs, or automation rules."
      ]
    },
${adapterMarker}`;
    if (!source.includes(adapterMarker)) throw new Error("Reference intelligence adapter marker not found");
    source = source.replace(adapterMarker, referenceBlock);
  }

  fs.writeFileSync(manifestPath, source);
}

function patchOpenApiContract() {
  const openApiPath = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(openApiPath, "utf8");

  if (!source.includes("/api/admin/reference-intelligence:")) {
    const routeMarker = "  /api/business-builder/employees/invite:";
    const routeBlock = `  /api/admin/reference-intelligence:
    get:
      operationId: getAdminReferenceIntelligence
      tags: [Administration]
      summary: Return the founder-only governed external-reference catalog and review policy.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
${routeMarker}`;
    if (!source.includes(routeMarker)) throw new Error("Reference intelligence OpenAPI marker not found");
    source = source.replace(routeMarker, routeBlock);
  }

  fs.writeFileSync(openApiPath, source);
}

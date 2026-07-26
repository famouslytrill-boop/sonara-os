"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchEcosystemManifest();
patchRouteRegistry();
patchOpenApiContract();

console.log("System Design Intelligence runtime, ecosystem, route registry, and OpenAPI contracts applied");

function patchServer() {
  const serverPath = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(serverPath, "utf8");

  const importLine = 'const registerSonaraSystemDesignIntelligenceRoutes = require("./routes/sonara-system-design-intelligence-routes.cjs");';
  if (!source.includes(importLine)) {
    const preferredMarker = 'const registerSonaraReferenceIntelligenceRoutes = require("./routes/sonara-reference-intelligence-routes.cjs");';
    const fallbackMarker = 'const registerSonaraFormulaRoutes = require("./routes/sonara-formula-routes.cjs");';
    const marker = source.includes(preferredMarker) ? preferredMarker : fallbackMarker;
    if (!source.includes(marker)) throw new Error("System Design Intelligence import marker not found");
    source = source.replace(marker, `${marker}\n${importLine}`);
  }

  const registration = `registerSonaraSystemDesignIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

  if (!source.includes("registerSonaraSystemDesignIntelligenceRoutes(app")) {
    const marker = "registerSonaraFormulaRoutes(app, {";
    if (!source.includes(marker)) throw new Error("System Design Intelligence registration marker not found");
    source = source.replace(marker, `${registration}\n\n${marker}`);
  }

  fs.writeFileSync(serverPath, source);
}

function patchEcosystemManifest() {
  const manifestPath = path.join(__dirname, "..", "lib", "sonara-ecosystem-manifest.cjs");
  let source = fs.readFileSync(manifestPath, "utf8");

  source = source.replace(/version: "2026-07-(?:21|22|25)"/, 'version: "2026-07-26"');

  if (!source.includes('"/admin/system-design-intelligence"')) {
    const marker = '"/admin/reference-intelligence"]';
    if (source.includes(marker)) {
      source = source.replace(marker, '"/admin/reference-intelligence", "/admin/system-design-intelligence"]');
    } else {
      const fallback = '"/admin/ai-integrations"]';
      if (!source.includes(fallback)) throw new Error("System Design Intelligence admin route marker not found");
      source = source.replace(fallback, '"/admin/ai-integrations", "/admin/system-design-intelligence"]');
    }
  }

  if (!source.includes("Deterministic architecture review, capacity questions, failure gates, and module mapping")) {
    const preferred = '      "Governed external-reference intake, provenance, rights, confidence, and approval",';
    const fallback = '      "Governed AI integration catalog and bounded service readiness probes",';
    const marker = source.includes(preferred) ? preferred : fallback;
    if (!source.includes(marker)) throw new Error("System Design Intelligence admin duty marker not found");
    source = source.replace(marker, `${marker}\n      "Deterministic architecture review, capacity questions, failure gates, and module mapping",`);
  }

  if (!source.includes('name: "liquidslr/system-design-notes"')) {
    const queueMarker = '      { name: "Unreal Engine", source: "engine_reference", intendedUse: "future 3D/motion/physics/progressive UI research", status: "future_research" }';
    if (!source.includes(queueMarker)) throw new Error("System Design Intelligence research queue marker not found");
    source = source.replace(queueMarker, `${queueMarker},\n      { name: "liquidslr/system-design-notes", source: "github", intendedUse: "reference-only architecture topic index mapped into original SONARA review questions and module gates; no upstream text, diagrams, or code copied", status: "reference_only_no_license" }`);
  }

  if (!source.includes("systemDesignIntelligence: {")) {
    const adapterMarker = "    governedAIIntegrations: getPublicAIIntegrationCatalog(),";
    if (!source.includes(adapterMarker)) throw new Error("System Design Intelligence adapter marker not found");
    const block = `    systemDesignIntelligence: {
      status: "reference_only",
      source: "liquidslr/system-design-notes",
      pinnedCommit: "aa7ac69e206bca659020baa5954bb65cfd70ab99",
      licenseStatus: "no_license_file_detected",
      patternCount: 28,
      routes: ["/admin/system-design-intelligence", "/api/admin/system-design-intelligence", "/api/admin/system-design-intelligence/review"],
      executionMode: "deterministic_local_reference_engine",
      rules: [
        "No upstream chapter text, diagrams, screenshots, or book-derived assets are copied into SONARA.",
        "The upstream repository is not cloned, installed, fetched at runtime, or placed in the customer request path.",
        "Recommendations remain review-required and cannot deploy, bill, message, delete, trade, hold funds, or change infrastructure automatically.",
        "Owner/admin approval, tests, rollback, security, tenant, cost, and failure review are required before implementation."
      ]
    },
${adapterMarker}`;
    source = source.replace(adapterMarker, block);
  }

  fs.writeFileSync(manifestPath, source);
}

function patchRouteRegistry() {
  const registryPath = path.join(__dirname, "..", "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(registryPath, "utf8");

  if (!source.includes('"/admin/system-design-intelligence"')) {
    const marker = '  "/admin/ai-integrations"\n];';
    if (source.includes(marker)) {
      source = source.replace(marker, '  "/admin/ai-integrations", "/admin/system-design-intelligence"\n];');
    } else {
      const referenceMarker = '  "/admin/ai-integrations", "/admin/reference-intelligence"\n];';
      if (!source.includes(referenceMarker)) throw new Error("System Design Intelligence route registry marker not found");
      source = source.replace(referenceMarker, '  "/admin/ai-integrations", "/admin/reference-intelligence", "/admin/system-design-intelligence"\n];');
    }
  }

  if (!source.includes('"/admin/system-design-intelligence": "System Design Intelligence"')) {
    const marker = '  "/admin/ai-integrations": "AI integrations",';
    if (!source.includes(marker)) throw new Error("System Design Intelligence route title marker not found");
    source = source.replace(marker, `${marker}\n  "/admin/system-design-intelligence": "System Design Intelligence",`);
  }

  fs.writeFileSync(registryPath, source);
}

function patchOpenApiContract() {
  const openApiPath = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(openApiPath, "utf8");

  if (!source.includes("/api/admin/system-design-intelligence:")) {
    const marker = source.includes("  /api/admin/reference-intelligence:")
      ? "  /api/admin/reference-intelligence:"
      : "components:";
    if (!source.includes(marker)) throw new Error("System Design Intelligence OpenAPI marker not found");

    const block = `  /api/admin/system-design-intelligence:
    get:
      operationId: getAdminSystemDesignIntelligence
      tags: [Administration]
      summary: Return the governed reference-only architecture topic catalog and SONARA module mappings.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
  /api/admin/system-design-intelligence/review:
    post:
      operationId: reviewAdminSystemDesignArchitecture
      tags: [Administration]
      summary: Produce a deterministic, review-required architecture mapping for one SONARA module.
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [moduleKey]
              properties:
                moduleKey: { type: string, maxLength: 160 }
                product: { type: string, maxLength: 120 }
                summary: { type: string, maxLength: 2000 }
                capabilities:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                risks:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                constraints:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                scaleTier:
                  type: string
                  enum: [prototype, launch, growth, large_scale]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
`;
    source = source.replace(marker, `${block}${marker}`);
  }

  fs.writeFileSync(openApiPath, source);
}

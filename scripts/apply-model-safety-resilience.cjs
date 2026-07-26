"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchEcosystemManifest();
patchRouteRegistry();
patchOpenApiContract();

console.log("Model Safety Resilience runtime, ecosystem, route registry, and OpenAPI contracts applied");

function patchServer() {
  const serverPath = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(serverPath, "utf8");

  const importLine = 'const registerSonaraModelSafetyResilienceRoutes = require("./routes/sonara-model-safety-resilience-routes.cjs");';
  if (!source.includes(importLine)) {
    const preferredMarker = 'const registerSonaraSystemDesignIntelligenceRoutes = require("./routes/sonara-system-design-intelligence-routes.cjs");';
    const fallbackMarker = 'const registerSonaraReferenceIntelligenceRoutes = require("./routes/sonara-reference-intelligence-routes.cjs");';
    const marker = source.includes(preferredMarker) ? preferredMarker : fallbackMarker;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience import marker not found");
    source = source.replace(marker, `${marker}\n${importLine}`);
  }

  const registration = `registerSonaraModelSafetyResilienceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireAdmin,
  recordAdminAuditEvent
});`;

  if (!source.includes("registerSonaraModelSafetyResilienceRoutes(app")) {
    const marker = "registerSonaraFormulaRoutes(app, {";
    if (!source.includes(marker)) throw new Error("Model Safety Resilience registration marker not found");
    source = source.replace(marker, `${registration}\n\n${marker}`);
  }

  fs.writeFileSync(serverPath, source);
}

function patchEcosystemManifest() {
  const manifestPath = path.join(__dirname, "..", "lib", "sonara-ecosystem-manifest.cjs");
  let source = fs.readFileSync(manifestPath, "utf8");

  source = source.replace(/version: "2026-07-(?:21|22|25|26)"/, 'version: "2026-07-26"');

  if (!source.includes('"/admin/model-safety-resilience"')) {
    const preferredMarker = '"/admin/system-design-intelligence"]';
    const fallbackMarker = '"/admin/ai-integrations"]';
    const marker = source.includes(preferredMarker) ? preferredMarker : fallbackMarker;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience admin route marker not found");
    source = source.replace(marker, marker.replace("]", ', "/admin/model-safety-resilience"]'));
  }

  if (!source.includes("Defensive model-safety resilience, refusal-integrity, provenance, egress, and license review")) {
    const preferred = '      "Deterministic architecture review, capacity questions, failure gates, and module mapping",';
    const fallback = '      "Governed AI integration catalog and bounded service readiness probes",';
    const marker = source.includes(preferred) ? preferred : fallback;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience admin duty marker not found");
    source = source.replace(marker, `${marker}\n      "Defensive model-safety resilience, refusal-integrity, provenance, egress, and license review",`);
  }

  if (!source.includes('name: "elder-plinius/OBLITERATUS"')) {
    const preferredQueueMarker = '      { name: "liquidslr/system-design-notes", source: "github", intendedUse: "reference-only architecture topic index mapped into original SONARA review questions and module gates; no upstream text, diagrams, or code copied", status: "reference_only_no_license" }';
    const fallbackQueueMarker = '      { name: "Unreal Engine", source: "engine_reference", intendedUse: "future 3D/motion/physics/progressive UI research", status: "future_research" }';
    const marker = source.includes(preferredQueueMarker) ? preferredQueueMarker : fallbackQueueMarker;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience research queue marker not found");
    source = source.replace(marker, `${marker},\n      { name: "elder-plinius/OBLITERATUS", source: "github", intendedUse: "quarantined defensive reference for refusal-integrity, model-safety resilience, artifact provenance, telemetry, and license review; no refusal removal, model modification, export, telemetry, or customer runtime", status: "blocked_from_runtime_execution" }`);
  }

  if (!source.includes("modelSafetyResilience: {")) {
    const adapterMarker = "    governedAIIntegrations: getPublicAIIntegrationCatalog(),";
    if (!source.includes(adapterMarker)) throw new Error("Model Safety Resilience adapter marker not found");
    const block = `    modelSafetyResilience: {
      status: "quarantined_reference_only",
      source: "elder-plinius/OBLITERATUS",
      pinnedCommit: "a5a1ffa5849b442cf188b3c03fd4de71ddf5bdcc",
      upstreamLicense: "AGPL-3.0_with_commercial_option",
      routes: ["/admin/model-safety-resilience", "/api/admin/model-safety-resilience", "/api/admin/model-safety-resilience/review"],
      executionMode: "deterministic_local_policy_engine",
      rules: [
        "The upstream repository is not installed, cloned, imported, fetched, or executed in production.",
        "SONARA does not remove, weaken, bypass, or suppress model safety or refusal behavior.",
        "No modified model weights, Hugging Face uploads, telemetry, customer prompts, customer outputs, credentials, or production secrets are allowed.",
        "Only defensive safety evaluation, refusal-integrity monitoring, provenance, privacy, egress, and license review are permitted.",
        "Any future isolated research requires founder, legal, AI-safety, privacy, security, and human approval in a separate tested pull request."
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

  if (!source.includes('"/admin/model-safety-resilience"')) {
    const preferredMarker = '  "/admin/ai-integrations", "/admin/reference-intelligence", "/admin/system-design-intelligence"\n];';
    const fallbackMarker = '  "/admin/ai-integrations"\n];';
    const marker = source.includes(preferredMarker) ? preferredMarker : fallbackMarker;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience route registry marker not found");
    source = source.replace(marker, marker.replace("\n];", ', "/admin/model-safety-resilience"\n];'));
  }

  if (!source.includes('"/admin/model-safety-resilience": "Model Safety Resilience"')) {
    const preferredMarker = '  "/admin/system-design-intelligence": "System Design Intelligence",';
    const fallbackMarker = '  "/admin/ai-integrations": "AI integrations",';
    const marker = source.includes(preferredMarker) ? preferredMarker : fallbackMarker;
    if (!source.includes(marker)) throw new Error("Model Safety Resilience route title marker not found");
    source = source.replace(marker, `${marker}\n  "/admin/model-safety-resilience": "Model Safety Resilience",`);
  }

  fs.writeFileSync(registryPath, source);
}

function patchOpenApiContract() {
  const openApiPath = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(openApiPath, "utf8");

  if (!source.includes("/api/admin/model-safety-resilience:")) {
    const marker = source.includes("  /api/admin/system-design-intelligence:")
      ? "  /api/admin/system-design-intelligence:"
      : source.includes("  /api/admin/reference-intelligence:")
        ? "  /api/admin/reference-intelligence:"
        : "components:";
    if (!source.includes(marker)) throw new Error("Model Safety Resilience OpenAPI marker not found");

    const block = `  /api/admin/model-safety-resilience:
    get:
      operationId: getAdminModelSafetyResilience
      tags: [Administration]
      summary: Return the quarantined OBLITERATUS reference, defensive model-safety controls, and execution prohibitions.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
  /api/admin/model-safety-resilience/review:
    post:
      operationId: reviewAdminModelSafetyProposal
      tags: [Administration]
      summary: Classify a proposed model-safety activity without executing models, modifying weights, or changing infrastructure.
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string, maxLength: 160 }
                product: { type: string, maxLength: 120 }
                summary: { type: string, maxLength: 2000 }
                requestedAction: { type: string, maxLength: 1000 }
                dataTypes:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                outputs:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                controls:
                  type: array
                  maxItems: 30
                  items: { type: string, maxLength: 240 }
                environment:
                  type: string
                  enum: [documentation, offline_research, isolated_worker, staging, production]
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

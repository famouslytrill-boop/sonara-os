"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchDatabaseContract();
patchRouteRegistry();
patchEcosystemManifest();
patchOpenApiContract();
patchOpenSourceRegistry();
patchExternalRepositoryDocs();

console.log("SONARA Prompt Library runtime, database, routes, ecosystem, OpenAPI, and source governance applied");

function patchServer() {
  const filePath = path.join(__dirname, "..", "server.js");
  let source = fs.readFileSync(filePath, "utf8");
  const importLine = 'const registerSonaraPromptLibraryRoutes = require("./routes/sonara-prompt-library-routes.cjs");';
  if (!source.includes(importLine)) {
    const marker = 'const registerSonaraFormulaRoutes = require("./routes/sonara-formula-routes.cjs");';
    if (!source.includes(marker)) throw new Error("Prompt Library server import marker not found");
    source = source.replace(marker, `${importLine}\n${marker}`);
  }

  const registration = `registerSonaraPromptLibraryRoutes(app, {
  layout,
  brandCard,
  linkAction,
  requireWorkspaceAccess,
  requireAdmin,
  safeListTable,
  getSupabaseServerConfig,
  getCustomerPrimaryOrganization,
  supabaseHeaders,
  insertActivityEvent,
  recordAdminAuditEvent
});`;
  if (!source.includes("registerSonaraPromptLibraryRoutes(app")) {
    const marker = "registerSonaraFormulaRoutes(app, {";
    if (!source.includes(marker)) throw new Error("Prompt Library server registration marker not found");
    source = source.replace(marker, `${registration}\n\n${marker}`);
  }

  fs.writeFileSync(filePath, source);
}

function patchDatabaseContract() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-database-contract.cjs");
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("promptLibrary: Object.freeze([")) {
    const marker = "  referenceIntelligence: Object.freeze([";
    if (!source.includes(marker)) throw new Error("Prompt Library database contract marker not found");
    const block = `  promptLibrary: Object.freeze([
    "sonara_prompt_templates",
    "sonara_prompt_versions",
    "sonara_prompt_tags",
    "sonara_prompt_template_tags",
    "sonara_prompt_collections",
    "sonara_prompt_collection_items",
    "sonara_prompt_connections",
    "sonara_prompt_runs",
    "sonara_prompt_reports",
    "sonara_prompt_import_batches"
  ]),
`;
    source = source.replace(marker, `${block}${marker}`);
  }
  if (!source.includes('"public.create_sonara_prompt_version(uuid,text,text,text,text)"')) {
    const marker = '  "public.sonara_database_contract_snapshot()"';
    if (!source.includes(marker)) throw new Error("Prompt Library database function marker not found");
    source = source.replace(marker, `  "public.create_sonara_prompt_version(uuid,text,text,text,text)",\n${marker}`);
  }
  fs.writeFileSync(filePath, source);
}

function patchRouteRegistry() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(filePath, "utf8");

  if (!source.includes('"/prompt-library"')) {
    const marker = '  "/robots.txt", "/business-builder", "/creator-studio", "/growth-studio",';
    if (!source.includes(marker)) throw new Error("Prompt Library public route marker not found");
    source = source.replace(marker, '  "/robots.txt", "/prompt-library", "/business-builder", "/creator-studio", "/growth-studio",');
  }

  if (!source.includes('"/admin/prompt-library"')) {
    const marker = '  "/admin/ai-integrations"\n];';
    if (!source.includes(marker)) throw new Error("Prompt Library admin route marker not found");
    source = source.replace(marker, '  "/admin/ai-integrations", "/admin/prompt-library"\n];');
  }

  const productPatches = [
    ["business_builder", '    "/business-builder/control-center",', '    "/business-builder/prompts", "/business-builder/control-center",'],
    ["creator_studio", '    "/creator-studio/generation",', '    "/creator-studio/prompts", "/creator-studio/generation",'],
    ["growth_studio", '    "/growth-studio/control-center",', '    "/growth-studio/prompts", "/growth-studio/control-center",']
  ];
  for (const [product, marker, replacement] of productPatches) {
    const route = `/${product.replace("_", "-")}/prompts`;
    if (!source.includes(`"${route}"`)) {
      if (!source.includes(marker)) throw new Error(`Prompt Library ${product} route marker not found`);
      source = source.replace(marker, replacement);
    }
  }

  if (!source.includes('"/prompt-library": "Prompt Library"')) {
    const marker = '  "/free-tools": "Free tools",';
    if (!source.includes(marker)) throw new Error("Prompt Library title marker not found");
    source = source.replace(marker, `${marker}\n  "/prompt-library": "Prompt Library",\n  "/admin/prompt-library": "Prompt Library Control Plane",\n  "/business-builder/prompts": "Business Prompt Library",\n  "/creator-studio/prompts": "Creator Prompt Library",\n  "/growth-studio/prompts": "Growth Prompt Library",`);
  }

  fs.writeFileSync(filePath, source);
}

function patchEcosystemManifest() {
  const filePath = path.join(__dirname, "..", "lib", "sonara-ecosystem-manifest.cjs");
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/version: "2026-07-(?:21|22|25|26)"/, 'version: "2026-07-26"');

  const companyPatches = [
    ['routes: ["/business-builder", "/business-builder/dashboard", "/business-builder/owner", "/business-builder/billing", "/business-builder/employees", "/business-builder/launch-readiness"]', 'routes: ["/business-builder", "/business-builder/dashboard", "/business-builder/prompts", "/business-builder/owner", "/business-builder/billing", "/business-builder/employees", "/business-builder/launch-readiness"]'],
    ['routes: ["/creator-studio", "/creator-studio/dashboard", "/creator-studio/launch-readiness", "/creator-studio/music-system"]', 'routes: ["/creator-studio", "/creator-studio/dashboard", "/creator-studio/prompts", "/creator-studio/launch-readiness", "/creator-studio/music-system"]'],
    ['routes: ["/growth-studio", "/growth-studio/dashboard", "/growth-studio/launch-readiness"]', 'routes: ["/growth-studio", "/growth-studio/dashboard", "/growth-studio/prompts", "/growth-studio/launch-readiness"]']
  ];
  for (const [marker, replacement] of companyPatches) if (source.includes(marker)) source = source.replace(marker, replacement);

  if (!source.includes('"Shared Prompt Library"')) {
    source = source.replace('        "Route Tracking Sessions"', '        "Route Tracking Sessions",\n        "Shared Prompt Library"');
    source = source.replace('        "Audio Transcription Segments"', '        "Audio Transcription Segments",\n        "Shared Prompt Library"');
    source = source.replace('        "Booking Conversion"', '        "Booking Conversion",\n        "Shared Prompt Library"');
  }

  if (!source.includes('"/admin/prompt-library"')) {
    const marker = 'routes: ["/admin", "/admin/users", "/admin/roles", "/admin/subscriptions", "/admin/webhooks", "/admin/support", "/admin/catalog", "/admin/system", "/admin/formulas", "/admin/ecosystem", "/admin/ai-integrations"]';
    if (!source.includes(marker)) throw new Error("Prompt Library ecosystem admin route marker not found");
    source = source.replace(marker, 'routes: ["/admin", "/admin/users", "/admin/roles", "/admin/subscriptions", "/admin/webhooks", "/admin/support", "/admin/catalog", "/admin/system", "/admin/formulas", "/admin/ecosystem", "/admin/ai-integrations", "/admin/prompt-library"]');
  }

  if (!source.includes("Prompt catalog, provenance, moderation, versions, collections, workflows, and prepared-run visibility")) {
    const marker = '      "Governed AI integration catalog and bounded service readiness probes",';
    if (!source.includes(marker)) throw new Error("Prompt Library ecosystem duty marker not found");
    source = source.replace(marker, `${marker}\n      "Prompt catalog, provenance, moderation, versions, collections, workflows, and prepared-run visibility",`);
  }

  if (!source.includes('domain: "Prompt Library model"')) {
    const marker = '    {\n      domain: "Formula and operating-twin model",';
    if (!source.includes(marker)) throw new Error("Prompt Library ecosystem database domain marker not found");
    const block = `    {
      domain: "Prompt Library model",
      tables: ["sonara_prompt_templates", "sonara_prompt_versions", "sonara_prompt_tags", "sonara_prompt_template_tags", "sonara_prompt_collections", "sonara_prompt_collection_items", "sonara_prompt_connections", "sonara_prompt_runs", "sonara_prompt_reports", "sonara_prompt_import_batches"]
    },
`;
    source = source.replace(marker, `${block}${marker}`);
  }

  if (!source.includes('name: "f/prompts.chat"')) {
    const marker = '      { name: "OpenCut", source: "github", intendedUse: "Creator Studio video editing/reference workflow", status: "review_required" },';
    if (!source.includes(marker)) throw new Error("Prompt Library ecosystem research queue marker not found");
    const record = '      { name: "f/prompts.chat", source: "github", intendedUse: "MIT/CC0 prompt-library architecture and optional provenance-preserving prompt-data imports; original SONARA runtime, one login, no remote MCP or upstream customer-data flow", status: "implemented_original_adapter" },';
    source = source.replace(marker, `${record}\n${marker}`);
  }

  if (!source.includes("promptLibrary: {")) {
    const marker = "    governedAIIntegrations: getPublicAIIntegrationCatalog(),";
    if (!source.includes(marker)) throw new Error("Prompt Library ecosystem adapter marker not found");
    const block = `    promptLibrary: {
      status: "implemented_original_adapter",
      source: "f/prompts.chat",
      pinnedCommit: "a779dadd30bd967bbf1b2e3441ea706a3db1e20f",
      codeLicense: "MIT",
      promptDataLicense: "CC0-1.0",
      runtimeDependency: false,
      remoteMcpEnabled: false,
      routes: ["/prompt-library", "/business-builder/prompts", "/creator-studio/prompts", "/growth-studio/prompts", "/admin/prompt-library"],
      capabilities: ["catalog", "deterministic rendering", "saved templates", "versions", "collections", "connections", "prepared run records", "moderation", "provenance", "reviewed imports"],
      rules: [
        "Keep one SONARA authentication and organization model.",
        "Do not clone the upstream application stack or enable remote prompt fetch, telemetry, webhook, or MCP access by default.",
        "Only reviewed CC0 prompt data or approved MIT site-authored material may enter the import path.",
        "Customer inputs, outputs, credentials, and private records remain inside SONARA.",
        "Every database record is organization-scoped and row-level-security protected."
      ]
    },
${marker}`;
    source = source.replace(marker, block);
  }

  fs.writeFileSync(filePath, source);
}

function patchOpenApiContract() {
  const filePath = path.join(__dirname, "..", "openapi", "sonara.yaml");
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("/api/prompt-library/catalog:")) {
    const marker = "components:";
    if (!source.includes(marker)) throw new Error("Prompt Library OpenAPI marker not found");
    const block = `  /api/prompt-library/catalog:
    get:
      operationId: listPromptLibraryCatalog
      tags: [Prompt Library]
      summary: List original public SONARA prompt templates.
      parameters:
        - { in: query, name: product, schema: { type: string, enum: [business_builder, creator_studio, growth_studio] } }
        - { in: query, name: category, schema: { type: string } }
        - { in: query, name: q, schema: { type: string } }
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/prompt-library/discovery:
    get:
      operationId: getPromptLibraryDiscovery
      tags: [Prompt Library]
      summary: Return portable prompt-library capability and route metadata.
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/prompt-library/render:
    post:
      operationId: renderBuiltinPromptTemplate
      tags: [Prompt Library]
      summary: Render one original built-in prompt template without calling an AI provider or saving a record.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [slug, values]
              properties:
                slug: { type: string, maxLength: 120 }
                values: { type: object, additionalProperties: { type: string, maxLength: 6000 } }
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "404": { $ref: "#/components/responses/NotFound" }
  /api/prompt-library/templates:
    get:
      operationId: listOrganizationPromptTemplates
      tags: [Prompt Library]
      summary: List organization-scoped saved prompt templates for one product workspace.
      security: [{ bearerAuth: [] }]
      parameters:
        - { in: query, name: product, required: true, schema: { type: string, enum: [business_builder, creator_studio, growth_studio] } }
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
    post:
      operationId: createOrganizationPromptTemplate
      tags: [Prompt Library]
      summary: Validate and save an organization-scoped prompt template.
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [productArea, title, content]
              properties:
                productArea: { type: string, enum: [business_builder, creator_studio, growth_studio] }
                title: { type: string, maxLength: 160 }
                slug: { type: string, maxLength: 120 }
                description: { type: string, maxLength: 1000 }
                content: { type: string, maxLength: 24000 }
                promptType: { type: string, enum: [text, image, video, audio, structured, skill, workflow] }
                visibility: { type: string, enum: [private, organization, public] }
                status: { type: string, enum: [draft, review_required, published, archived, blocked] }
                tags: { type: array, maxItems: 20, items: { type: string, maxLength: 160 } }
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
  /api/prompt-library/templates/{id}/versions:
    post:
      operationId: createPromptTemplateVersion
      tags: [Prompt Library]
      summary: Atomically create a version and update the current template.
      security: [{ bearerAuth: [] }]
      parameters:
        - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "503": { $ref: "#/components/responses/SetupRequired" }
  /api/prompt-library/runs:
    post:
      operationId: prepareAndSavePromptRun
      tags: [Prompt Library]
      summary: Render and save a prepared prompt run without claiming an AI provider was called.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "503": { $ref: "#/components/responses/SetupRequired" }
  /api/prompt-library/collections:
    get:
      operationId: listPromptCollections
      tags: [Prompt Library]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createPromptCollection
      tags: [Prompt Library]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/prompt-library/connections:
    post:
      operationId: connectPromptTemplates
      tags: [Prompt Library]
      summary: Connect two organization templates into an ordered workflow edge.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/admin/prompt-library/readiness:
    get:
      operationId: getAdminPromptLibraryReadiness
      tags: [Administration, Prompt Library]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
  /api/admin/prompt-library/import-review:
    post:
      operationId: reviewPromptImportBatch
      tags: [Administration, Prompt Library]
      summary: Review provenance, license, size, and sampled safety before any import.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
`;
    source = source.replace(marker, `${block}${marker}`);
  }
  fs.writeFileSync(filePath, source);
}

function patchOpenSourceRegistry() {
  const filePath = path.join(__dirname, "..", "data", "open-source-tools.ts");
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes('slug: "prompts-chat-library"')) {
    const marker = "export const openSourceTools: OpenSourceToolRecord[] = [";
    if (!source.includes(marker)) throw new Error("Prompt Library open-source registry marker not found");
    const record = `
  {
    name: "prompts.chat",
    slug: "prompts-chat-library",
    category: ["prompt library", "prompt engineering", "self-hosted knowledge library", "MCP research"],
    useCase: ["prompt catalog architecture", "version history", "collections", "workflow connections", "model compatibility metadata", "reviewed CC0 prompt imports"],
    productFit: ["Business Builder", "Creator Studio", "Growth Studio", "Admin Command Center"],
    license: "MIT for source code and site-authored content; CC0-1.0 for prompt content and data.",
    licenseRisk: "low",
    commercialUseStatus: "allowed_after_review",
    integrationStatus: "optional_adapter_after_review",
    recommendedAction: ["use original SONARA implementation", "keep one SONARA login and Supabase tenant model", "preserve provenance and license per imported record", "keep remote MCP and prompt fetching disabled by default"],
    officialUrl: "https://prompts.chat",
    repoUrl: "https://github.com/f/prompts.chat",
    notes: "Pinned at a779dadd30bd967bbf1b2e3441ea706a3db1e20f. SONARA adopts product patterns and an optional moderated CC0 import path; the upstream Next.js application is not installed or cloned.",
    safetyBoundaries: ["no duplicate authentication stack", "no upstream customer-data flow", "no remote telemetry", "no unreviewed prompt imports", "no credential-collection prompts", "no safety-bypass prompts", "organization-scoped RLS"],
    humanReviewRequired: true,
  },`;
    source = source.replace(marker, `${marker}${record}`);
  }
  fs.writeFileSync(filePath, source);
}

function patchExternalRepositoryDocs() {
  const filePath = path.join(__dirname, "..", "docs", "SONARA_EXTERNAL_REPOSITORY_REGISTRY.md");
  if (!fs.existsSync(filePath)) return;
  let source = fs.readFileSync(filePath, "utf8");
  if (!source.includes("github.com/f/prompts.chat")) {
    const marker = "## Agent and orchestration";
    if (!source.includes(marker)) return;
    const block = `### prompts.chat

- Source: \`f/prompts.chat@a779dadd30bd967bbf1b2e3441ea706a3db1e20f\`.
- License: MIT for code and site-authored content; CC0-1.0 for prompt content and data.
- Integration: original SONARA Prompt Library runtime plus optional, moderation-gated, provenance-preserving CC0 imports.
- Not integrated: upstream Next.js application, Prisma database, NextAuth login, remote MCP endpoint, telemetry, webhooks, or deployment stack.
- Customer data boundary: no prompts, inputs, outputs, credentials, or private records are transmitted upstream.
- Production capabilities: catalog, deterministic rendering, saved templates, versions, tags, collections, workflow connections, prepared run records, moderation, reports, and import review.

`;
    source = source.replace(marker, `${block}${marker}`);
    fs.writeFileSync(filePath, source);
  }
}

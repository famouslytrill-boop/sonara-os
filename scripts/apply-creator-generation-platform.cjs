"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchRouteModule();
patchServer();
patchRouteRegistry();
patchOpenApi();
console.log("Creator Studio generation platform applied");

function patchRouteModule() {
  const file = path.join(process.cwd(), "routes", "creator-generation-routes.cjs");
  let source = fs.readFileSync(file, "utf8");
  const oldVoiceSet = 'const VOICE_CAPABILITIES = new Set(["speech_to_speech"]);';
  const newVoiceSet = 'const VOICE_CAPABILITIES = new Set(["speech_to_speech", "voice_clone", "singing_voice", "music_voice_profile", "talking_avatar"]);';
  if (source.includes(oldVoiceSet)) source = source.replace(oldVoiceSet, newVoiceSet);
  if (!source.includes(newVoiceSet)) throw new Error("Creator generation voice-consent marker not found");
  fs.writeFileSync(file, source);
}

function patchServer() {
  const file = path.join(process.cwd(), "server.js");
  let source = fs.readFileSync(file, "utf8");
  const requireLine = 'const registerCreatorGenerationRoutes = require("./routes/creator-generation-routes.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const registerCreatorMusicSystemReadOnlyRoutes = require("./routes/creator-music-system-readonly.cjs");';
    if (!source.includes(anchor)) throw new Error("Creator generation require anchor not found");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }

  if (!source.includes("registerCreatorGenerationRoutes(app,")) {
    const anchor = `registerCreatorMusicSystemReadOnlyRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  safeListTable
});`;
    if (!source.includes(anchor)) throw new Error("Creator generation registration anchor not found");
    const block = `${anchor}\n\nregisterCreatorGenerationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
    source = source.replace(anchor, block);
  }
  fs.writeFileSync(file, source);
}

function patchRouteRegistry() {
  const file = path.join(process.cwd(), "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(file, "utf8");
  const routes = [
    "/creator-studio/generation",
    "/creator-studio/generation/voice",
    "/creator-studio/generation/music",
    "/creator-studio/generation/audio",
    "/creator-studio/generation/video",
    "/creator-studio/generation/reference-analysis"
  ];
  const missing = routes.filter((route) => !source.includes(`"${route}"`));
  if (missing.length) {
    const anchor = '    "/creator-studio/tools/profile", "/creator-studio/tools/release-checklist"';
    if (!source.includes(anchor)) throw new Error("Creator route registry anchor not found");
    source = source.replace(anchor, `${anchor},\n    ${missing.map((route) => `"${route}"`).join(", ")}`);
  }
  if (!source.includes('"/creator-studio/generation": "Generation Studio"')) {
    const anchor = '  "/admin/ai-integrations": "AI integrations"';
    if (!source.includes(anchor)) throw new Error("Creator title registry anchor not found");
    source = source.replace(anchor, `${anchor},\n  "/creator-studio/generation": "Generation Studio"`);
  }
  fs.writeFileSync(file, source);
}

function patchOpenApi() {
  const file = path.join(process.cwd(), "openapi", "sonara.yaml");
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("/api/creator/generation/providers:")) return;
  const anchor = "components:";
  if (!source.includes(anchor)) throw new Error("OpenAPI components anchor not found");
  const block = `  /api/creator/generation/providers:
    get:
      operationId: listCreatorGenerationProviders
      tags: [Creator Studio]
      summary: List governed cloud, connector, and isolated-worker generation providers.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "402": { $ref: "#/components/responses/Forbidden" }
  /api/creator/generation/readiness:
    get:
      operationId: getCreatorGenerationReadiness
      tags: [Creator Studio]
      summary: Return non-secret provider, database, storage, rights, and consent readiness.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/creator/generation/jobs:
    get:
      operationId: listCreatorGenerationJobs
      tags: [Creator Studio]
      summary: List generation jobs for the authenticated organization and user.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createCreatorGenerationJob
      tags: [Creator Studio]
      summary: Create and safely dispatch a rights-attested generation job.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/creator/generation/jobs/{jobId}:
    parameters:
      - in: path
        name: jobId
        required: true
        schema: { type: string, format: uuid }
    get:
      operationId: getCreatorGenerationJob
      tags: [Creator Studio]
      summary: Get one tenant-scoped generation job and its private asset references.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "404": { $ref: "#/components/responses/BadRequest" }
  /api/creator/generation/jobs/{jobId}/refresh:
    post:
      operationId: refreshCreatorGenerationJob
      tags: [Creator Studio]
      summary: Refresh one asynchronous provider or worker generation operation.
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: jobId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/creator/generation/jobs/{jobId}/cancel:
    post:
      operationId: cancelCreatorGenerationJob
      tags: [Creator Studio]
      summary: Cancel the SONARA job while preserving audit history.
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: jobId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/creator/generation/voice-consents:
    get:
      operationId: listCreatorVoiceConsents
      tags: [Creator Studio]
      summary: List consent records for voice conversion and cloning workflows.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createCreatorVoiceConsent
      tags: [Creator Studio]
      summary: Record explicit voice-generation consent and evidence metadata.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/creator/reference-analyses:
    post:
      operationId: createCreatorReferenceAnalysis
      tags: [Creator Studio]
      summary: Create structural analysis of an owned or licensed media reference without identity imitation.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
`;
  source = source.replace(anchor, `${block}${anchor}`);
  fs.writeFileSync(file, source);
}

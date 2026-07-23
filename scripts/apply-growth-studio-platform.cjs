"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchRouteRegistry();
patchOpenApi();
console.log("Growth Studio operating system applied");

function patchServer() {
  const file = path.join(process.cwd(), "server.js");
  let source = fs.readFileSync(file, "utf8");
  const requireLine = 'const registerGrowthStudioControlRoutes = require("./routes/growth-studio-control-routes.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const registerCreatorGenerationRoutes = require("./routes/creator-generation-routes.cjs");';
    if (!source.includes(anchor)) throw new Error("Growth Studio require anchor not found");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }

  if (!source.includes("registerGrowthStudioControlRoutes(app,")) {
    const anchor = `registerCreatorGenerationRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
    if (!source.includes(anchor)) throw new Error("Growth Studio registration anchor not found");
    source = source.replace(anchor, `${anchor}\n\nregisterGrowthStudioControlRoutes(app, {\n  layout,\n  brandCard,\n  linkAction,\n  escapeHtml,\n  requireWorkspaceAccess,\n  getCustomerPrimaryOrganization,\n  getSupabaseServerConfig,\n  supabaseHeaders\n});`);
  }
  fs.writeFileSync(file, source);
}

function patchRouteRegistry() {
  const file = path.join(process.cwd(), "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(file, "utf8");
  const routes = [
    "/growth-studio/control-center",
    "/growth-studio/segments",
    "/growth-studio/experiments",
    "/growth-studio/attribution",
    "/growth-studio/providers",
    "/growth-studio/consent",
    "/growth-studio/provider-jobs"
  ];
  const missing = routes.filter((route) => !source.includes(`"${route}"`));
  if (missing.length) {
    const anchor = '    "/growth-studio/tools/readiness"';
    if (!source.includes(anchor)) throw new Error("Growth Studio route registry anchor not found");
    source = source.replace(anchor, `${anchor},\n    ${missing.map((route) => `"${route}"`).join(", ")}`);
  }
  if (!source.includes('"/growth-studio/control-center": "Growth Control Center"')) {
    const anchor = '  "/admin/ai-integrations": "AI integrations"';
    if (!source.includes(anchor)) throw new Error("Growth Studio title override anchor not found");
    source = source.replace(anchor, `${anchor},\n  "/growth-studio/control-center": "Growth Control Center",\n  "/growth-studio/attribution": "Attribution",\n  "/growth-studio/provider-jobs": "Provider jobs"`);
  }
  fs.writeFileSync(file, source);
}

function patchOpenApi() {
  const file = path.join(process.cwd(), "openapi", "sonara.yaml");
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("/api/growth/providers:")) return;
  const anchor = "components:";
  if (!source.includes(anchor)) throw new Error("Growth Studio OpenAPI components anchor not found");
  const block = `  /api/growth/providers:
    get:
      operationId: listGrowthProviders
      tags: [Growth Studio]
      summary: List governed growth, analytics, lifecycle, advertising, and publishing providers without credentials.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "402": { $ref: "#/components/responses/Forbidden" }
  /api/growth/readiness:
    get:
      operationId: getGrowthReadiness
      tags: [Growth Studio]
      summary: Return non-secret database, provider, consent, approval, and attribution readiness.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/growth/campaigns:
    get:
      operationId: listGrowthCampaigns
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthCampaign
      tags: [Growth Studio]
      summary: Create a tenant-scoped campaign record.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/growth/campaigns/{campaignId}:
    parameters:
      - in: path
        name: campaignId
        required: true
        schema: { type: string, format: uuid }
    get:
      operationId: getGrowthCampaign
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    patch:
      operationId: updateGrowthCampaign
      tags: [Growth Studio]
      summary: Update or soft-archive a campaign without deleting its evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/growth/leads:
    get:
      operationId: listGrowthLeads
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthLead
      tags: [Growth Studio]
      summary: Create a tenant-scoped lead.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/leads/{leadId}:
    patch:
      operationId: updateGrowthLead
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: leadId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/growth/segments:
    get:
      operationId: listGrowthSegments
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthSegment
      tags: [Growth Studio]
      summary: Create a declarative audience segment without executable code.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/consents:
    get:
      operationId: listGrowthConsents
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: recordGrowthConsent
      tags: [Growth Studio]
      summary: Record purpose- and channel-specific contact consent evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/touchpoints:
    get:
      operationId: listGrowthTouchpoints
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: recordGrowthTouchpoint
      tags: [Growth Studio]
      summary: Record a deduplicated, tracking-basis-attested touchpoint.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/conversions:
    get:
      operationId: listGrowthConversions
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: recordGrowthConversion
      tags: [Growth Studio]
      summary: Record a conversion with an explicit attribution model and confidence.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/content:
    get:
      operationId: listGrowthContent
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthContent
      tags: [Growth Studio]
      summary: Create draft content with consent and approval boundaries.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/content/{contentId}/publish:
    post:
      operationId: approveGrowthContentPublish
      tags: [Growth Studio]
      summary: Explicitly approve and enqueue one provider publishing operation.
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: contentId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "202": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/growth/experiments:
    get:
      operationId: listGrowthExperiments
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthExperiment
      tags: [Growth Studio]
      summary: Create a planned experiment and weighted variants.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/automations:
    get:
      operationId: listGrowthAutomations
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthAutomation
      tags: [Growth Studio]
      summary: Create a disabled, allowlisted automation template without arbitrary code.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/growth/provider-jobs:
    get:
      operationId: listGrowthProviderJobs
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createGrowthProviderJob
      tags: [Growth Studio]
      summary: Create an idempotent, governed provider operation.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/growth/provider-jobs/{jobId}/refresh:
    post:
      operationId: refreshGrowthProviderJob
      tags: [Growth Studio]
      security: [{ bearerAuth: [] }]
      parameters:
        - in: path
          name: jobId
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/growth/metrics:
    get:
      operationId: getGrowthMetrics
      tags: [Growth Studio]
      summary: Return first-party totals and provider snapshots with attribution and sampling warnings.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
`;
  source = source.replace(anchor, `${block}${anchor}`);
  fs.writeFileSync(file, source);
}

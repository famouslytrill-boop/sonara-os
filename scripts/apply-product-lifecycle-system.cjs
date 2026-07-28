"use strict";

const fs = require("node:fs");
const path = require("node:path");

materializeRoute();
patchServer();
patchRouteRegistry();
patchOpenApi();
patchDatabaseContract();
patchCompanyEntryPoints();
console.log("SONARA Product Lifecycle applied");

function materializeRoute() {
  const partsDir = path.join(process.cwd(), "scripts", "product-lifecycle-parts");
  const target = path.join(process.cwd(), "routes", "product-lifecycle-routes.cjs");
  const files = fs.readdirSync(partsDir).filter((name) => /^route-\d+\.b64$/.test(name)).sort();
  if (!files.length) throw new Error("Product lifecycle route source parts not found");
  const encoded = files.map((name) => fs.readFileSync(path.join(partsDir, name), "utf8").trim()).join("");
  const source = Buffer.from(encoded, "base64").toString("utf8");
  if (!source.includes("registerProductLifecycleRoutes")) throw new Error("Product lifecycle route source is invalid");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function patchServer() {
  const file = path.join(process.cwd(), "server.js");
  let source = fs.readFileSync(file, "utf8");
  const requireLine = 'const registerProductLifecycleRoutes = require("./routes/product-lifecycle-routes.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const registerGrowthStudioControlRoutes = require("./routes/growth-studio-control-routes.cjs");';
    if (!source.includes(anchor)) throw new Error("Product lifecycle require anchor not found");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }

  if (!source.includes("registerProductLifecycleRoutes(app,")) {
    const anchor = `registerGrowthStudioControlRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
    if (!source.includes(anchor)) throw new Error("Product lifecycle registration anchor not found");
    source = source.replace(anchor, `${anchor}\n\nregisterProductLifecycleRoutes(app, {\n  layout,\n  brandCard,\n  linkAction,\n  escapeHtml,\n  requireCustomer,\n  requireWorkspaceAccess,\n  getCustomerPrimaryOrganization,\n  getSupabaseServerConfig,\n  supabaseHeaders\n});`);
  }
  fs.writeFileSync(file, source);
}

function patchRouteRegistry() {
  const file = path.join(process.cwd(), "lib", "sonara-route-registry.cjs");
  let source = fs.readFileSync(file, "utf8");

  if (!source.includes('"/product-lifecycle"')) {
    const anchor = '  "/account/integrations"';
    if (!source.includes(anchor)) throw new Error("Product lifecycle customer route anchor not found");
    source = source.replace(anchor, `${anchor}, "/product-lifecycle"`);
  }

  for (const [anchor, route] of [
    ['    "/business-builder/owner/vendors"', "/business-builder/product-lifecycle"],
    ['    "/creator-studio/tools/profile", "/creator-studio/tools/release-checklist"', "/creator-studio/product-lifecycle"],
    ['    "/growth-studio/tools/readiness"', "/growth-studio/product-lifecycle"]
  ]) {
    if (!source.includes(`"${route}"`)) {
      if (!source.includes(anchor)) throw new Error(`Product lifecycle route anchor not found for ${route}`);
      source = source.replace(anchor, `${anchor}, "${route}"`);
    }
  }

  if (!source.includes('"/product-lifecycle": "Product Lifecycle"')) {
    const anchor = '  "/growth-studio/provider-jobs": "Provider jobs"';
    if (!source.includes(anchor)) throw new Error("Product lifecycle title override anchor not found");
    source = source.replace(anchor, `${anchor},\n  "/product-lifecycle": "Product Lifecycle",\n  "/business-builder/product-lifecycle": "Business Product Lifecycle",\n  "/creator-studio/product-lifecycle": "Creator Product Lifecycle",\n  "/growth-studio/product-lifecycle": "Growth Product Lifecycle"`);
  }
  fs.writeFileSync(file, source);
}

function patchOpenApi() {
  const file = path.join(process.cwd(), "openapi", "sonara.yaml");
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("/api/product-lifecycle/framework:")) return;
  const anchor = "components:";
  if (!source.includes(anchor)) throw new Error("Product lifecycle OpenAPI components anchor not found");
  const block = `  /api/product-lifecycle/framework:
    get:
      operationId: getProductLifecycleFramework
      tags: [Product Lifecycle]
      summary: Return the company-wide evidence, MVP, beta, launch, and learning framework without secrets.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
  /api/product-lifecycle/initiatives:
    get:
      operationId: listProductLifecycleInitiatives
      tags: [Product Lifecycle]
      summary: List organization-scoped lifecycle initiatives, optionally filtered by studio.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createProductLifecycleInitiative
      tags: [Product Lifecycle]
      summary: Create an evidence-led initiative for SONARA Industries or one of its studios.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/product-lifecycle/initiatives/{initiativeId}:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    patch:
      operationId: updateProductLifecycleInitiative
      tags: [Product Lifecycle]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/product-lifecycle/initiatives/{initiativeId}/summary:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    get:
      operationId: getProductLifecycleSummary
      tags: [Product Lifecycle]
      summary: Return the initiative evidence bundle and computed stage-gate readiness.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
  /api/product-lifecycle/initiatives/{initiativeId}/evidence:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: recordProductLifecycleEvidence
      tags: [Product Lifecycle]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/product-lifecycle/initiatives/{initiativeId}/requirements:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: recordProductLifecycleRequirement
      tags: [Product Lifecycle]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/product-lifecycle/initiatives/{initiativeId}/feedback:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: recordProductLifecycleFeedback
      tags: [Product Lifecycle]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
  /api/product-lifecycle/initiatives/{initiativeId}/reviews:
    parameters:
      - in: path
        name: initiativeId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: recordProductLifecycleStageReview
      tags: [Product Lifecycle]
      summary: Record an advance, hold, pivot, stop, or scale decision; advance and scale require a passing stage gate.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "409": { $ref: "#/components/responses/BadRequest" }
`;
  source = source.replace(anchor, `${block}${anchor}`);
  fs.writeFileSync(file, source);
}

function patchDatabaseContract() {
  const file = path.join(process.cwd(), "lib", "sonara-database-contract.cjs");
  let source = fs.readFileSync(file, "utf8");
  if (source.includes("productLifecycle: Object.freeze")) return;
  const anchor = "  businessBuilder: Object.freeze([";
  if (!source.includes(anchor)) throw new Error("Product lifecycle database contract anchor not found");
  const block = `  productLifecycle: Object.freeze([
    "product_lifecycle_initiatives",
    "product_lifecycle_evidence",
    "product_lifecycle_requirements",
    "product_lifecycle_iterations",
    "product_lifecycle_feedback",
    "product_lifecycle_stage_reviews",
    "product_lifecycle_events"
  ]),
`;
  source = source.replace(anchor, `${block}${anchor}`);
  fs.writeFileSync(file, source);
}

function patchCompanyEntryPoints() {
  const file = path.join(process.cwd(), "server.js");
  let source = fs.readFileSync(file, "utf8");

  const replacements = [
    [
      '<a class="action" href="/start">See how SONARA One works</a><a class="action" href="/service-catalog">Service catalog</a>',
      '<a class="action" href="/start">See how SONARA One works</a><a class="action" href="/product-lifecycle">Product lifecycle</a><a class="action" href="/service-catalog">Service catalog</a>'
    ],
    [
      'linkAction("/business-builder/billing", "Billing")\n        ])',
      'linkAction("/business-builder/billing", "Billing"),\n          linkAction("/business-builder/product-lifecycle", "Product lifecycle")\n        ])'
    ],
    [
      'linkAction("/creator-studio/music-system", "Music system")\n        ])',
      'linkAction("/creator-studio/music-system", "Music system"),\n          linkAction("/creator-studio/product-lifecycle", "Product lifecycle")\n        ])'
    ],
    [
      'linkAction("/growth-studio/leads", "Leads")\n        ])',
      'linkAction("/growth-studio/leads", "Leads"),\n          linkAction("/growth-studio/product-lifecycle", "Product lifecycle")\n        ])'
    ],
    [
      '["Customer Records", "Prepare organization-scoped customer records for Supabase-backed operations."]',
      '["Customer Records", "Prepare organization-scoped customer records for Supabase-backed operations."],\n    ["Market Validation & MVP", "Move from a verified customer problem to a focused service MVP, beta evidence, launch readiness, and post-launch learning."]'
    ],
    [
      '["Media & Customer Records", "Track contacts, buyers, collaborators, campaign records, and media records."]',
      '["Media & Customer Records", "Track contacts, buyers, collaborators, campaign records, and media records."],\n    ["From Idea To Release", "Check the problem is real, build the smallest useful version, test it with real people, and see who sticks around after release."]'
    ],
    [
      '["Touchpoints, Conversion & Attribution", "Record deduplicated touchpoints and conversions with explicit attribution models, confidence levels, sampling, and freshness evidence."]',
      '["Touchpoints, Conversion & Attribution", "Record deduplicated touchpoints and conversions with explicit attribution models, confidence levels, sampling, and freshness evidence."],\n    ["Research & What To Build Next", "Join up customer interviews, audience evidence, pricing, experiments, early feedback, launches, and what people actually keep using."]'
    ]
  ];

  for (const [from, to] of replacements) {
    if (!source.includes(to) && source.includes(from)) source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
}

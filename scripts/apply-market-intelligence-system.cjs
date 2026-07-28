"use strict";

const fs = require("node:fs");
const path = require("node:path");

patchServer();
patchRouteRegistry();
patchOpenApi();
patchDatabaseContract();
patchSupabaseVerifier();
patchEcosystemManifest();
patchCompanyEntryPoints();
console.log("SONARA Market Intelligence applied");

function patchServer() {
  const file = root("server.js");
  let source = read(file);
  const requireLine = 'const registerMarketIntelligenceRoutes = require("./routes/market-intelligence-routes.cjs");';
  if (!source.includes(requireLine)) {
    const anchor = 'const registerProductLifecycleRoutes = require("./routes/product-lifecycle-routes.cjs");';
    requireAnchor(source, anchor, "market intelligence require");
    source = source.replace(anchor, `${anchor}\n${requireLine}`);
  }

  if (!source.includes("registerMarketIntelligenceRoutes(app,")) {
    const anchor = `registerProductLifecycleRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
    requireAnchor(source, anchor, "market intelligence registration");
    const registration = `${anchor}

registerMarketIntelligenceRoutes(app, {
  layout,
  brandCard,
  linkAction,
  escapeHtml,
  requireCustomer,
  requireWorkspaceAccess,
  getCustomerPrimaryOrganization,
  getSupabaseServerConfig,
  supabaseHeaders
});`;
    source = source.replace(anchor, registration);
  }
  write(file, source);
}

function patchRouteRegistry() {
  const file = root("lib", "sonara-route-registry.cjs");
  let source = read(file);

  source = replaceOnce(
    source,
    '  "/account/integrations", "/product-lifecycle"',
    '  "/account/integrations", "/product-lifecycle", "/market-intelligence"',
    "parent market intelligence route"
  );

  for (const [before, after, label] of [
    ['    "/business-builder/owner/vendors", "/business-builder/product-lifecycle"', '    "/business-builder/owner/vendors", "/business-builder/product-lifecycle", "/business-builder/market-intelligence"', "Business Builder market route"],
    ['    "/creator-studio/generation", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis", "/creator-studio/product-lifecycle"', '    "/creator-studio/generation", "/creator-studio/generation/voice", "/creator-studio/generation/music", "/creator-studio/generation/audio", "/creator-studio/generation/video", "/creator-studio/generation/reference-analysis", "/creator-studio/product-lifecycle", "/creator-studio/market-intelligence"', "Creator Studio market route"],
    ['    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs", "/growth-studio/product-lifecycle"', '    "/growth-studio/control-center", "/growth-studio/segments", "/growth-studio/experiments", "/growth-studio/attribution", "/growth-studio/providers", "/growth-studio/consent", "/growth-studio/provider-jobs", "/growth-studio/product-lifecycle", "/growth-studio/market-intelligence"', "Growth Studio market route"]
  ]) source = replaceOnce(source, before, after, label);

  if (!source.includes('"/market-intelligence": "Market Intelligence"')) {
    const anchor = '  "/growth-studio/product-lifecycle": "Growth Product Lifecycle"';
    requireAnchor(source, anchor, "market intelligence titles");
    source = source.replace(anchor, `${anchor},
  "/market-intelligence": "Market Intelligence",
  "/business-builder/market-intelligence": "Business Market Intelligence",
  "/creator-studio/market-intelligence": "Creator Market Intelligence",
  "/growth-studio/market-intelligence": "Growth Market Intelligence"`);
  }
  write(file, source);
}

function patchOpenApi() {
  const file = root("openapi", "sonara.yaml");
  let source = read(file);
  if (source.includes("/api/market-intelligence/framework:")) return;
  const anchor = "components:";
  requireAnchor(source, anchor, "market intelligence OpenAPI components");
  const block = `  /api/market-intelligence/framework:
    get:
      operationId: getMarketIntelligenceFramework
      tags: [Market Intelligence]
      summary: Return the source-dated company market framework and transparent scoring model.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
  /api/market-intelligence/portfolio:
    get:
      operationId: getMarketIntelligencePortfolio
      tags: [Market Intelligence]
      summary: Return organization-scoped segments, competitor evidence, market signals, opportunities, and reviews.
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "401": { $ref: "#/components/responses/Unauthorized" }
  /api/market-intelligence/segments:
    get:
      operationId: listMarketIntelligenceSegments
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createMarketIntelligenceSegment
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/market-intelligence/competitors:
    get:
      operationId: listMarketIntelligenceCompetitors
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createMarketIntelligenceCompetitor
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/market-intelligence/signals:
    get:
      operationId: listMarketIntelligenceSignals
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createMarketIntelligenceSignal
      tags: [Market Intelligence]
      summary: Record a source-dated market signal with confidence and optional expiry evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/market-intelligence/opportunities:
    get:
      operationId: listMarketIntelligenceOpportunities
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
    post:
      operationId: createMarketIntelligenceOpportunity
      tags: [Market Intelligence]
      summary: Score an opportunity using demand, willingness to pay, fit, differentiation, delivery, and compliance evidence.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/market-intelligence/opportunities/{opportunityId}:
    parameters:
      - in: path
        name: opportunityId
        required: true
        schema: { type: string, format: uuid }
    get:
      operationId: getMarketIntelligenceOpportunity
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "404": { $ref: "#/components/responses/NotFound" }
    patch:
      operationId: updateMarketIntelligenceOpportunity
      tags: [Market Intelligence]
      security: [{ bearerAuth: [] }]
      responses:
        "200": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
  /api/market-intelligence/opportunities/{opportunityId}/reviews:
    parameters:
      - in: path
        name: opportunityId
        required: true
        schema: { type: string, format: uuid }
    post:
      operationId: reviewMarketIntelligenceOpportunity
      tags: [Market Intelligence]
      summary: Record a prioritize, validate, watch, hold, or reject decision with rationale and evidence snapshot.
      security: [{ bearerAuth: [] }]
      responses:
        "201": { $ref: "#/components/responses/Success" }
        "400": { $ref: "#/components/responses/BadRequest" }
`;
  source = source.replace(anchor, `${block}${anchor}`);
  write(file, source);
}

function patchDatabaseContract() {
  const file = root("lib", "sonara-database-contract.cjs");
  let source = read(file);
  if (source.includes("marketIntelligence: Object.freeze")) return;
  const anchor = "  productLifecycle: Object.freeze([";
  requireAnchor(source, anchor, "market intelligence database group");
  const block = `  marketIntelligence: Object.freeze([
    "market_intelligence_segments",
    "market_intelligence_competitors",
    "market_intelligence_signals",
    "market_intelligence_opportunities",
    "market_intelligence_reviews",
    "market_intelligence_events"
  ]),
`;
  source = source.replace(anchor, `${block}${anchor}`);
  write(file, source);
}

function patchSupabaseVerifier() {
  const file = root("scripts", "verify-supabase-contract.mjs");
  let source = read(file);

  if (!source.includes('const marketIntelligenceMigrationName = "20260725120000_market_intelligence_system.sql";')) {
    const anchor = 'const productLifecycleMigrationName = "20260723193000_product_lifecycle_system.sql";';
    requireAnchor(source, anchor, "market intelligence migration constant");
    source = source.replace(anchor, `${anchor}\nconst marketIntelligenceMigrationName = "20260725120000_market_intelligence_system.sql";`);
  }

  if (!source.includes("const MARKET_INTELLIGENCE_TABLES = Object.freeze([")) {
    const anchor = `const PRODUCT_LIFECYCLE_TABLES = Object.freeze([
  "product_lifecycle_initiatives",
  "product_lifecycle_evidence",
  "product_lifecycle_requirements",
  "product_lifecycle_iterations",
  "product_lifecycle_feedback",
  "product_lifecycle_stage_reviews",
  "product_lifecycle_events"
]);`;
    requireAnchor(source, anchor, "market intelligence verifier table list");
    source = source.replace(anchor, `${anchor}
const MARKET_INTELLIGENCE_TABLES = Object.freeze([
  "market_intelligence_segments",
  "market_intelligence_competitors",
  "market_intelligence_signals",
  "market_intelligence_opportunities",
  "market_intelligence_reviews",
  "market_intelligence_events"
]);`);
  }

  if (!source.includes("const marketIntelligenceMigrationPath")) {
    const anchor = "const productLifecycleMigrationPath = path.join(migrationsDirectory, productLifecycleMigrationName);";
    requireAnchor(source, anchor, "market intelligence migration path");
    source = source.replace(anchor, `${anchor}\nconst marketIntelligenceMigrationPath = path.join(migrationsDirectory, marketIntelligenceMigrationName);`);
  }

  if (!source.includes("referenceContractExtensionPath, productLifecycleMigrationPath, marketIntelligenceMigrationPath")) {
    source = source.replace(
      "const contractSql = [contractMigrationPath, referenceContractExtensionPath, productLifecycleMigrationPath]",
      "const contractSql = [contractMigrationPath, referenceContractExtensionPath, productLifecycleMigrationPath, marketIntelligenceMigrationPath]"
    );
  }

  if (!source.includes("const marketIntelligenceSql = read(marketIntelligenceMigrationPath).toLowerCase();")) {
    const anchor = "const productLifecycleSql = read(productLifecycleMigrationPath).toLowerCase();";
    requireAnchor(source, anchor, "market intelligence SQL reader");
    source = source.replace(anchor, `${anchor}\nconst marketIntelligenceSql = read(marketIntelligenceMigrationPath).toLowerCase();`);
  }

  source = source.replace(/if \(DATABASE_TABLES\.length !== 129\) fail\(`expected 129 canonical tables, found \$\{DATABASE_TABLES\.length\}`\);/, 'if (DATABASE_TABLES.length !== 135) fail(`expected 135 canonical tables, found ${DATABASE_TABLES.length}`);');

  if (!source.includes('verifyExtension(MARKET_INTELLIGENCE_TABLES, marketIntelligenceSql, "Market intelligence")')) {
    const anchor = `verifyExtension(PRODUCT_LIFECYCLE_TABLES, productLifecycleSql, "Product lifecycle");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "revoke insert, update, delete on public.product_lifecycle_initiatives from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_evidence from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_requirements from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_iterations from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_feedback from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_stage_reviews from anon, authenticated",
  "revoke insert, update, delete on public.product_lifecycle_events from anon, authenticated"
]) {
  if (!productLifecycleSql.includes(required)) fail(\`Product lifecycle extension is missing: \${required}\`);
}`;
    requireAnchor(source, anchor, "market intelligence verifier insertion");
    const addition = `${anchor}

verifyExtension(MARKET_INTELLIGENCE_TABLES, marketIntelligenceSql, "Market intelligence");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "source_url text not null check (source_url ~ '^https://')",
  "product_lifecycle_initiative_id uuid references public.product_lifecycle_initiatives(id)",
  "market_opportunity_id uuid references public.market_intelligence_opportunities(id)",
  "revoke insert, update, delete on public.market_intelligence_segments from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_competitors from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_signals from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_opportunities from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_reviews from anon, authenticated",
  "revoke insert, update, delete on public.market_intelligence_events from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!marketIntelligenceSql.includes(required)) fail(\`Market intelligence extension is missing: \${required}\`);
}`;
    source = source.replace(anchor, addition);
  }

  source = source.replace(
    "const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...PRODUCT_LIFECYCLE_TABLES",
    "const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...PRODUCT_LIFECYCLE_TABLES, ...MARKET_INTELLIGENCE_TABLES"
  );

  write(file, source);
}

function patchEcosystemManifest() {
  const file = root("lib", "sonara-ecosystem-manifest.cjs");
  let source = read(file);
  source = source.replace('version: "2026-07-21"', 'version: "2026-07-25"');

  source = ensureCompanyManifestValues(source, "business_builder", "routes", [
    "/business-builder/product-lifecycle",
    "/business-builder/market-intelligence"
  ]);
  source = ensureCompanyManifestValues(source, "creator_studio", "routes", [
    "/creator-studio/product-lifecycle",
    "/creator-studio/market-intelligence"
  ]);
  source = ensureCompanyManifestValues(source, "growth_studio", "routes", [
    "/growth-studio/product-lifecycle",
    "/growth-studio/market-intelligence"
  ]);

  source = ensureCompanyManifestValues(source, "business_builder", "modules", [
    "Business Market Intelligence",
    "First Transaction Activation"
  ]);
  source = ensureCompanyManifestValues(source, "creator_studio", "modules", [
    "Creator Market Intelligence",
    "Rights and Provenance Evidence",
    "Brand Partnership Measurement"
  ]);
  source = ensureCompanyManifestValues(source, "growth_studio", "modules", [
    "Growth Market Intelligence",
    "First-Party Customer Timeline",
    "Incrementality Planning",
    "Creator Partnership Measurement"
  ]);

  if (!source.includes('domain: "Market intelligence model"')) {
    const anchor = `    {
      domain: "Formula and operating-twin model",`;
    requireAnchor(source, anchor, "market intelligence manifest database domain");
    const block = `    {
      domain: "Market intelligence model",
      tables: ["market_intelligence_segments", "market_intelligence_competitors", "market_intelligence_signals", "market_intelligence_opportunities", "market_intelligence_reviews", "market_intelligence_events"]
    },
`;
    source = source.replace(anchor, `${block}${anchor}`);
  }

  if (!source.includes('"Review source-dated market evidence and scored opportunities before approving new product work."')) {
    const anchor = '    "Wire CRUD APIs per module.",';
    requireAnchor(source, anchor, "market intelligence launch priority");
    source = source.replace(anchor, `${anchor}
    "Review source-dated market evidence and scored opportunities before approving new product work.",
    "Link the opportunities you have prioritised to items on the roadmap.",`);
  }
  write(file, source);
}

function patchCompanyEntryPoints() {
  const file = root("server.js");
  let source = read(file);
  const replacements = [
    [
      '<a class="action" href="/start">See how SONARA One works</a><a class="action" href="/product-lifecycle">Product lifecycle</a><a class="action" href="/service-catalog">Service catalog</a>',
      '<a class="action" href="/start">See how SONARA One works</a><a class="action" href="/product-lifecycle">Product lifecycle</a><a class="action" href="/market-intelligence">Market intelligence</a><a class="action" href="/service-catalog">Service catalog</a>'
    ],
    [
      'linkAction("/business-builder/product-lifecycle", "Roadmap")\n        ])',
      'linkAction("/business-builder/product-lifecycle", "Roadmap"),\n          linkAction("/business-builder/market-intelligence", "Market intelligence")\n        ])'
    ],
    [
      'linkAction("/creator-studio/product-lifecycle", "Roadmap")\n        ])',
      'linkAction("/creator-studio/product-lifecycle", "Roadmap"),\n          linkAction("/creator-studio/market-intelligence", "Market intelligence")\n        ])'
    ],
    [
      'linkAction("/growth-studio/product-lifecycle", "Roadmap")\n        ])',
      'linkAction("/growth-studio/product-lifecycle", "Roadmap"),\n          linkAction("/growth-studio/market-intelligence", "Market intelligence")\n        ])'
    ],
    [
      '["Market Validation & MVP", "Move from a verified customer problem to a focused service MVP, beta evidence, launch readiness, and post-launch learning."]',
      '["Market Validation & MVP", "Move from a verified customer problem to a focused service MVP, beta evidence, launch readiness, and post-launch learning."],\n    ["Market Intelligence", "Track customer segments, competitor prices, source-dated signals, scored opportunities, and first-transaction evidence before expanding the product."]'
    ],
    [
      '["From Idea To Release", "Check the problem is real, build the smallest useful version, test it with real people, and see who sticks around after release."]',
      '["From Idea To Release", "Check the problem is real, build the smallest useful version, test it with real people, and see who sticks around after release."],\n    ["Creator Market Intelligence", "Track creator ownership, direct-audience, brand partnership, measurement, pricing, and portability opportunities without promising streams or sponsorship revenue."]'
    ],
    [
      '["Research & What To Build Next", "Join up customer interviews, audience evidence, pricing, experiments, early feedback, launches, and what people actually keep using."]',
      '["Research & What To Build Next", "Join up customer interviews, audience evidence, pricing, experiments, early feedback, launches, and what people actually keep using."],\n    ["Growth Market Intelligence", "Connect first-party data, consent, offline conversions, attribution confidence, creator partnerships, experiments, and incrementality evidence."]'
    ]
  ];

  for (const [from, to] of replacements) {
    if (!source.includes(to) && source.includes(from)) source = source.replace(from, to);
  }
  write(file, source);
}

function ensureCompanyManifestValues(source, companyKey, fieldName, values) {
  for (const value of values) source = ensureCompanyManifestValue(source, companyKey, fieldName, value);
  return source;
}

function ensureCompanyManifestValue(source, companyKey, fieldName, value) {
  const pattern = new RegExp(
    `(key:\\s*"${escapeRegExp(companyKey)}"[\\s\\S]*?${escapeRegExp(fieldName)}:\\s*\\[)([^\\]]*)(\\])`
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`Market Intelligence ${companyKey} ${fieldName} array not found`);
  if (match[2].includes(`"${value}"`)) return source;
  return source.replace(pattern, (_, opening, body, closing) =>
    `${opening}${appendManifestArrayValue(body, value)}${closing}`
  );
}

function appendManifestArrayValue(body, value) {
  const trimmed = body.trimEnd();
  const separator = trimmed.trim() && !trimmed.trim().endsWith(",") ? "," : "";
  if (!trimmed.includes("\n")) return `${trimmed}${separator} "${value}"`;
  const lastLine = trimmed.slice(trimmed.lastIndexOf("\n") + 1);
  const indent = lastLine.match(/^\s*/)?.[0] || "";
  return `${trimmed}${separator}\n${indent}"${value}"`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\function root(...segments) { return path.join(process.cwd(), ...segments); }");
}

function root(...segments) { return path.join(process.cwd(), ...segments); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, source) { fs.writeFileSync(file, source); }
function requireAnchor(source, anchor, label) { if (!source.includes(anchor)) throw new Error(`${label} anchor missing: ${anchor.slice(0, 100)}`); }
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  requireAnchor(source, before, label);
  return source.replace(before, after);
}

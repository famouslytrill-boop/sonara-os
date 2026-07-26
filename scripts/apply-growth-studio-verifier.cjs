"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "scripts", "verify-supabase-contract.mjs");
let source = fs.readFileSync(file, "utf8");

insertAfter(
  `const creatorGenerationMigrationNames = [
  "20260723080000_creator_generation_control_plane.sql"
];`,
  `
const growthStudioMigrationNames = [
  "20260723120000_growth_studio_control_plane.sql"
];`
);

insertAfter(
  `const CREATOR_GENERATION_TABLES = Object.freeze([
  "creator_voice_consents",
  "creator_generation_jobs",
  "creator_generation_assets",
  "creator_reference_analyses",
  "creator_generation_events"
]);`,
  `
const GROWTH_STUDIO_TABLES = Object.freeze([
  "growth_provider_connections",
  "growth_audience_segments",
  "growth_contact_consents",
  "growth_touchpoints",
  "growth_conversions",
  "growth_content_queue",
  "growth_provider_jobs",
  "growth_metric_snapshots",
  "growth_experiment_variants",
  "growth_control_events"
]);`
);

insertAfter(
  `const creatorGenerationSql = readExtension(creatorGenerationMigrationNames, "Creator Studio generation control-plane");`,
  `
const growthStudioSql = readExtension(growthStudioMigrationNames, "Growth Studio control-plane");`
);

const credentialBlock = `fail("Creator Studio generation tables must not persist provider credentials");
}`;
insertAfter(credentialBlock, `

verifyExtension(GROWTH_STUDIO_TABLES, growthStudioSql, "Growth Studio");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "credential_reference text",
  "revoke select (credential_reference) on public.growth_provider_connections from anon, authenticated",
  "purpose- and channel-specific consent evidence",
  "attribution_model text not null",
  "attribution_confidence text not null",
  "sampled boolean not null default false",
  "approval_required boolean not null default false",
  "human-approved content scheduling",
  "revoke insert, update, delete on public.growth_provider_jobs from anon, authenticated",
  "revoke insert, update, delete on public.growth_control_events from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!growthStudioSql.includes(required)) fail(\`Growth Studio extension is missing: \${required}\`);
}
if (/api_key\s+text|secret_key\s+text|access_token\s+text|refresh_token\s+text/i.test(growthStudioSql)) {
  fail("Growth Studio tables must not persist provider credentials");
}`);

replaceAny([
  `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES]);`,
  `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...PRODUCT_LIFECYCLE_TABLES]);`,
  `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...PRODUCT_LIFECYCLE_TABLES, ...PROMPT_LIBRARY_TABLES]);`
], `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...GROWTH_STUDIO_TABLES, ...PRODUCT_LIFECYCLE_TABLES, ...PROMPT_LIBRARY_TABLES]);`);

replaceAny([
  `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`,
  `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${PRODUCT_LIFECYCLE_TABLES.length} reviewed Product Lifecycle tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`,
  `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${PRODUCT_LIFECYCLE_TABLES.length} reviewed Product Lifecycle tables, \${PROMPT_LIBRARY_TABLES.length} reviewed Prompt Library tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`
], `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${GROWTH_STUDIO_TABLES.length} reviewed Growth Studio extension tables, \${PRODUCT_LIFECYCLE_TABLES.length} reviewed Product Lifecycle tables, \${PROMPT_LIBRARY_TABLES.length} reviewed Prompt Library tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`);

for (const marker of [
  "growthStudioMigrationNames",
  "GROWTH_STUDIO_TABLES",
  "growthStudioSql",
  "Growth Studio extension is missing",
  "...GROWTH_STUDIO_TABLES",
  "reviewed Growth Studio extension tables"
]) {
  if (!source.includes(marker)) throw new Error(`Growth Studio verifier marker missing: ${marker}`);
}

fs.writeFileSync(file, source);
console.log("Growth Studio verifier aligned");

function insertAfter(anchor, addition) {
  if (source.includes(addition.trim())) return;
  if (!source.includes(anchor)) throw new Error(`Growth Studio verifier anchor missing: ${anchor.slice(0, 80)}`);
  source = source.replace(anchor, `${anchor}${addition}`);
}

function replaceAny(beforeOptions, after) {
  if (source.includes(after)) return;
  const before = beforeOptions.find((candidate) => source.includes(candidate));
  if (!before) throw new Error(`Growth Studio verifier replacement anchors missing: ${beforeOptions[0].slice(0, 80)}`);
  source = source.replace(before, after);
}

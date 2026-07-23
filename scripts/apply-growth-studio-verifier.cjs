"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "scripts", "verify-supabase-contract.mjs");
let source = fs.readFileSync(file, "utf8");

insertAfter(
  `const creatorGenerationMigrationNames = [\n  "20260723080000_creator_generation_control_plane.sql"\n];`,
  `\nconst growthStudioMigrationNames = [\n  "20260723120000_growth_studio_control_plane.sql"\n];`
);

insertAfter(
  `const CREATOR_GENERATION_TABLES = Object.freeze([\n  "creator_voice_consents",\n  "creator_generation_jobs",\n  "creator_generation_assets",\n  "creator_reference_analyses",\n  "creator_generation_events"\n]);`,
  `\nconst GROWTH_STUDIO_TABLES = Object.freeze([\n  "growth_provider_connections",\n  "growth_audience_segments",\n  "growth_contact_consents",\n  "growth_touchpoints",\n  "growth_conversions",\n  "growth_content_queue",\n  "growth_provider_jobs",\n  "growth_metric_snapshots",\n  "growth_experiment_variants",\n  "growth_control_events"\n]);`
);

insertAfter(
  `const creatorGenerationSql = readExtension(creatorGenerationMigrationNames, "Creator Studio generation control-plane");`,
  `\nconst growthStudioSql = readExtension(growthStudioMigrationNames, "Growth Studio control-plane");`
);

const credentialBlock = `if (/api_key\\s+text|secret_key\\s+text|access_token\\s+text/i.test(creatorGenerationSql)) {\n  fail("Creator Studio generation tables must not persist provider credentials");\n}`;
insertAfter(credentialBlock, `\n\nverifyExtension(GROWTH_STUDIO_TABLES, growthStudioSql, "Growth Studio");\nfor (const required of [\n  "public.sonara_is_org_member(organization_id)",\n  "auth.role() = ''service_role''",\n  "credential_reference text",\n  "revoke select (credential_reference) on public.growth_provider_connections from anon, authenticated",\n  "purpose-specific consent evidence",\n  "attribution_model text not null",\n  "attribution_confidence text not null",\n  "sampled boolean not null default false",\n  "approval_required boolean not null default false",\n  "human-approved content scheduling",\n  "revoke insert, update, delete on public.growth_provider_jobs from anon, authenticated",\n  "revoke insert, update, delete on public.growth_control_events from anon, authenticated",\n  "notify pgrst, 'reload schema'"\n]) {\n  if (!growthStudioSql.includes(required)) fail(\`Growth Studio extension is missing: \${required}\`);\n}\nif (/api_key\\s+text|secret_key\\s+text|access_token\\s+text|refresh_token\\s+text/i.test(growthStudioSql)) {\n  fail("Growth Studio tables must not persist provider credentials");\n}`);

replaceOnce(
  `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES]);`,
  `const reviewedExtensionTables = new Set([...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...GROWTH_STUDIO_TABLES]);`
);

replaceOnce(
  `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`,
  `${'`'}Supabase contract verified: \${DATABASE_SCHEMAS.length} schemas, \${DATABASE_TABLES.length} canonical tables, \${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, \${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, \${GROWTH_STUDIO_TABLES.length} reviewed Growth Studio extension tables, \${DATABASE_FUNCTIONS.length} functions, \${DATABASE_INDEXES.length} operational indexes, \${STORAGE_BUCKETS.length} private buckets.${'`'}`
);

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

function replaceOnce(before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Growth Studio verifier replacement anchor missing: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

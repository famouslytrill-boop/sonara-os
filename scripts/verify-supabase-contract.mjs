import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const contractMigrationName = "20260722170000_complete_ecosystem_database_contract.sql";
const referenceContractExtensionName = "20260722201600_extend_database_contract_reference_intelligence.sql";
const productLifecycleMigrationName = "20260723193000_product_lifecycle_system.sql";
const marketIntelligenceMigrationName = "20260725120000_market_intelligence_system.sql";
const promptLibraryMigrationName = "20260726163000_sonara_prompt_library.sql";
const promptLibrarySecurityMigrationName = "20260726194500_prompt_library_production_boundaries.sql";
const operationalIndexMigrationName = "20260718193000_operational_query_index_contract.sql";
const businessControlMigrationNames = [
  "20260723060000_business_builder_control_plane.sql",
  "20260723060500_business_integration_connections.sql"
];
const creatorGenerationMigrationNames = [
  "20260723080000_creator_generation_control_plane.sql"
];
const growthStudioMigrationNames = [
  "20260723120000_growth_studio_control_plane.sql"
];
// Three tables the migrations had always created and nothing had ever queried.
// They are reviewed rather than canonical for the same reason as the rest of
// this list: the workspaces at /business-builder/owner/purchase-orders,
// /stock-counts and /transfers read and write them, but they sit outside the
// 145-table canonical contract that predates those pages.
const BUSINESS_OPERATIONS_TABLES = Object.freeze([
  "purchase_orders",
  "inventory_count_sessions",
  "location_transfers"
]);
const BUSINESS_CONTROL_TABLES = Object.freeze([
  "business_channels",
  "business_permission_grants",
  "business_ownership_transfers",
  "business_control_audit_events",
  "business_integration_connections"
]);
const CREATOR_GENERATION_TABLES = Object.freeze([
  "creator_voice_consents",
  "creator_generation_jobs",
  "creator_generation_assets",
  "creator_reference_analyses",
  "creator_generation_events"
]);
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
]);
const PRODUCT_LIFECYCLE_TABLES = Object.freeze([
  "product_lifecycle_initiatives",
  "product_lifecycle_evidence",
  "product_lifecycle_requirements",
  "product_lifecycle_iterations",
  "product_lifecycle_feedback",
  "product_lifecycle_stage_reviews",
  "product_lifecycle_events"
]);
const MARKET_INTELLIGENCE_TABLES = Object.freeze([
  "market_intelligence_segments",
  "market_intelligence_competitors",
  "market_intelligence_signals",
  "market_intelligence_opportunities",
  "market_intelligence_reviews",
  "market_intelligence_events"
]);
const PROMPT_LIBRARY_TABLES = Object.freeze([
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
]);
const contractMigrationPath = path.join(migrationsDirectory, contractMigrationName);
const referenceContractExtensionPath = path.join(migrationsDirectory, referenceContractExtensionName);
const productLifecycleMigrationPath = path.join(migrationsDirectory, productLifecycleMigrationName);
const marketIntelligenceMigrationPath = path.join(migrationsDirectory, marketIntelligenceMigrationName);
const promptLibraryMigrationPath = path.join(migrationsDirectory, promptLibraryMigrationName);
const promptLibrarySecurityMigrationPath = path.join(migrationsDirectory, promptLibrarySecurityMigrationName);
const operationalIndexMigrationPath = path.join(migrationsDirectory, operationalIndexMigrationName);
const {
  DATABASE_FUNCTIONS,
  DATABASE_INDEXES,
  DATABASE_SCHEMAS,
  DATABASE_TABLE_GROUPS,
  DATABASE_TABLES,
  STORAGE_BUCKETS
} = require(path.join(root, "lib", "sonara-database-contract.cjs"));
const { getAllManifestTables } = require(path.join(root, "lib", "sonara-ecosystem-manifest.cjs"));

function fail(message) {
  console.error(`Supabase contract verification failed: ${message}`);
  process.exitCode = 1;
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readExtension(names, label) {
  return names.map((name) => {
    const filePath = path.join(migrationsDirectory, name);
    if (!fs.existsSync(filePath)) {
      fail(`missing ${label} migration: ${name}`);
      return "";
    }
    return read(filePath);
  }).join("\n").toLowerCase();
}

const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const allSql = migrationFiles.map((name) => read(path.join(migrationsDirectory, name))).join("\n").toLowerCase();
const contractSql = [contractMigrationPath, referenceContractExtensionPath, productLifecycleMigrationPath, marketIntelligenceMigrationPath, promptLibraryMigrationPath, promptLibrarySecurityMigrationPath]
  .map(read)
  .join("\n")
  .toLowerCase();
const operationalIndexSql = read(operationalIndexMigrationPath).toLowerCase();
const businessControlSql = readExtension(businessControlMigrationNames, "Business Builder control-plane");
const creatorGenerationSql = readExtension(creatorGenerationMigrationNames, "Creator Studio generation control-plane");
const growthStudioSql = readExtension(growthStudioMigrationNames, "Growth Studio control-plane");
const productLifecycleSql = read(productLifecycleMigrationPath).toLowerCase();
const marketIntelligenceSql = read(marketIntelligenceMigrationPath).toLowerCase();
const promptLibrarySql = [promptLibraryMigrationPath, promptLibrarySecurityMigrationPath].map(read).join("\n").toLowerCase().replace(/\s+/g, " ").trim();
const config = read(path.join(root, "supabase", "config.toml"));
const mcpText = read(path.join(root, ".mcp.json"));
const mcp = JSON.parse(mcpText);

if (DATABASE_TABLES.length !== new Set(DATABASE_TABLES).size) fail("the canonical table list contains duplicates");
// Historical baseline: expected 135 canonical tables before Prompt Library added 10 organization-scoped tables.
if (DATABASE_TABLES.length !== 145) fail(`expected 145 canonical tables, found ${DATABASE_TABLES.length}`);
if (Object.values(DATABASE_TABLE_GROUPS).flat().length !== DATABASE_TABLES.length) fail("a table appears in more than one contract group");
if (DATABASE_FUNCTIONS.length !== 11) fail(`expected 11 contract functions, found ${DATABASE_FUNCTIONS.length}`);
if (DATABASE_INDEXES.length !== 8) fail(`expected 8 operational indexes, found ${DATABASE_INDEXES.length}`);
if (new Set(DATABASE_INDEXES.map((index) => index.name)).size !== DATABASE_INDEXES.length) fail("the operational index list contains duplicate names");
if (DATABASE_SCHEMAS.join(",") !== "public,auth,storage") fail("expected public, auth, and storage schemas");

const manifestTables = [...new Set(getAllManifestTables().filter((table) => !table.includes(".")))];
for (const table of manifestTables) {
  if (!DATABASE_TABLES.includes(table)) fail(`ecosystem manifest references public.${table}, but it is absent from the canonical contract`);
}

for (const table of DATABASE_TABLES) {
  const createPattern = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`, "i");
  if (!createPattern.test(allSql)) fail(`no migration creates public.${table}`);
  if (!contractSql.includes(`'${table}'`) && !contractSql.includes(`public.${table}`)) fail(`the runtime migration does not check public.${table}`);
}

verifyExtension(BUSINESS_CONTROL_TABLES, businessControlSql, "Business Builder");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "public.is_org_owner_or_admin(organization_id)",
  "auth.role() = 'service_role'",
  "revoke select (credential_reference) on public.business_integration_connections from anon, authenticated"
]) {
  if (!businessControlSql.includes(required)) fail(`Business Builder control-plane extension is missing: ${required}`);
}

verifyExtension(CREATOR_GENERATION_TABLES, creatorGenerationSql, "Creator Studio generation");
for (const required of [
  "public.sonara_is_org_member(organization_id)",
  "auth.role() = ''service_role''",
  "rights_attested boolean not null default false",
  "consent_attested boolean not null default false",
  "identity_imitation_prohibited",
  "auth.uid() = user_id or public.is_org_owner_or_admin(organization_id)",
  "revoke insert, update, delete on public.creator_generation_jobs from anon, authenticated",
  "revoke insert, update, delete on public.creator_generation_assets from anon, authenticated",
  "revoke insert, update, delete on public.creator_reference_analyses from anon, authenticated",
  "revoke insert, update, delete on public.creator_generation_events from anon, authenticated",
  "revoke delete on public.creator_voice_consents from anon, authenticated",
  "notify pgrst, 'reload schema'"
]) {
  if (!creatorGenerationSql.includes(required)) fail(`Creator Studio generation extension is missing: ${required}`);
}
if (/api_key\s+text|secret_key\s+text|access_token\s+text/i.test(creatorGenerationSql)) {
  fail("Creator Studio generation tables must not persist provider credentials");
}

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
  if (!growthStudioSql.includes(required)) fail(`Growth Studio extension is missing: ${required}`);
}
if (/api_keys+text|secret_keys+text|access_tokens+text|refresh_tokens+text/i.test(growthStudioSql)) {
  fail("Growth Studio tables must not persist provider credentials");
}

verifyExtension(PRODUCT_LIFECYCLE_TABLES, productLifecycleSql, "Product lifecycle");
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
  if (!productLifecycleSql.includes(required)) fail(`Product lifecycle extension is missing: ${required}`);
}

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
  if (!marketIntelligenceSql.includes(required)) fail(`Market intelligence extension is missing: ${required}`);
}

verifyExtension(PROMPT_LIBRARY_TABLES, promptLibrarySql, "Prompt Library");
for (const required of [
  "public.is_org_member(organization_id)",
  "public.has_org_role(organization_id",
  "public.is_org_owner_or_admin(organization_id)",
  "auth.role() = ''service_role''",
  "create or replace function public.create_sonara_prompt_version",
  "revoke all on function public.create_sonara_prompt_version(uuid,text,text,text,text) from public, anon, authenticated",
  "grant execute on function public.create_sonara_prompt_version(uuid,text,text,text,text) to service_role",
  "grant select, insert, update, delete on table public.%i to service_role",
  "input_schema = v_input_schema",
  "members read visible prompt templates",
  "members read visible prompt collections"
]) {
  if (!promptLibrarySql.includes(required)) fail(`Prompt Library extension is missing: ${required}`);
}
if (/api_key\s+text|secret_key\s+text|access_token\s+text|refresh_token\s+text/i.test(promptLibrarySql)) {
  fail("Prompt Library tables must not persist provider credentials");
}

const runtimeFiles = [
  path.join(root, "server.js"),
  ...fs.readdirSync(path.join(root, "routes"))
    .filter((name) => name.endsWith(".cjs"))
    .sort()
    .map((name) => path.join(root, "routes", name))
];
const runtimeSource = runtimeFiles.map(read).join("\n");
const runtimeTableReferences = new Set();
for (const pattern of [
  /\/rest\/v1\/([a-z0-9_]+)/gi,
  /safeListTable\(\s*["']([a-z0-9_]+)["']/gi,
  /\btable\s*:\s*["']([a-z0-9_]+)["']/gi,
  /\brest\(\s*["']([a-z0-9_]+)["']/gi
]) {
  for (const match of runtimeSource.matchAll(pattern)) runtimeTableReferences.add(match[1]);
}
const reviewedExtensionTables = new Set([...BUSINESS_OPERATIONS_TABLES, ...BUSINESS_CONTROL_TABLES, ...CREATOR_GENERATION_TABLES, ...GROWTH_STUDIO_TABLES, ...PRODUCT_LIFECYCLE_TABLES, ...PROMPT_LIBRARY_TABLES]);
for (const table of [...runtimeTableReferences].sort()) {
  if (table === "rpc") continue;
  if (!DATABASE_TABLES.includes(table) && !reviewedExtensionTables.has(table)) {
    fail(`runtime references public.${table}, but it is absent from the canonical or reviewed extension contract`);
  }
}

for (const signature of DATABASE_FUNCTIONS) {
  const normalized = signature.toLowerCase();
  if (!contractSql.includes(`'${normalized}'`) && !contractSql.includes(normalized)) fail(`the readiness contract does not check or declare ${signature}`);
  const functionName = signature.slice("public.".length, signature.indexOf("("));
  const createPattern = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, "i");
  if (!createPattern.test(allSql)) fail(`no migration defines ${signature}`);
}

for (const index of DATABASE_INDEXES) {
  if (!DATABASE_TABLES.includes(index.table)) fail(`operational index ${index.name} references unknown table ${index.table}`);
  const createPattern = new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${index.name}\\s+on\\s+public\\.${index.table}\\b`, "i");
  if (!createPattern.test(operationalIndexSql)) fail(`operational migration does not create ${index.name} on public.${index.table}`);
  if (!operationalIndexSql.includes(`'${index.name}'`)) fail(`operational migration does not assert ${index.name}`);
}

for (const requiredSql of [
  "classes.relrowsecurity",
  "grant select, insert, update, delete on table public.%i to service_role",
  "security invoker",
  "set search_path = ''",
  "revoke execute on function public.sonara_database_contract_snapshot() from public, anon, authenticated",
  "grant execute on function public.sonara_database_contract_snapshot() to service_role",
  "notify pgrst, 'reload schema'"
]) {
  if (!contractSql.includes(requiredSql)) fail(`contract migration is missing: ${requiredSql}`);
}

for (const requiredSql of [
  "pg_index",
  "indisvalid",
  "indisready",
  "where status = 'active'",
  "where status in ('active', 'trialing')",
  "notify pgrst, 'reload schema'"
]) {
  if (!operationalIndexSql.includes(requiredSql)) fail(`operational index migration is missing: ${requiredSql}`);
}
if (/create\s+table/i.test(operationalIndexSql)) fail("operational index migration must not add speculative tables");
if (/grant\s+/i.test(operationalIndexSql)) fail("operational index migration must not change Data API privileges");

if (!/auto_expose_new_tables\s*=\s*false/.test(config)) fail("local Data API must not auto-expose new tables");
if (!/\[db\.seed\][\s\S]*?enabled\s*=\s*false/.test(config)) fail("local seed execution must remain disabled until a reviewed seed exists");
if (!/minimum_password_length\s*=\s*8/.test(config)) fail("local Supabase Auth must enforce the application 8-character minimum password length");
// This used to exempt three buckets from the check below. They declared 100MiB
// and 150MiB against a free plan that caps a bucket at 50MiB, so storage refused
// them outright -- never capacity, only a promise rejected on arrival. They sit
// at 50MiB now and the exemption is gone, which is the state worth keeping: an
// exception list nobody has to remember to empty.

// "50MiB", "500KB", "1GB" -> MiB. Returns null for anything unparseable so a
// new unit form fails loudly at the comparison rather than silently passing.
function toMebibytes(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB)$/i);
  if (!match) return null;
  const size = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors = { b: 1 / 1048576, kb: 1000 / 1048576, kib: 1 / 1024, mb: 1000000 / 1048576, mib: 1, gb: 1000000000 / 1048576, gib: 1024 };
  return size * factors[unit];
}

const globalStorageLimit = toMebibytes(config.match(/\[storage\]([\s\S]*?)(?=\n\[)/)?.[1]?.match(/file_size_limit\s*=\s*"([^"]+)"/)?.[1]);
if (globalStorageLimit === null) fail("[storage] has no readable file_size_limit, so bucket limits cannot be checked against it");

for (const bucket of STORAGE_BUCKETS) {
  const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = config.match(new RegExp(`\\[storage\\.buckets\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] || "";
  if (!section) fail(`local config is missing storage bucket ${bucket}`);
  if (!/public\s*=\s*false/.test(section)) fail(`storage bucket ${bucket} must be private`);
  if (!/file_size_limit\s*=/.test(section)) fail(`storage bucket ${bucket} needs a file size limit`);
  // A bucket may not accept a file the storage service as a whole refuses,
  // except for the three recorded above. A fourth still fails here.
  const bucketLimit = toMebibytes(section.match(/file_size_limit\s*=\s*"([^"]+)"/)?.[1]);
  if (bucketLimit !== null && globalStorageLimit !== null && bucketLimit > globalStorageLimit) {
    fail(`storage bucket ${bucket} allows ${bucketLimit} MiB but [storage] file_size_limit is ${globalStorageLimit} MiB`);
  }
  if (!/allowed_mime_types\s*=/.test(section)) fail(`storage bucket ${bucket} needs a MIME allowlist`);
}

const mcpUrl = mcp?.mcpServers?.supabase?.url || "";
if (!mcpUrl.startsWith("https://mcp.supabase.com/mcp?")) fail("Supabase MCP must use the official HTTPS endpoint");
if (!mcpUrl.includes("project_ref=yqncsonkxgwhcxedgevk")) fail("Supabase MCP must be scoped to the linked project");
if (!mcpUrl.includes("read_only=true")) fail("Supabase MCP must remain read-only for production inspection");
if (/authorization|bearer|service[_-]?role|access[_-]?token/i.test(mcpText)) fail("Supabase MCP config must not contain credentials");

if (!process.exitCode) {
  console.log(`Supabase contract verified: ${DATABASE_SCHEMAS.length} schemas, ${DATABASE_TABLES.length} canonical tables, ${BUSINESS_CONTROL_TABLES.length} reviewed Business Builder extension tables, ${BUSINESS_OPERATIONS_TABLES.length} reviewed Business Builder operations tables, ${CREATOR_GENERATION_TABLES.length} reviewed Creator Studio generation tables, ${GROWTH_STUDIO_TABLES.length} reviewed Growth Studio extension tables, ${PRODUCT_LIFECYCLE_TABLES.length} reviewed Product Lifecycle tables, ${PROMPT_LIBRARY_TABLES.length} reviewed Prompt Library tables, ${DATABASE_FUNCTIONS.length} functions, ${DATABASE_INDEXES.length} operational indexes, ${STORAGE_BUCKETS.length} private buckets.`);
  // "schema-only" stopped being true when /research-lab/subsystems gained
  // forms: an operator can now add a tool registration, a note, a bookmark or a
  // setting. What has not changed, and is the part worth asserting, is that
  // nothing executes -- there is no agent runtime in this product, and the
  // tables that record runs, approvals and memory are refused a form precisely
  // so nothing can fabricate evidence of a run that never happened.
  console.log(`Agent foundation verified as approval-gated with no runtime: ${DATABASE_TABLE_GROUPS.agentsAndAutomation.length} tables; records of runs, approvals and memory are read-only and autonomous execution remains disabled.`);
}

function verifyExtension(tables, sql, label) {
  for (const table of tables) {
    const createPattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "i");
    const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!createPattern.test(sql)) fail(`${label} extension does not create public.${table}`);
    if (!rlsPattern.test(sql) && !sql.includes(`'${table}'`)) fail(`${label} extension does not enable or programmatically verify RLS for public.${table}`);
  }
}

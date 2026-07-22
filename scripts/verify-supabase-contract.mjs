import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const contractMigrationName = "20260722170000_complete_ecosystem_database_contract.sql";
const referenceContractExtensionName = "20260722201600_extend_database_contract_reference_intelligence.sql";
const operationalIndexMigrationName = "20260718193000_operational_query_index_contract.sql";
const contractMigrationPath = path.join(migrationsDirectory, contractMigrationName);
const referenceContractExtensionPath = path.join(migrationsDirectory, referenceContractExtensionName);
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

const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const allSql = migrationFiles.map((name) => read(path.join(migrationsDirectory, name))).join("\n").toLowerCase();
const contractSql = [contractMigrationPath, referenceContractExtensionPath]
  .map(read)
  .join("\n")
  .toLowerCase();
const operationalIndexSql = read(operationalIndexMigrationPath).toLowerCase();
const config = read(path.join(root, "supabase", "config.toml"));
const mcpText = read(path.join(root, ".mcp.json"));
const mcp = JSON.parse(mcpText);

if (DATABASE_TABLES.length !== new Set(DATABASE_TABLES).size) fail("the canonical table list contains duplicates");
if (DATABASE_TABLES.length !== 122) fail(`expected 122 canonical tables, found ${DATABASE_TABLES.length}`);
if (Object.values(DATABASE_TABLE_GROUPS).flat().length !== DATABASE_TABLES.length) fail("a table appears in more than one contract group");
if (DATABASE_FUNCTIONS.length !== 10) fail(`expected 10 contract functions, found ${DATABASE_FUNCTIONS.length}`);
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
  if (!contractSql.includes(`'${table}'`)) fail(`the runtime migration does not check public.${table}`);
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
  /\btable\s*:\s*["']([a-z0-9_]+)["']/gi
]) {
  for (const match of runtimeSource.matchAll(pattern)) runtimeTableReferences.add(match[1]);
}
for (const table of [...runtimeTableReferences].sort()) {
  if (table === "rpc") continue;
  if (!DATABASE_TABLES.includes(table)) fail(`runtime references public.${table}, but it is absent from the canonical contract`);
}

for (const signature of DATABASE_FUNCTIONS) {
  if (!contractSql.includes(`'${signature.toLowerCase()}'`)) fail(`the readiness RPC does not check ${signature}`);
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
for (const bucket of STORAGE_BUCKETS) {
  const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = config.match(new RegExp(`\\[storage\\.buckets\\.${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`))?.[1] || "";
  if (!section) fail(`local config is missing storage bucket ${bucket}`);
  if (!/public\s*=\s*false/.test(section)) fail(`storage bucket ${bucket} must be private`);
  if (!/file_size_limit\s*=/.test(section)) fail(`storage bucket ${bucket} needs a file size limit`);
  if (!/allowed_mime_types\s*=/.test(section)) fail(`storage bucket ${bucket} needs a MIME allowlist`);
}

const mcpUrl = mcp?.mcpServers?.supabase?.url || "";
if (!mcpUrl.startsWith("https://mcp.supabase.com/mcp?")) fail("Supabase MCP must use the official HTTPS endpoint");
if (!mcpUrl.includes("project_ref=yqncsonkxgwhcxedgevk")) fail("Supabase MCP must be scoped to the linked project");
if (!mcpUrl.includes("read_only=true")) fail("Supabase MCP must remain read-only for production inspection");
if (/authorization|bearer|service[_-]?role|access[_-]?token/i.test(mcpText)) fail("Supabase MCP config must not contain credentials");

if (!process.exitCode) {
  console.log(`Supabase contract verified: ${DATABASE_SCHEMAS.length} schemas, ${DATABASE_TABLES.length} tables, ${DATABASE_FUNCTIONS.length} functions, ${DATABASE_INDEXES.length} operational indexes, ${STORAGE_BUCKETS.length} private buckets.`);
  console.log(`Agent foundation verified as schema-only and approval-gated: ${DATABASE_TABLE_GROUPS.agentsAndAutomation.length} tables; autonomous execution remains disabled.`);
}

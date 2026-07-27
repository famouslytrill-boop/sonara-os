import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const migrationDirectory = path.join(root, "supabase", "migrations");
const diagnosticLogPath = path.join(root, "release-validation.log");
const { DATABASE_FUNCTIONS, DATABASE_TABLES, STORAGE_BUCKETS } = require(path.join(root, "lib", "sonara-database-contract.cjs"));

const supabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const failures = [];
const warnings = [];

if (!supabaseUrl) failures.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not configured");
if (!serviceRoleKey) failures.push("SUPABASE_SERVICE_ROLE_KEY is not configured");
if (failures.length) finish();

const migrationState = deriveMigrationState();
const snapshot = await fetchSnapshot();
const publicTables = new Map((snapshot.public_tables || []).map((table) => [table.name, table]));
const publicFunctionNames = new Set((snapshot.public_functions || []).map((fn) => fn.name));
const appliedMigrations = new Set((snapshot.applied_migrations || []).map(String));
const buckets = new Map((snapshot.storage_buckets || []).map((bucket) => [bucket.id, bucket]));
const schemas = new Map((snapshot.schemas || []).map((schema) => [schema.name, schema]));

for (const schemaName of ["public", "auth", "storage", "supabase_migrations"]) {
  if (!schemas.get(schemaName)?.available) failures.push(`required schema is unavailable: ${schemaName}`);
}

const expectedTables = new Set([...migrationState.tables, ...DATABASE_TABLES]);
for (const tableName of [...expectedTables].sort()) {
  const table = publicTables.get(tableName);
  if (!table) {
    failures.push(`declared application table is missing from production: public.${tableName}`);
    continue;
  }
  if (!table.rls_enabled) failures.push(`row-level security is disabled: public.${tableName}`);
  if (Number(table.column_count) < 1) failures.push(`table has no visible columns: public.${tableName}`);
  if (Number(table.primary_key_count) < 1) failures.push(`table has no primary key: public.${tableName}`);
  if (Number(table.index_count) !== Number(table.valid_index_count)) failures.push(`table has an invalid or unready index: public.${tableName}`);
  if (!table.service_role_select) failures.push(`service role cannot read table: public.${tableName}`);
  if (!table.service_role_insert || !table.service_role_update || !table.service_role_delete) {
    warnings.push(`service role has intentionally or unexpectedly limited write privileges: public.${tableName}`);
  }
  if (Number(table.policy_count) < 1) warnings.push(`RLS table has no explicit policy and is therefore closed to non-bypass roles: public.${tableName}`);
}

for (const version of [...migrationState.versions].sort()) {
  if (!appliedMigrations.has(version)) failures.push(`local migration is not recorded as applied in production: ${version}`);
}

for (const signature of [...DATABASE_FUNCTIONS, "public.sonara_database_deep_snapshot()"]) {
  const functionName = signature.slice("public.".length, signature.indexOf("("));
  if (!publicFunctionNames.has(functionName)) failures.push(`required public function is unavailable: ${signature}`);
}

for (const bucketName of STORAGE_BUCKETS) {
  const bucket = buckets.get(bucketName);
  if (!bucket) {
    failures.push(`required storage bucket is missing: ${bucketName}`);
    continue;
  }
  if (bucket.public) failures.push(`required storage bucket is public but must be private: ${bucketName}`);
}

await verifyPostgrestConnectivity(expectedTables);

if (Number(snapshot.public_table_count) !== publicTables.size) {
  failures.push(`snapshot public table count mismatch: reported ${snapshot.public_table_count}, enumerated ${publicTables.size}`);
}

finish({
  declaredTables: expectedTables.size,
  productionPublicTables: publicTables.size,
  localMigrations: migrationState.versions.size,
  appliedMigrations: appliedMigrations.size,
  requiredFunctions: DATABASE_FUNCTIONS.length + 1,
  requiredBuckets: STORAGE_BUCKETS.length
});

function deriveMigrationState() {
  const files = fs.readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const versions = new Set();
  const tables = new Set();

  for (const fileName of files) {
    const versionMatch = fileName.match(/^([0-9]+)_/);
    if (!versionMatch) {
      failures.push(`migration filename has no numeric version prefix: ${fileName}`);
      continue;
    }
    if (versions.has(versionMatch[1])) failures.push(`duplicate local migration version: ${versionMatch[1]}`);
    versions.add(versionMatch[1]);

    const source = fs.readFileSync(path.join(migrationDirectory, fileName), "utf8");
    const tableEvents = source.matchAll(/\b(create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)|drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+))/gi);
    for (const event of tableEvents) {
      if (event[2]) tables.add(event[2].toLowerCase());
      if (event[3]) tables.delete(event[3].toLowerCase());
    }
  }

  return { files, versions, tables };
}

async function fetchSnapshot() {
  const response = await requestWithRetry(`${supabaseUrl}/rest/v1/rpc/sonara_database_deep_snapshot`, {
    method: "POST",
    headers: serviceHeaders(),
    body: "{}"
  }, "deep database snapshot");
  const payload = await safeJson(response);
  if (!response.ok) {
    failures.push(`deep database snapshot failed with HTTP ${response.status}: ${safeMessage(payload)}`);
    finish();
  }
  const normalized = Array.isArray(payload) ? payload[0] : payload;
  if (!normalized || typeof normalized !== "object") {
    failures.push("deep database snapshot returned an invalid payload");
    finish();
  }
  return normalized;
}

async function verifyPostgrestConnectivity(expectedTables) {
  const preferred = [
    "organizations",
    "service_catalog_items",
    "creator_assets",
    "growth_campaigns",
    "audit_logs",
    "huggingface_resource_catalog",
    "market_intelligence_segments",
    "product_lifecycle_initiatives"
  ].filter((table) => expectedTables.has(table));

  for (const tableName of preferred) {
    const response = await requestWithRetry(
      `${supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?select=*&limit=0`,
      { method: "GET", headers: serviceHeaders() },
      `PostgREST connectivity for public.${tableName}`
    );
    if (!response.ok) {
      const payload = await safeJson(response);
      failures.push(`PostgREST cannot reach public.${tableName} (HTTP ${response.status}): ${safeMessage(payload)}`);
    }
  }
}

async function requestWithRetry(url, options, label) {
  let lastResponse;
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      lastResponse = await fetch(url, { ...options, signal: AbortSignal.timeout(5000), redirect: "error" });
      if (lastResponse.ok || ![404, 502, 503, 504].includes(lastResponse.status)) return lastResponse;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (lastResponse) return lastResponse;
  failures.push(`${label} could not connect after retries: ${lastError?.message || "unknown network error"}`);
  finish();
}

function serviceHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": "public"
  };
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 500) }; }
}

function safeMessage(payload) {
  if (!payload || typeof payload !== "object") return "unknown response";
  return String(payload.message || payload.hint || payload.code || "unknown response").slice(0, 500);
}

function persistDiagnostics(summary) {
  const lines = [
    "",
    "=== Production Supabase deep verification ===",
    `warnings=${warnings.length}`,
    ...warnings.map((warning) => `WARNING: ${warning}`),
    `failures=${failures.length}`,
    ...failures.map((failure) => `FAILURE: ${failure}`)
  ];
  if (summary) lines.push(`summary=${JSON.stringify(summary)}`);
  lines.push("=== End production Supabase deep verification ===", "");
  try {
    fs.appendFileSync(diagnosticLogPath, lines.join("\n"), "utf8");
  } catch (error) {
    console.warn(`Unable to persist Supabase verification diagnostics: ${error.message}`);
  }
}

function finish(summary = null) {
  persistDiagnostics(summary);
  if (warnings.length) {
    console.warn(`Supabase deep verification warnings (${warnings.length}):`);
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
  if (failures.length) {
    console.error(`Supabase deep verification failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Supabase deep verification passed.");
  if (summary) console.log(JSON.stringify(summary));
  process.exit(0);
}

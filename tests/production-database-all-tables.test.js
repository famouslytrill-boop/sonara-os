"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function runVerifier(mode, tableCount = 20) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sonara-db-probes-"));
  try {
    for (const name of ["scripts", "lib", "supabase/migrations"]) fs.mkdirSync(path.join(directory, name), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "../scripts/verify-production-supabase.mjs"), path.join(directory, "scripts/verify-production-supabase.mjs"));
    fs.writeFileSync(path.join(directory, "lib/sonara-database-contract.cjs"), "module.exports={DATABASE_FUNCTIONS:[],DATABASE_TABLES:[],DURABLE_EVENT_FOUNDATION_FUNCTIONS:[],DURABLE_EVENT_FOUNDATION_TABLES:[],STORAGE_BUCKETS:[]};");
    fs.writeFileSync(path.join(directory, "lib/sonara-database-retirement-contract.cjs"), "module.exports={RETIRED_DATABASE_TABLES:[]};");
    const tables = Array.from({ length: tableCount }, (_, i) => `fixture_${String(i).padStart(2, "0")}`);
    fs.writeFileSync(path.join(directory, "supabase/migrations/001_fixture.sql"), tables.map(name => `create table public.${name} (id int primary key);`).join("\n"));
    const mock = `
import fs from 'node:fs';
const tables = ${JSON.stringify(tables)};
const mode = ${JSON.stringify(mode)};
const trace = { calls: [], active: 0, peak: 0 };
const timer = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => timer(fn, ms === 2000 ? 0 : ms, ...args);
const snapshot = {
  schemas: ['public','auth','storage','supabase_migrations'].map(name => ({name,available:true})),
  public_tables: tables.map(name => ({name,rls_enabled:true,column_count:1,primary_key_count:1,index_count:1,valid_index_count:1,service_role_select:true,service_role_insert:true,service_role_update:true,service_role_delete:true,policy_count:1})),
  public_table_count: tables.length, public_functions: [{name:'sonara_database_deep_snapshot'}], applied_migrations:['001'], storage_buckets:[]
};
globalThis.fetch = async (url, options) => {
  const parsed = new URL(url);
  const table = parsed.pathname.split('/').pop();
  trace.calls.push({table,method:options.method,query:parsed.search});
  trace.active++; trace.peak = Math.max(trace.peak, trace.active);
  await new Promise(resolve => timer(resolve, 5));
  trace.active--;
  fs.writeFileSync(${JSON.stringify(path.join(directory, "trace.json"))}, JSON.stringify(trace));
  if (table === 'sonara_database_deep_snapshot') return new Response(JSON.stringify(snapshot));
  const attempts = trace.calls.filter(call => call.table === table).length;
  const status = table === 'fixture_19' && mode === 'denied' ? 403
    : table === 'fixture_19' && mode === 'recover' && attempts === 1 ? 503
    : table === 'fixture_19' && mode === 'exhausted' ? 503 : 200;
  return new Response(JSON.stringify(status === 200 ? [] : {code:'fixture_failure'}), {status});
};
`;
    fs.writeFileSync(path.join(directory, "mock.mjs"), mock);
    const result = spawnSync(process.execPath, ["--import", path.join(directory, "mock.mjs"), path.join(directory, "scripts/verify-production-supabase.mjs")], {
      cwd: directory, encoding: "utf8", timeout: 10000,
      env: { ...process.env, SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-server-only" }
    });
    const trace = JSON.parse(fs.readFileSync(path.join(directory, "trace.json"), "utf8"));
    return { ...result, trace, tables, diagnostics: fs.readFileSync(path.join(directory, "release-validation.log"), "utf8") };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

describe("every active database table has a live read-only assertion", () => {
  it("checks the complete population with at most four concurrent probes and no customer rows", () => {
    const result = runVerifier("ok");
    assert.equal(result.status, 0, result.stderr);
    const probes = result.trace.calls.filter(call => call.method === "GET");
    assert.deepEqual(probes.map(call => call.table).sort(), result.tables);
    assert.ok(result.trace.peak <= 4 && result.trace.peak > 1);
    assert.ok(probes.every(call => call.query === "?select=*&limit=0"));
    assert.equal(result.trace.calls.filter(call => call.method !== "GET").length, 1);
    assert.match(result.stdout, /"connectivityTablesChecked":20/);
    assert.doesNotMatch(result.stdout + result.stderr + result.diagnostics, /fixture-server-only/);
  });

  it("fails for a denied table that the former eight-table sample never examined", () => {
    const result = runVerifier("denied");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PostgREST cannot reach public.fixture_19 \(HTTP 403\)/);
    assert.equal(result.trace.calls.filter(call => call.table === "fixture_19").length, 1);
  });

  it("recovers from a transient outage and records the additional attempt", () => {
    const result = runVerifier("recover");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"transport":\{"requests":21,"attempts":22,"recovered":1\}/);
    assert.match(result.diagnostics, /"recovered":1/);
  });

  it("stops after the bounded retry budget without claiming recovery", () => {
    const result = runVerifier("exhausted");
    assert.equal(result.status, 1);
    assert.equal(result.trace.calls.filter(call => call.table === "fixture_19").length, 12);
    assert.match(result.stderr, /HTTP 503/);
    assert.match(result.diagnostics, /"recovered":0/);
  });
});

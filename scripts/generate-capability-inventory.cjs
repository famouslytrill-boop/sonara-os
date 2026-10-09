#!/usr/bin/env node
// Build a repository-grounded map of registered application routes, workspaces,
// database tables/migrations, and the research, skill, agent, formula, and
// infrastructure catalogs. The output is derived from the current checkout;
// it never connects to providers or changes a database.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const { unwrapHandler } = require("../lib/sonara-async-route-safety.cjs");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "capability-inventory.json");
const DOC_PATH = path.join(ROOT, "docs", "CAPABILITY_MAP.md");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "all"];
const BUSINESS_HOME = "/business-builder/dashboard";
const CREATOR_HOME = "/creator-studio/dashboard";
const GROWTH_HOME = "/growth-studio/dashboard";

function relativeFile(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function sorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

// Every regex character, backslash included. The identifiers interpolated
// below cannot contain most of these, but `$` is legal in a JavaScript name
// and is an anchor in a pattern, and an escape that handles some characters
// and not others is the shape CodeQL reports as incomplete -- correctly, since
// it holds only for the inputs somebody happened to think of.
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeRouteParams(value) {
  return String(value).replace(/:[A-Za-z_$][\w$]*/g, ":parameter");
}

function captureRegistrationSite(stack) {
  const candidates = [];
  for (const frame of String(stack || "").split("\n").slice(1)) {
    // V8 prints a named frame as `at name (file:line:col)` and an anonymous one
    // as `at file:line:col`, without the parentheses. Reading only the first
    // form skipped every anonymous frame, so a route registered inside a
    // callback -- `PAGES.forEach((page) => app.get(...))` -- was placed on the
    // line of the enclosing named function's call instead of its own.
    const match = frame.match(/\((.*):(\d+):(\d+)\)$/) || frame.match(/^\s*at (?:async )?([^\s()]+):(\d+):(\d+)$/);
    if (!match) continue;
    const absolute = path.resolve(match[1]);
    if (absolute === __filename || absolute.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (!absolute.startsWith(`${ROOT}${path.sep}`)) continue;
    candidates.push({ file: relativeFile(absolute), line: Number(match[2]) });
  }
  return candidates.find((candidate) => candidate.file === "server.js" || candidate.file.startsWith("routes/")) || candidates[0] || { file: null, line: null };
}

function captureLiveRoutes() {
  const registrations = [];
  const previous = new Map();
  for (const method of HTTP_METHODS) {
    const original = express.application[method];
    if (typeof original !== "function") continue;
    previous.set(method, original);
    express.application[method] = function captureSonaraRoute(routePath, ...handlers) {
      if (typeof routePath === "string" && routePath.startsWith("/")) {
        // server.js wraps every handler in lib/sonara-async-route-safety.cjs
        // before it reaches here, so `handlers` are the wrapper. Its source is
        // the same seven lines for every route; reading it traced each route's
        // tables from code that touches none. Read what the route registered.
        const own = handlers.map((handler) => unwrapHandler(handler));
        registrations.push({
          method: method.toUpperCase(),
          path: routePath,
          source: captureRegistrationSite(new Error().stack),
          registeredHandlerSources: own.map((handler) => String(handler)),
          registeredHandlerNames: own.map((handler) => handler.name || "anonymous")
        });
      }
      return original.call(this, routePath, ...handlers);
    };
  }

  let app;
  try {
    app = require(path.join(ROOT, "server.js"));
  } finally {
    for (const [method, original] of previous) express.application[method] = original;
  }

  const layers = (app._router?.stack || []).filter((layer) => layer.route);
  const byOperation = new Map();
  for (const layer of layers) {
    for (const method of Object.keys(layer.route.methods || {}).filter((name) => layer.route.methods[name])) {
      const key = `${method.toUpperCase()} ${String(layer.route.path)}`;
      byOperation.set(key, layer);
    }
  }

  const captured = registrations
    .filter((record) => byOperation.has(`${record.method} ${record.path}`))
    .map((record) => ({ ...record, layer: byOperation.get(`${record.method} ${record.path}`) }));
  // If the wrapper ever stops exposing what it wraps, every route reads back as
  // the wrapper again and the inventory quietly traces nothing. Stop instead.
  const stillWrapped = captured.filter((record) => record.registeredHandlerSources.some((source) => /settle\(handler\.call\(this/.test(source)));
  if (stillWrapped.length) {
    throw new Error(`${stillWrapped.length} route(s) captured the async-safety wrapper instead of their own handler (first: ${stillWrapped[0].method} ${stillWrapped[0].path}). See unwrapHandler in lib/sonara-async-route-safety.cjs.`);
  }
  return captured;
}

function migrationCatalog() {
  const dir = path.join(ROOT, "supabase", "migrations");
  const { withoutSqlComments } = require(path.join(ROOT, "lib", "sonara-comment-stripping.cjs"));
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const catalog = files.map((name) => {
    const sql = withoutSqlComments(fs.readFileSync(path.join(dir, name), "utf8"));
    const creates = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)].map((m) => m[1].toLowerCase());
    const alters = [...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)].map((m) => m[1].toLowerCase());
    const drops = [...sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.|retired\.)?"?([a-z0-9_]+)"?/gi)].map((m) => m[1].toLowerCase());
    if (/drop\s+table\s+retired\.%I/i.test(sql)) {
      const list = sql.match(/superseded\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i);
      if (list) for (const entry of list[1].matchAll(/'([a-z0-9_]+)'/gi)) drops.push(entry[1].toLowerCase());
    }
    const rls = [...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+enable\s+row\s+level\s+security/gi)].map((m) => m[1].toLowerCase());
    const policies = [...sql.matchAll(/create\s+policy\s+"?([^"\s]+)"?\s+on\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)].map((m) => ({ name: m[1], table: m[2].toLowerCase() }));
    return { file: `supabase/migrations/${name}`, creates: sorted(creates), alters: sorted(alters), drops: sorted(drops), rlsEnabled: sorted(rls), policies, sql };
  });

  const active = new Set(catalog.flatMap((migration) => migration.creates));
  for (const table of catalog.flatMap((migration) => migration.drops)) active.delete(table);
  return { catalog, active };
}

function databaseFunctionCatalog(migrations, activeTables) {
  const definitions = new Map();
  for (const migration of migrations) {
    const sql = migration.sql;
    const starts = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z][a-z0-9_]*)"?\s*\(/gi)];
    for (let index = 0; index < starts.length; index += 1) {
      const match = starts[index];
      const next = starts[index + 1]?.index || sql.length;
      const segment = sql.slice(match.index, next);
      const opening = /\bas\s+(\$[a-z0-9_]*\$)/i.exec(segment.slice(0, 6000));
      if (!opening) continue;
      const bodyStart = opening.index + opening[0].length;
      const bodyEnd = segment.indexOf(opening[1], bodyStart);
      if (bodyEnd < 0) continue;
      const name = match[1].toLowerCase();
      const body = segment.slice(bodyStart, bodyEnd);
      const readTables = [...body.matchAll(/\b(?:from|join)\s+(?:public\.)?"?([a-z][a-z0-9_]*)"?/gi)]
        .map((result) => result[1].toLowerCase()).filter((table) => activeTables.has(table));
      const writeOperations = [...body.matchAll(/\b(insert\s+into|update|delete\s+from|truncate\s+table)\s+(?:public\.)?"?([a-z][a-z0-9_]*)"?/gi)]
        .map((result) => ({ operation: result[1].split(/\s+/)[0].toUpperCase(), table: result[2].toLowerCase() }))
        .filter((entry) => activeTables.has(entry.table));
      const earlier = definitions.get(name);
      definitions.set(name, {
        name,
        source: migration.file,
        definitionMigrations: sorted([...(earlier?.definitionMigrations || []), migration.file]),
        readTables: sorted(readTables),
        writeTables: sorted(writeOperations.map((entry) => entry.table)),
        writeOperations,
        body
      });
    }
  }
  const functionNames = new Set(definitions.keys());
  for (const record of definitions.values()) {
    record.calls = sorted([...record.body.matchAll(/\b(?:public\.)?([a-z][a-z0-9_]*)\s*\(/gi)]
      .map((match) => match[1].toLowerCase()).filter((name) => functionNames.has(name) && name !== record.name));
  }
  function resolve(name, seen = new Set()) {
    const record = definitions.get(name);
    if (!record || seen.has(name)) return { readTables: [], writeTables: [], writeOperations: [], definitionMigrations: [] };
    const next = new Set([...seen, name]);
    const nested = record.calls.map((called) => resolve(called, next));
    const effects = {
      readTables: sorted([...(record.readTables || []), ...nested.flatMap((item) => item.readTables)]),
      writeTables: sorted([...(record.writeTables || []), ...nested.flatMap((item) => item.writeTables)]),
      writeOperations: [...record.writeOperations, ...nested.flatMap((item) => item.writeOperations)]
        .filter((item, index, list) => list.findIndex((candidate) => candidate.table === item.table && candidate.operation === item.operation) === index),
      definitionMigrations: sorted([...record.definitionMigrations, ...nested.flatMap((item) => item.definitionMigrations)])
    };
    return effects;
  }
  return [...definitions.keys()].sort().map((name) => {
    const record = definitions.get(name);
    const effects = resolve(name);
    return {
      id: `database-function:${name}`,
      name,
      source: record.source,
      definitionMigrations: effects.definitionMigrations,
      directReadTables: record.readTables,
      directWriteTables: record.writeTables,
      readTables: effects.readTables,
      writeTables: effects.writeTables,
      writeOperations: effects.writeOperations,
      calls: record.calls,
      evidence: "comment_stripped_latest_sql_function_definition"
    };
  });
}

function databaseTriggerCatalog(migrations, functions, activeTables) {
  const functionByName = new Map(functions.map((item) => [item.name, item]));
  const latest = new Map();
  for (const migration of migrations) {
    const sql = migration.sql;
    const starts = [...sql.matchAll(/^\s*(create|drop)\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+/gmi)];
    for (const match of starts) {
      const end = sql.indexOf(";", match.index);
      if (end < 0) continue;
      const statement = sql.slice(match.index, end + 1);
      const name = statement.match(/\btrigger\s+(?:if\s+(?:not\s+)?exists\s+)?"?([a-z][a-z0-9_]*)"?/i)?.[1]?.toLowerCase();
      const table = statement.match(/\bon\s+(?:public\.)?"?([a-z][a-z0-9_]*)"?/i)?.[1]?.toLowerCase();
      if (!name || !table || !activeTables.has(table)) continue;
      const key = `${table}:${name}`;
      if (match[1].toLowerCase() === "drop") { latest.delete(key); continue; }
      const functionName = statement.match(/\bexecute\s+(?:function|procedure)\s+(?:public\.)?"?([a-z][a-z0-9_]*)"?\s*\(/i)?.[1]?.toLowerCase();
      const timing = statement.match(/\b(before|after|instead\s+of)\s+([\s\S]*?)\s+on\s+(?:public\.)?/i);
      const events = sorted([...(timing?.[2] || "").matchAll(/\b(insert|update|delete|truncate)\b/gi)].map((event) => event[1].toUpperCase()));
      if (!functionName || !events.length) continue;
      const definition = functionByName.get(functionName);
      latest.set(key, {
        id: `database-trigger:${key}`,
        name,
        table,
        events,
        timing: timing[1].toUpperCase(),
        functionName,
        functionDefinition: definition?.source || null,
        readTables: definition?.readTables || [],
        writeTables: definition?.writeTables || [],
        migration: migration.file,
        evidence: "comment_stripped_create_trigger_statement"
      });
    }
  }
  return [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function rpcNamesIn(source) {
  return sorted([...String(source).matchAll(/(?:\/rest\/v1\/rpc\/|["'`]rpc\/)([a-z][a-z0-9_]*)/gi)].map((match) => match[1].toLowerCase()));
}

function extractReferences(source) {
  const matches = [];
  const add = (type, value) => {
    const clean = String(value || "").trim();
    if (clean && !matches.some((item) => item.type === type && item.name === clean)) matches.push({ type, name: clean });
  };
  for (const group of ["body", "query", "params"]) {
    const property = new RegExp(`\\breq\\s*\\??\\.\\s*${group}\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)`, "g");
    for (const match of String(source).matchAll(property)) {
      if (group === "body" && match[1] === "toString" && /^\s*\(/.test(String(source).slice(match.index + match[0].length))) continue;
      add(group, match[1]);
    }
    const bracket = new RegExp(`\\breq\\s*\\??\\.\\s*${group}\\s*\\??\\[\\s*["']([^"']+)["']\\s*\\]`, "g");
    for (const match of String(source).matchAll(bracket)) add(group, match[1]);
    const destructured = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*req\\s*(?:\\?\\.)?\\.\\s*${group}`, "g");
    for (const match of String(source).matchAll(destructured)) {
      for (const part of match[1].split(",")) {
        const field = part.trim().match(/^([A-Za-z_$][\w$]*)/);
        if (field) add(group, field[1]);
      }
    }
  }
  return {
    pathParams: [],
    body: sorted(matches.filter((item) => item.type === "body").map((item) => item.name)),
    query: sorted(matches.filter((item) => item.type === "query").map((item) => item.name)),
    params: sorted(matches.filter((item) => item.type === "params").map((item) => item.name)),
    bodyAccessed: /\breq\s*\??\.\s*body\b/.test(String(source)),
    queryAccessed: /\breq\s*\??\.\s*query\b/.test(String(source)),
    paramsAccessed: /\breq\s*\??\.\s*params\b/.test(String(source)),
    wholeBodyForwarded: /\.\.\.\s*req\s*\??\.\s*body\b|\b(?:body|payload)\s*:\s*req\s*\??\.\s*body\b/.test(String(source)),
    computedBodyFieldAccess: /\breq\s*\??\.\s*body\s*\[/.test(String(source)),
    headers: sorted([...String(source).matchAll(/req\.(?:get|header)\(\s*["']([^"']+)["']/g)].map((m) => m[1].toLowerCase())),
    cookies: sorted([...String(source).matchAll(/req\.cookies\?*\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1])),
    multipart: /\breq\.(?:file|files)\b/.test(String(source))
  };
}

function responseContract(layer, routePath, routeSource) {
  const source = routeSource === undefined ? layer.route.stack.map((item) => String(item.handle)).join("\n") : String(routeSource);
  const kinds = [];
  if (/\.json\s*\(/.test(source)) kinds.push("json");
  if (/\.redirect\s*\(/.test(source)) kinds.push("redirect");
  if (/\.download\s*\(|\.attachment\s*\(/.test(source)) kinds.push("file");
  if (/\.render\s*\(/.test(source)) kinds.push("rendered-view");
  if (/\.send\s*\(/.test(source)) kinds.push("send");
  if (/\.type\s*\(\s*["']text\/html/.test(source)) kinds.push("html");
  const inferred = kinds.length === 0;
  if (inferred) kinds.push(routePath.startsWith("/api/") ? "json-or-delegated" : "html-or-delegated");
  const statusCodes = sorted([
    ...[...source.matchAll(/\.status\s*\(\s*(\d{3})/g)].map((m) => Number(m[1])),
    ...[...source.matchAll(/\.sendStatus\s*\(\s*(\d{3})/g)].map((m) => Number(m[1]))
  ]).map(Number);
  return {
    kinds: sorted(kinds),
    statusCodes,
    jsonFieldsObserved: responseObjectFields(source),
    redirectTargetsObserved: sorted([...String(source).matchAll(/\.redirect\s*\(\s*(?:\d+\s*,\s*)?["'`]([^"'`]+)["'`]/g)].map((match) => match[1])),
    dynamicJsonResponseObserved: /\.json\s*\(\s*(?!\{)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/m.test(source),
    fieldEvidence: "literal_response_objects_observed",
    evidence: inferred ? "route-convention" : "handler-source"
  };
}

function responseObjectFields(source) {
  const fields = new Set();
  const responseCall = /\.(?:json|send)\s*\(\s*\{/g;
  for (const match of String(source).matchAll(responseCall)) {
    const open = match.index + match[0].lastIndexOf("{");
    let depth = 0;
    let quote = null;
    let escaped = false;
    let close = -1;
    for (let index = open; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "{") depth += 1;
      if (char === "}" && --depth === 0) { close = index; break; }
    }
    if (close < 0) continue;
    const objectBody = source.slice(open + 1, close);
    let segmentStart = 0;
    let braces = 0;
    let brackets = 0;
    let parentheses = 0;
    quote = null;
    escaped = false;
    const segments = [];
    for (let index = 0; index <= objectBody.length; index += 1) {
      const char = objectBody[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "{") braces += 1;
      else if (char === "}") braces -= 1;
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets -= 1;
      else if (char === "(") parentheses += 1;
      else if (char === ")") parentheses -= 1;
      else if ((char === "," || index === objectBody.length) && braces === 0 && brackets === 0 && parentheses === 0) {
        segments.push(objectBody.slice(segmentStart, index).trim());
        segmentStart = index + 1;
      }
    }
    for (const segment of segments) {
      const key = segment.match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*|["'][^"']+["'])\s*:/);
      if (key && !key[0].startsWith("...")) fields.add(key[1].replace(/["']/g, ""));
    }
  }
  return sorted(fields);
}

function workspaceFor(routePath, routeEntry, sourceFile) {
  const owner = routeEntry?.productOwner;
  if (owner === "business_builder") return "business_builder";
  if (owner === "creator_studio") return "creator_studio";
  if (owner === "growth_studio") return "growth_studio";
  if (owner === "sonara_industries") return "sonara_shared";
  if (routePath.startsWith("/business-builder/") || routePath.startsWith("/api/business-builder/") || routePath.startsWith("/api/business/")) return "business_builder";
  if (routePath.startsWith("/creator-studio/") || routePath.startsWith("/api/creator-studio/")) return "creator_studio";
  if (routePath.startsWith("/growth-studio/") || routePath.startsWith("/api/growth-studio/") || routePath.startsWith("/api/growth/")) return "growth_studio";
  if (routePath.startsWith("/admin/") || routePath.startsWith("/api/admin/")) return "admin_operations";
  if (routePath.startsWith("/research-lab/") || routePath.startsWith("/api/research-lab/")) return "research_lab";
  if (routePath.startsWith("/infrastructure") || routePath.startsWith("/api/infrastructure/")) return "shared_infrastructure";
  if (routePath.startsWith("/api/agents/") || routePath.startsWith("/owner/agent-")) return "business_builder_agent_ops";
  if (/^\/(?:api\/)?(?:formulas|api\/formulas)/.test(routePath)) return "cross_workspace_formulas";
  if (routePath.startsWith("/api/ecosystem/") || routePath.startsWith("/technology-radar")) return "research_catalog";
  if (/^\/(?:auth|account|login|signup|logout|reset-password|forgot-password)/.test(routePath)) return "shared_account";
  if (routePath.startsWith("/api/")) return "sonara_shared_api";
  if (sourceFile?.includes("agent") && routePath.startsWith("/owner/")) return "business_builder_agent_ops";
  return "sonara_shared";
}

function workspaceHome(workspace) {
  return ({
    business_builder: BUSINESS_HOME,
    business_builder_agent_ops: "/owner/agent-activity",
    creator_studio: CREATOR_HOME,
    growth_studio: GROWTH_HOME,
    admin_operations: "/admin",
    research_lab: "/research-lab/open-source",
    research_catalog: "/research-lab/open-source",
    shared_infrastructure: "/infrastructure",
    cross_workspace_formulas: "/formulas",
    shared_account: "/account",
    sonara_shared_api: "/dashboard",
    sonara_shared: "/dashboard"
  })[workspace] || "/dashboard";
}

function openApiContracts() {
  const file = path.join(ROOT, "openapi", "sonara.yaml");
  if (!fs.existsSync(file)) return new Map();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const contracts = new Map();
  let pathValue = null;
  let operation = null;
  const flush = () => {
    if (!operation || !pathValue) return;
    const expressPath = pathValue.replace(/\{([A-Za-z0-9_]+)\}/g, ":$1");
    contracts.set(`${operation.method} ${expressPath}`, {
      operationId: operation.operationId || null,
      summary: operation.summary || null,
      tags: operation.tags || [],
      requestBodyRef: operation.requestBodyRef || null,
      requestBodyDeclared: operation.requestBodyDeclared,
      responseStatusCodes: sorted(operation.responseStatusCodes),
      responseRefs: operation.responseRefs,
      bearerAuth: operation.bearerAuth
    });
  };
  for (const line of lines) {
    const pathMatch = line.match(/^  (\/api\/[^:]+):\s*$/);
    if (pathMatch) {
      flush();
      operation = null;
      pathValue = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete|head|options):\s*$/);
    if (methodMatch && pathValue) {
      flush();
      operation = { method: methodMatch[1].toUpperCase(), responseStatusCodes: [], responseRefs: [], bearerAuth: false, requestBodyDeclared: false };
      continue;
    }
    if (!operation) continue;
    const operationId = line.match(/^      operationId:\s*([A-Za-z][A-Za-z0-9]+)\s*$/);
    if (operationId) operation.operationId = operationId[1];
    const summary = line.match(/^      summary:\s*(.+?)\s*$/);
    if (summary) operation.summary = summary[1].replace(/^(["'])(.*)\1$/, "$2");
    const tags = line.match(/^      tags:\s*\[([^\]]*)\]\s*$/);
    if (tags) operation.tags = tags[1].split(",").map((tag) => tag.trim()).filter(Boolean);
    if (/^      requestBody:/.test(line)) operation.requestBodyDeclared = true;
    const requestRef = line.match(/requestBody:\s*\{\s*\$ref:\s*["']([^"']+)["']/);
    if (requestRef) operation.requestBodyRef = requestRef[1];
    for (const status of line.matchAll(/["']?(\d{3})["']?\s*:\s*/g)) operation.responseStatusCodes.push(Number(status[1]));
    for (const responseRef of line.matchAll(/["']?(\d{3})["']?\s*:\s*\{[^}]*?\$ref:\s*["']([^"']+)["']/g)) {
      operation.responseRefs.push({ statusCode: Number(responseRef[1]), ref: responseRef[2] });
    }
    if (/bearerAuth/.test(line)) operation.bearerAuth = true;
  }
  flush();
  return contracts;
}

function buildInventory() {
  const { ROUTE_REGISTRY } = require(path.join(ROOT, "lib", "sonara-route-registry.cjs"));
  const { CONTRACT_BY_ROUTE, inspectCreatorRouteDataContracts } = require(path.join(ROOT, "lib", "sonara-creator-route-data-contracts.cjs"));
  const { PENDING_CREATOR_SCHEMA } = require(path.join(ROOT, "lib", "sonara-pending-creator-schema-contract.cjs"));
  const { getWorkspaceDirectoryGroups } = require(path.join(ROOT, "lib", "sonara-workspace-directory.cjs"));
  const { describedColumns, tableColumns } = require(path.join(ROOT, "lib", "sonara-migration-columns.cjs"));
  const { ORPHAN_TABLES, ORPHAN_DISPOSITIONS } = require(path.join(ROOT, "lib", "sonara-orphan-tables.cjs"));
  const { TENANT_SCOPED_TABLES, GLOBAL_TABLES } = require(path.join(ROOT, "lib", "sonara-tenant-scoped-tables.cjs"));
  const databaseContract = require(path.join(ROOT, "lib", "sonara-database-contract.cjs"));
  const subsystemRegistry = require(path.join(ROOT, "lib", "sonara-subsystem-registry.cjs"));
  const formulaLibrary = require(path.join(ROOT, "lib", "sonara-formula-library.cjs"));
  const financialFormulas = require(path.join(ROOT, "lib", "sonara-financial-intelligence-formulas.cjs"));
  const infrastructure = require(path.join(ROOT, "lib", "sonara-infrastructure-manifest.cjs"));
  const agentAuthority = require(path.join(ROOT, "lib", "sonara-agent-authority.cjs"));
  const moduleCrud = require(path.join(ROOT, "lib", "sonara-module-crud.cjs"));
  const businessResources = require(path.join(ROOT, "routes", "sonara-last9-routes.cjs"));
  const recordChecks = require(path.join(ROOT, "lib", "sonara-record-checks.cjs"));
  const requestedRepoRegistry = require(path.join(ROOT, "lib", "sonara-requested-repository-registry.cjs"));
  const openSourceRegistry = require(path.join(ROOT, "lib", "sonara-open-source-registry.cjs"));
  const aiRegistry = require(path.join(ROOT, "lib", "sonara-ai-integration-registry.cjs"));
  const { withoutComments } = require(path.join(ROOT, "lib", "sonara-comment-stripping.cjs"));
  const openApiByOperation = openApiContracts();
  const migrationSource = migrationCatalog();
  const activeTableNames = sorted(migrationSource.active);
  const databaseFunctions = databaseFunctionCatalog(migrationSource.catalog, migrationSource.active);
  const databaseFunctionByName = new Map(databaseFunctions.map((item) => [item.name, item]));
  const databaseTriggers = databaseTriggerCatalog(migrationSource.catalog, databaseFunctions, migrationSource.active);
  const describedColumnType = (definition) => /\buuid\b/i.test(definition) ? "uuid"
    : /\bjsonb?\b/i.test(definition) ? "json"
      : /\bbool(?:ean)?\b/i.test(definition) ? "boolean"
        : /\b(?:numeric|integer|bigint|int|real|double|decimal|smallint)\b/i.test(definition) ? "number"
          : /\btimestamptz?\b|\btimestamp\b/i.test(definition) ? "timestamp"
            : /\bdate\b/i.test(definition) ? "date" : /\b(?:text|varchar|character)\b/i.test(definition) ? "text" : "unknown";
  const columnsFor = (table) => {
    const details = new Map((describedColumns(table) || []).map((column) => [column.name, column]));
    const names = [...(tableColumns(table) || [])];
    for (const migration of migrationSource.catalog) {
      const addColumn = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_]+)"?\s+([^,;\n]+)/gi;
      for (const match of migration.sql.matchAll(addColumn)) {
        if (match[1].toLowerCase() !== table || details.has(match[2].toLowerCase())) continue;
        const definition = match[3].trim();
        details.set(match[2].toLowerCase(), {
          name: match[2].toLowerCase(),
          type: describedColumnType(definition),
          required: /\bnot\s+null\b/i.test(definition) && !/\bdefault\b/i.test(definition),
          generated: /\bdefault\s+(?:gen_random_uuid|now)\s*\(/i.test(definition),
          allowed: [...(definition.match(/check\s*\([^)]*\bin\s*\(([^)]*)\)/i)?.[1] || "").matchAll(/'([^']*)'/g)].map((entry) => entry[1]),
          fallback: definition.match(/default\s+'([^']*)'/i)?.[1] || null
        });
      }
    }
    return names.map((name) => details.get(name) || { name, type: "unknown", required: false, generated: false, allowed: [], fallback: null });
  };

  const migrationRows = migrationSource.catalog.map(({ file, creates, alters, drops, rlsEnabled, policies }) => ({
    file,
    creates,
    alters,
    drops,
    rlsEnabled,
    policies
  }));
  const migrationByTable = new Map(activeTableNames.map((table) => [table, {
    createdBy: migrationRows.filter((migration) => migration.creates.includes(table)).map((migration) => migration.file),
    changedBy: migrationRows.filter((migration) => migration.alters.includes(table)).map((migration) => migration.file),
    rlsEvidence: migrationRows.filter((migration) => migration.rlsEnabled.includes(table)).map((migration) => migration.file),
    policyEvidence: migrationRows.flatMap((migration) => migration.policies.filter((policy) => policy.table === table).map((policy) => ({ name: policy.name, file: migration.file })))
  }]));
  const orphanSet = new Set(ORPHAN_TABLES);
  const subsystemForTable = new Map();
  for (const subsystem of subsystemRegistry.SUBSYSTEMS) for (const table of subsystem.tables) subsystemForTable.set(table, subsystem.slug);
  const coreTables = new Set(databaseContract.DATABASE_TABLES.map((table) => typeof table === "string" ? table : table.name || table.table).filter(Boolean));

  const tables = activeTableNames.map((name) => {
    const lineage = migrationByTable.get(name);
    const columns = columnsFor(name);
    return {
      id: `table:${name}`,
      schema: "public",
      name,
      columnCount: columns.length,
      columns,
      migrationLineage: lineage,
      databaseContractCore: coreTables.has(name),
      tenancy: TENANT_SCOPED_TABLES.has(name) ? "organization_scoped_registry" : GLOBAL_TABLES.has(name) ? "global_registry" : "not_in_generated_tenancy_registry",
      queryCoverage: orphanSet.has(name) ? "not_queried_by_runtime_source_audit" : "queried_by_runtime_source_audit",
      subsystem: subsystemForTable.get(name) || null,
      orphanDisposition: orphanSet.has(name) ? ORPHAN_DISPOSITIONS[name] || null : null
    };
  });

  const sourceTexts = new Map();
  const moduleTables = new Map();
  const tableNameSet = new Set(activeTableNames);
  const readSource = (file) => {
    if (!sourceTexts.has(file)) {
      const absolute = path.join(ROOT, file);
      sourceTexts.set(file, fs.existsSync(absolute) ? withoutComments(fs.readFileSync(absolute, "utf8")) : "");
    }
    return sourceTexts.get(file);
  };
  const sourceBlockForRoute = (file, line) => {
    if (!file || !line) return "";
    const lines = readSource(file).split("\n");
    const start = Math.max(0, line - 1);
    const source = lines.slice(start).join("\n");
    const registration = source.match(/^\s*app\.(?:get|post|put|patch|delete|head|options|all)\s*\(/);
    if (!registration) return lines[start] || "";
    const opening = registration[0].lastIndexOf("(");
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = opening; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "(") depth += 1;
      else if (char === ")" && --depth === 0) return source.slice(0, index + 1);
    }
    return lines[start] || "";
  };
  const referencesIn = (source) => activeTableNames.filter((table) => new RegExp(`(^|[^a-z0-9_])${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`, "i").test(source));
  const referencesInEndpointAccess = (source) => {
    const code = String(source);
    const accessFunction = /\b(?:safeCountTable|safeCountFiltered|supabase(?:List|Get|Insert|Update|Patch|Delete|Count|Upsert|Select)|(?:list|load|insert|update|patch|delete|count|query|select|upsert)Rows?|loadOne|patchRows|rest)\s*\(/i;
    const tableListUsed = /\b(?:safeCountTable|safeCountFiltered|supabaseCount|supabaseList|supabaseSelect)\s*\([^)]*\btable\b/i.test(code);
    return activeTableNames.filter((table) => {
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const quotedTable = `["'\x60]${escaped}["'\x60]`;
      const literalAccess = new RegExp(`${accessFunction.source}[\\s\\S]{0,320}${quotedTable}`, "i").test(code);
      const restPathAccess = new RegExp(`/rest/v1/${escaped}(?:[?/'"\x60]|$)`, "i").test(code);
      const tableListValue = tableListUsed && new RegExp(quotedTable, "i").test(code);
      return literalAccess || restPathAccess || tableListValue;
    });
  };
  // Local REST wrappers: functions proven to put one of their own parameters
  // straight after /rest/v1/ -- `read(pathAndQuery)`, `rest(scope, path)`,
  // `supabaseRequest(config, table, query)`. Twenty-odd route files define
  // one, and each call's literal argument at that position names the table as
  // surely as a written-out URL does. A wrapper that only forwards its
  // parameter to another proven wrapper is proven too.
  const restWrapperCache = new Map();
  function callArguments(code, openParen) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = openParen; index < code.length; index += 1) {
      const char = code[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "(") depth += 1;
      else if (char === ")" && --depth === 0) return topLevelEntries(code.slice(openParen + 1, index));
    }
    return [];
  }
  function restWrappersFor(sourceFile) {
    if (!sourceFile) return new Map();
    if (restWrapperCache.has(sourceFile)) return restWrapperCache.get(sourceFile);
    const source = readSource(sourceFile);
    const bodies = localFunctionsFor(sourceFile);
    const parameters = new Map();
    const definitions = [
      /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\(([^)]*)\)\s*(?:=>)?\s*\{/g
    ];
    for (const pattern of definitions) {
      for (const match of source.matchAll(pattern)) {
        if (!bodies.has(match[1]) || parameters.has(match[1])) continue;
        parameters.set(match[1], match[2].split(",").map((parameter) => parameter.trim().replace(/\s*=[\s\S]*$/, "")));
      }
    }
    const wrappers = new Map();
    // Set before it is filled: a file whose helpers come from a file that
    // takes helpers from it must not recurse forever.
    restWrapperCache.set(sourceFile, wrappers);
    for (const [name, names] of parameters) {
      const body = bodies.get(name);
      const position = names.findIndex((parameter) => /^[A-Za-z_$][\w$]*$/.test(parameter) && body.includes(`/rest/v1/\${${parameter}}`));
      if (position >= 0) wrappers.set(name, position);
    }
    // A wrapper defined elsewhere is just as proven when this file is handed it
    // -- `safeListTable` is written once in server.js and called from a dozen
    // route files that receive it as a dependency.
    for (const [localName, resolved] of [...importedFunctionsFor(sourceFile), ...injectedFunctionsFor(sourceFile)]) {
      if (bodies.has(localName) || wrappers.has(localName) || !resolved?.file || resolved.file === sourceFile) continue;
      const position = restWrappersFor(resolved.file).get(resolved.name);
      if (position !== undefined) wrappers.set(localName, position);
    }
    for (let changed = true; changed;) {
      changed = false;
      for (const [name, names] of parameters) {
        if (wrappers.has(name)) continue;
        const body = bodies.get(name);
        for (const [wrapper, position] of wrappers) {
          for (const call of body.matchAll(new RegExp(`(?<![.$\\w])${escapeRegExp(wrapper)}\\s*\\(`, "g"))) {
            const argument = callArguments(body, call.index + call[0].length - 1)[position];
            const forwarded = names.findIndex((parameter) => parameter && argument === parameter);
            if (forwarded >= 0) { wrappers.set(name, forwarded); changed = true; break; }
          }
          if (wrappers.has(name)) break;
        }
      }
    }
    return wrappers;
  }
  function tablesThroughRestWrappers(sourceFile, code) {
    const found = new Set();
    for (const [wrapper, position] of restWrappersFor(sourceFile)) {
      for (const call of code.matchAll(new RegExp(`(?<![.$\\w])${escapeRegExp(wrapper)}\\s*\\(`, "g"))) {
        const argument = callArguments(code, call.index + call[0].length - 1)[position] || "";
        const table = argument.match(/^["'`]([a-z_][a-z0-9_]*)(?:[?/"'`]|\$\{)/)?.[1];
        if (table && tableNameSet.has(table)) found.add(table);
      }
    }
    return found;
  }
  const tablesReferencedByHandler = (sourceFile, handlerSource) => {
    const found = new Set(referencesInEndpointAccess(withoutComments(handlerSource)));
    for (const table of tablesThroughRestWrappers(sourceFile, withoutComments(handlerSource))) found.add(table);
    const moduleSource = sourceFile ? readSource(sourceFile) : "";
    // Commerce's local REST client accepts "table?query", rather than a full
    // /rest/v1 URL. Trace only that proven wrapper and a literal first argument;
    // a table mentioned in copy or in another handler remains a candidate.
    // Otherwise even a buyer's receipt was classified as having no persistence.
    if (moduleSource.includes('/rest/v1/${pathAndQuery}')
      && /const\s*\{\s*read,\s*write\s*\}\s*=\s*restClient\(/.test(moduleSource)) {
      const code = withoutComments(handlerSource);
      for (const match of code.matchAll(/\b(?:read|write)\s*\(\s*["'`]([a-z_][a-z0-9_]*)(?:\?|["'`])/g)) {
        if (tableNameSet.has(match[1])) found.add(match[1]);
      }
    }
    const addKnown = (value) => {
      if (typeof value === "string" && tableNameSet.has(value)) found.add(value);
      else if (Array.isArray(value)) for (const item of value) addKnown(item);
    };

    // Resolve table aliases used by handlers (`TABLES.leads`, `QUEUE_TABLE`,
    // `TABLE`) through the small in-repository registry modules they import.
    // This is what makes shared CRUD handlers traceable without pretending
    // every table mentioned elsewhere in the same route file belongs to each
    // endpoint in that file.
    const imports = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of moduleSource.matchAll(imports)) {
      const specifier = match[2];
      if (!specifier.startsWith(".")) continue;
      const importedPath = path.resolve(ROOT, path.dirname(sourceFile), specifier);
      if (!importedPath.startsWith(`${ROOT}${path.sep}`)) continue;
      if (!/(?:table|resource|formula|agent-(?:action-log|queue)|module-crud)/i.test(importedPath)) continue;
      let exports;
      try { exports = require(importedPath); } catch { continue; }
      for (const declaration of match[1].split(",")) {
        const parts = declaration.trim().split(/\s*:\s*/);
        const importedName = parts[0].trim();
        const localName = (parts[1] || importedName).trim();
        const value = exports?.[importedName];
        if (typeof value === "string") {
          if (tableNameSet.has(value) && new RegExp(`\\b${localName}\\b`).test(handlerSource)) found.add(value);
          continue;
        }
        if (Array.isArray(value)) {
          const referenced = new RegExp(`\\b${localName}\\b`).test(handlerSource);
          // Naming the formula tables is not reading them. The static readiness
          // report lists them by name and touches none; only a body that also
          // makes a database call is credited with the whole list.
          const readsSomething = /\/rest\/v1\/|\b(?:safeCountTable|safeCountFiltered|safeListTable|supabase(?:List|Get|Insert|Update|Patch|Delete|Count|Upsert|Select))\s*\(/.test(handlerSource);
          if (referenced && readsSomething && importedName.toLowerCase().includes("formula")) addKnown(value);
          continue;
        }
        if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value)) {
            const propertyAccess = new RegExp(`\\b${localName}\\s*(?:\\?\\.)?\\.\\s*${key}\\b`).test(handlerSource);
            if (propertyAccess) addKnown(child);
          }
        }
      }
    }

    // Local constants used by inline handlers (for example SCHEDULE_TABLE).
    const localConstants = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*["']([a-z_][a-z0-9_]*)["']/g;
    for (const match of moduleSource.matchAll(localConstants)) {
      if (tableNameSet.has(match[2]) && new RegExp(`\\b${match[1]}\\b`).test(handlerSource)) found.add(match[2]);
    }
    const localObjects = /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:Object\.freeze\s*\(\s*)?\{([\s\S]*?)\}\s*\)?\s*;?/g;
    for (const match of moduleSource.matchAll(localObjects)) {
      const objectName = match[1];
      for (const property of match[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*["']([a-z_][a-z0-9_]*)["']/g)) {
        if (!tableNameSet.has(property[2])) continue;
        if (new RegExp(`\\b${objectName}\\s*(?:\\?\\.)?\\.\\s*${property[1]}\\b`).test(handlerSource)) found.add(property[2]);
      }
    }
    return sorted(found);
  };
  const localFunctionCache = new Map();
  const importedFunctionCache = new Map();
  function closingParen(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = openIndex; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "(") depth += 1;
      else if (char === ")" && --depth === 0) return index;
    }
    return -1;
  }
  function closingBrace(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = openIndex; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) return index;
    }
    return -1;
  }
  function localFunctionsFor(sourceFile) {
    if (localFunctionCache.has(sourceFile)) return localFunctionCache.get(sourceFile);
    const source = readSource(sourceFile);
    const functions = new Map();
    // Each head ends at the opening "(" of the parameter list, which is then
    // matched by counting rather than by `[^)]*`. That stopped at the first
    // ")" -- so a function with a default like `fetch: request = (...args) =>
    // fetch(...args)` was never recorded, and neither was anything it returns.
    // The creator project store was invisible for that reason alone.
    const starts = [
      { head: /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g, tail: /^\s*\{/ },
      { head: /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\(/g, tail: /^\s*=>\s*\{/ },
      { head: /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>\s*\{/g, tail: null },
      { head: /return\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g, tail: /^\s*\{/ }
    ];
    for (const { head, tail } of starts) {
      for (const match of source.matchAll(head)) {
        let open;
        if (tail) {
          const parametersClose = closingParen(source, match.index + match[0].length - 1);
          if (parametersClose < 0) continue;
          const rest = source.slice(parametersClose + 1, parametersClose + 40).match(tail);
          if (!rest) continue;
          open = parametersClose + rest[0].length;
        } else {
          open = match.index + match[0].lastIndexOf("{");
        }
        const close = closingBrace(source, open);
        if (close >= 0) functions.set(match[1], source.slice(open + 1, close));
      }
    }
    // Arrows whose body is an expression -- `const channelForm = () => \`<form
    // ...>\`` -- were not recorded at all, so every form and query written that
    // way was invisible: the growth channel and event pages, among others, read
    // as having no form for routes they post to on every visit. Recorded after
    // the block-bodied definitions, and never in place of one.
    const expressionHeads = [
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/g
    ];
    for (const head of expressionHeads) {
      for (const match of source.matchAll(head)) {
        if (functions.has(match[1])) continue;
        let arrowEnd;
        if (match[0].endsWith("(")) {
          const parametersClose = closingParen(source, match.index + match[0].length - 1);
          if (parametersClose < 0) continue;
          const arrow = source.slice(parametersClose + 1, parametersClose + 40).match(/^\s*=>/);
          if (!arrow) continue;
          arrowEnd = parametersClose + 1 + arrow[0].length;
        } else {
          arrowEnd = match.index + match[0].length;
        }
        const start = arrowEnd + (source.slice(arrowEnd).match(/^\s*/)?.[0].length || 0);
        if (source[start] === "{") continue;
        const end = expressionEnd(source, start);
        if (end > start) functions.set(match[1], source.slice(start, end));
      }
    }
    localFunctionCache.set(sourceFile, functions);
    return functions;
  }
  // Where an arrow's expression body ends: a `;` or `,` at depth zero, the
  // closing bracket of whatever encloses it, or a line break that does not
  // continue the expression.
  function expressionEnd(source, start) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if ("([{".includes(char)) depth += 1;
      else if (")]}".includes(char)) {
        if (depth === 0) return index;
        depth -= 1;
      } else if ((char === ";" || char === ",") && depth === 0) {
        return index;
      } else if (char === "\n" && depth === 0) {
        const next = source.slice(index + 1).match(/^\s*(\S{1,2})/)?.[1] || "";
        if (!/^(?:[.?:+\-*/%&|<>=]|\?\?|&&|\|\|)/.test(next)) return index;
      }
    }
    return source.length;
  }
  function importedFunctionsFor(sourceFile) {
    if (importedFunctionCache.has(sourceFile)) return importedFunctionCache.get(sourceFile);
    const source = readSource(sourceFile);
    const imports = new Map();
    const providedFunctions = (argsOpen, argsClose) => {
      const provided = new Map();
      if (argsOpen < 0 || argsClose <= argsOpen) return provided;
      const args = source.slice(argsOpen + 1, argsClose);
      const providedNames = /(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/gm;
      for (const providedMatch of args.matchAll(providedNames)) {
        const providedName = providedMatch[1];
        const localBody = localFunctionsFor(sourceFile).get(providedName);
        const importedDependency = imports.get(providedName);
        if (localBody !== undefined) provided.set(providedName, { file: sourceFile, name: providedName, body: localBody });
        else if (importedDependency) provided.set(providedName, importedDependency);
      }
      return provided;
    };
    const pattern = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of source.matchAll(pattern)) {
      if (!match[2].startsWith(".")) continue;
      const targetBase = path.resolve(ROOT, path.dirname(sourceFile), match[2]);
      const target = [targetBase, `${targetBase}.cjs`, `${targetBase}.js`, `${targetBase}.mjs`, path.join(targetBase, "index.cjs"), path.join(targetBase, "index.js")].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target || !target.startsWith(`${ROOT}${path.sep}`)) continue;
      const targetFile = relativeFile(target);
      for (const declaration of match[1].split(",")) {
        const names = declaration.trim().match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
        if (!names) continue;
        const exportedName = names[1];
        const localName = names[2] || exportedName;
        const body = localFunctionsFor(targetFile).get(exportedName);
        if (body !== undefined) imports.set(localName, { file: targetFile, name: exportedName, body });
      }
    }
    // `deps.projectStore || createCreatorProjectStore(deps)` is a factory call
    // with a test seam in front of it; production takes the factory branch.
    const factoryObject = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$.]*\s*\|\|\s*)?([A-Za-z_$][\w$]*)\s*\(/g;
    // The object literal a factory is called with, if it is called with one.
    // This used to take the next "{" anywhere after the call, so a factory
    // called with `(deps)` was credited with whatever block came next in the
    // file as the functions it had been handed.
    const objectArgumentAt = (index) => {
      const open = source.slice(index).match(/^\s*\{/);
      return open ? index + open[0].length - 1 : -1;
    };
    // A named export attached to a default CommonJS function (the Connect
    // webhook factory) is just as traceable as a destructured import. Resolve
    // explicit assignments only; do not assume every local function is exported.
    const moduleImports = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of source.matchAll(moduleImports)) {
      if (!match[2].startsWith(".")) continue;
      const targetBase = path.resolve(ROOT, path.dirname(sourceFile), match[2]);
      const target = [targetBase, `${targetBase}.cjs`, `${targetBase}.js`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target || !target.startsWith(`${ROOT}${path.sep}`)) continue;
      const targetFile = relativeFile(target);
      for (const exported of readSource(targetFile).matchAll(/module\.exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)) {
        const body = localFunctionsFor(targetFile).get(exported[2]);
        if (body !== undefined) imports.set(`${match[1]}.${exported[1]}`, { file: targetFile, name: exported[2], body });
      }
      // And the usual shape, `module.exports = { completeChallenge, ... }`.
      // `twoFactor.completeChallenge(...)` reached nothing before this, which is
      // how a sign-in's second step read as touching no table.
      const exportObject = readSource(targetFile).match(/module\.exports\s*=\s*(?:Object\.freeze\s*\(\s*)?\{/);
      if (exportObject) {
        const targetSource = readSource(targetFile);
        const open = exportObject.index + exportObject[0].length - 1;
        const close = closingBrace(targetSource, open);
        for (const entry of close > open ? topLevelEntries(targetSource.slice(open + 1, close)) : []) {
          const names = entry.match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
          if (!names) continue;
          const body = localFunctionsFor(targetFile).get(names[2] || names[1]);
          if (body !== undefined && !imports.has(`${match[1]}.${names[1]}`)) imports.set(`${match[1]}.${names[1]}`, { file: targetFile, name: names[2] || names[1], body });
        }
      }
    }
    for (const match of source.matchAll(factoryObject)) {
      const factory = imports.get(match[2]);
      if (!factory) continue;
      const argsOpen = objectArgumentAt(match.index + match[0].length);
      const argsClose = argsOpen >= 0 ? closingBrace(source, argsOpen) : -1;
      const provided = providedFunctions(argsOpen, argsClose);
      const returnedFunctions = localFunctionsFor(factory.file);
      for (const [functionName, body] of returnedFunctions) {
        if (!factory.body.includes(`return ${functionName}`) && !factory.body.includes(`return async function ${functionName}`)) continue;
        imports.set(match[1], { file: factory.file, name: functionName, body, injectedFunctions: provided });
        break;
      }
    }
    const factoryBinding = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*([A-Za-z_$][\w$]*)\s*\(/g;
    for (const match of source.matchAll(factoryBinding)) {
      const factory = imports.get(match[2]);
      if (!factory) continue;
      const argsOpen = objectArgumentAt(match.index + match[0].length);
      const argsClose = argsOpen >= 0 ? closingBrace(source, argsOpen) : -1;
      const provided = providedFunctions(argsOpen, argsClose);
      for (const declaration of match[1].split(",")) {
        const names = declaration.trim().match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
        if (!names) continue;
        const exportedName = names[1];
        const localName = names[2] || exportedName;
        const body = localFunctionsFor(factory.file).get(exportedName);
        if (body !== undefined) imports.set(localName, { file: factory.file, name: exportedName, body, injectedFunctions: provided });
      }
    }
    for (const match of source.matchAll(factoryObject)) {
      const localBody = localFunctionsFor(sourceFile).get(match[2]);
      const factory = imports.get(match[2]) || (localBody === undefined ? null : { file: sourceFile, name: match[2], body: localBody });
      if (!factory) continue;
      const argsOpen = objectArgumentAt(match.index + match[0].length);
      const argsClose = argsOpen >= 0 ? closingBrace(source, argsOpen) : -1;
      const provided = providedFunctions(argsOpen, argsClose);
      for (const [methodName, body] of localFunctionsFor(factory.file)) {
        // Local factories need an explicit returned method; otherwise unrelated
        // functions in the same file would be credited to the returned object.
        if (localBody !== undefined && !new RegExp(`return\\s*\\{[^}]*\\b${methodName}\\b`).test(factory.body)) continue;
        imports.set(`${match[1]}.${methodName}`, { file: factory.file, name: methodName, body, injectedFunctions: provided });
      }
    }
    importedFunctionCache.set(sourceFile, imports);
    return imports;
  }

  // Helpers a route module is handed by whoever registers it.
  //
  // Most route files are `function register(app, deps)` and take their helpers
  // -- saveModuleOutput, the session reader, the access checks -- from the
  // object server.js passes in. Neither resolver above can see those: the name
  // is not defined in the file and not required by it. So a tool that saves its
  // result through `saveModuleOutput` read as touching no table at all, and 38
  // routes sat in the review list for that reason alone.
  //
  // Resolved from the registration call itself -- `register(app, { name })`,
  // `register(app, { key: name })`, `register(app, deps)` and `{ ...deps, name }`
  // -- and only to a function that call actually passes. A helper the caller
  // does not pass stays unresolved rather than being matched by name.
  const injectedKeyCache = new Map();
  const injectedFunctionCache = new Map();
  const callerFiles = (() => {
    const files = ["server.js"];
    for (const dir of ["routes", "lib"]) {
      const absolute = path.join(ROOT, dir);
      if (!fs.existsSync(absolute)) continue;
      for (const name of fs.readdirSync(absolute).sort()) if (/\.(?:cjs|js)$/.test(name)) files.push(`${dir}/${name}`);
    }
    return files;
  })();
  function topLevelEntries(text) {
    const entries = [];
    let depth = 0;
    let quote = null;
    let escaped = false;
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if ("([{".includes(char)) depth += 1;
      else if (")]}".includes(char)) depth -= 1;
      else if (char === "," && depth === 0) { entries.push(text.slice(start, index).trim()); start = index + 1; }
    }
    entries.push(text.slice(start).trim());
    return entries.filter(Boolean);
  }
  function depsParameterOf(sourceFile) {
    return readSource(sourceFile).match(/function\s+[A-Za-z_$][\w$]*\s*\(\s*app\s*,\s*([A-Za-z_$][\w$]*)\s*(?:=\s*\{\s*\})?\s*\)/)?.[1] || null;
  }
  function resolveInCaller(callerFile, expression) {
    const text = String(expression).trim();
    const identifier = text.match(/^([A-Za-z_$][\w$]*)(?:\s*\|\|[\s\S]*)?$/)?.[1];
    if (identifier) {
      const localBody = localFunctionsFor(callerFile).get(identifier);
      if (localBody !== undefined) return { file: callerFile, name: identifier, body: localBody };
      return importedFunctionsFor(callerFile).get(identifier) || injectedFunctionsFor(callerFile).get(identifier) || null;
    }
    const member = text.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
    if (member && member[1] === depsParameterOf(callerFile)) return injectedKeysFor(callerFile).get(member[2]) || null;
    // An inline wrapper -- `key: (req) => helper(req)` -- is traced as written.
    if (/^(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(text)) return { file: callerFile, name: "inline", body: text };
    return null;
  }
  function injectedKeysFor(sourceFile) {
    if (injectedKeyCache.has(sourceFile)) return injectedKeyCache.get(sourceFile);
    const keys = new Map();
    injectedKeyCache.set(sourceFile, keys);
    if (!depsParameterOf(sourceFile)) return keys;
    for (const callerFile of callerFiles) {
      if (callerFile === sourceFile) continue;
      const callerSource = readSource(callerFile);
      for (const required of callerSource.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']+)["']\s*\)/g)) {
        if (!required[2].startsWith(".")) continue;
        const base = path.resolve(ROOT, path.dirname(callerFile), required[2]);
        const target = [base, `${base}.cjs`, `${base}.js`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!target || relativeFile(target) !== sourceFile) continue;
        const call = new RegExp(`\\b${required[1]}\\s*\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*`, "g");
        for (const site of callerSource.matchAll(call)) {
          const argumentStart = site.index + site[0].length;
          const callerDeps = depsParameterOf(callerFile);
          const passthrough = callerSource.slice(argumentStart).match(/^([A-Za-z_$][\w$]*)\s*\)/)?.[1];
          if (passthrough && passthrough === callerDeps) {
            for (const [key, value] of injectedKeysFor(callerFile)) if (!keys.has(key)) keys.set(key, value);
            continue;
          }
          if (callerSource[argumentStart] !== "{") continue;
          const close = closingBrace(callerSource, argumentStart);
          if (close < 0) continue;
          for (const entry of topLevelEntries(callerSource.slice(argumentStart + 1, close))) {
            const spread = entry.match(/^\.\.\.\s*([A-Za-z_$][\w$]*)$/);
            if (spread) {
              if (spread[1] === callerDeps) for (const [key, value] of injectedKeysFor(callerFile)) if (!keys.has(key)) keys.set(key, value);
              continue;
            }
            const shorthand = entry.match(/^([A-Za-z_$][\w$]*)$/);
            const pair = entry.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
            const key = shorthand?.[1] || pair?.[1];
            if (!key || keys.has(key)) continue;
            const resolved = resolveInCaller(callerFile, shorthand ? shorthand[1] : pair[2]);
            if (resolved) keys.set(key, resolved);
          }
        }
      }
    }
    return keys;
  }
  function injectedFunctionsFor(sourceFile) {
    if (injectedFunctionCache.has(sourceFile)) return injectedFunctionCache.get(sourceFile);
    const functions = new Map();
    injectedFunctionCache.set(sourceFile, functions);
    const depsName = depsParameterOf(sourceFile);
    if (!depsName) return functions;
    const keys = injectedKeysFor(sourceFile);
    const source = readSource(sourceFile);
    for (const [key, value] of keys) functions.set(`${depsName}.${key}`, value);
    for (const match of source.matchAll(new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*${depsName}\\b`, "g"))) {
      for (const declaration of topLevelEntries(match[1])) {
        const names = declaration.match(/^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?(?:\s*=[\s\S]*)?$/);
        if (names && keys.has(names[1])) functions.set(names[2] || names[1], keys.get(names[1]));
      }
    }
    for (const match of source.matchAll(new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${depsName}\\.([A-Za-z_$][\\w$]*)\\b`, "g"))) {
      if (keys.has(match[2])) functions.set(match[1], keys.get(match[2]));
    }
    return functions;
  }
  // The same function body is reached from hundreds of routes; scanning it for
  // every table each time is what made a full walk slow, not the walk.
  const bodyEvidenceCache = new Map();
  // What a body reaches that is not a table: Supabase Auth and Storage, and
  // Stripe. A sign-in has a data contract -- it is just held by the auth
  // service rather than by a table this repository created.
  const providerConstantCache = new Map();
  function providerConstantsFor(file) {
    if (!providerConstantCache.has(file)) {
      const constants = new Map();
      for (const match of readSource(file).matchAll(/(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`](https:\/\/api\.stripe\.com\/v1[^"'`]*)["'`]/g)) constants.set(match[1], match[2]);
      providerConstantCache.set(file, constants);
    }
    return providerConstantCache.get(file);
  }
  function providerEndpointsIn(file, body) {
    const code = withoutComments(String(body));
    const found = new Set();
    for (const match of code.matchAll(/\/auth\/v1\/([a-z_]+)/g)) found.add(`supabase_auth:${match[1]}`);
    for (const match of code.matchAll(/\/storage\/v1\/([a-z_]+)/g)) found.add(`supabase_storage:${match[1]}`);
    for (const match of code.matchAll(/api\.stripe\.com\/v1\/([a-z_]+)/g)) found.add(`stripe:${match[1]}`);
    for (const [name, value] of providerConstantsFor(file)) {
      for (const use of code.matchAll(new RegExp(`\\b${name}\\b(?:\\}\\/([a-z_]+))?`, "g"))) {
        const segment = use[1] || value.replace(/^https:\/\/api\.stripe\.com\/v1\/?/, "").split(/[/?]/)[0];
        if (segment) found.add(`stripe:${segment}`);
      }
    }
    return sorted(found);
  }
  function bodyEvidence(file, body) {
    const key = `${file}\u0000${body}`;
    if (!bodyEvidenceCache.has(key)) {
      bodyEvidenceCache.set(key, {
        tables: tablesReferencedByHandler(file, body),
        rpcs: rpcNamesIn(body),
        directInputs: extractReferences(body),
        providers: providerEndpointsIn(file, body),
        outbound: /(?:^|[^.$\w])(?:fetch|fetchImpl)\s*\(|\bhttps?\.request\s*\(/.test(withoutComments(String(body)))
      });
    }
    return bodyEvidenceCache.get(key);
  }
  // Bounds on the table tracer, both measured on 6 October 2026. At 40
  // functions and depth 5 -- the values this replaced -- the trace stopped
  // early on 352 and then 544 routes and said nothing. At 400 and 8 it stops on
  // none, and the generator takes the same twenty seconds. Either running out
  // is reported per route in `routesTruncatedByPersistenceTraceBudget`.
  const PERSISTENCE_TRACE_FUNCTION_BUDGET = 400;
  const PERSISTENCE_TRACE_DEPTH_LIMIT = 8;
  const persistenceTraceTruncatedRoutes = new Set();
  function localCallGraphPersistenceReferences(sourceFile, entrySource, routeId = null, entryBindings = new Map()) {
    if (!sourceFile) return { tables: [], rpcCalls: [], providerEndpoints: [], outbound: false, requestFields: { body: [], query: [], params: [] } };
    const seen = new Set();
    const found = new Set();
    const rpcCalls = new Set(rpcNamesIn(entrySource));
    const entryEvidence = bodyEvidence(sourceFile, String(entrySource));
    const providers = new Set(entryEvidence.providers);
    let outbound = entryEvidence.outbound;
    const requestFields = { body: new Set(), query: new Set(), params: new Set() };
    const ignored = new Set(["if", "for", "while", "switch", "catch", "return", "typeof", "new", "delete", "throw", "function", "class", "await", "super"]);
    function visit(file, source, depth, closureBindings = new Map()) {
      if (seen.size >= PERSISTENCE_TRACE_FUNCTION_BUDGET) {
        if (routeId) persistenceTraceTruncatedRoutes.add(routeId);
        return;
      }
      // A lookbehind, not a consumed character: `(^|[^.$\w])name\(` used up the
      // "(" before a nested call, so `Promise.resolve(handler(req))` never
      // reached `handler` and neither did any other call written directly
      // inside another one.
      const calls = /(?<![.$\w])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(/g;
      for (const match of source.matchAll(calls)) {
        const name = match[1];
        if (ignored.has(name)) continue;
        const localBody = localFunctionsFor(file).get(name);
        const binding = localBody === undefined ? closureBindings.get(name) || importedFunctionsFor(file).get(name) || injectedFunctionsFor(file).get(name) : null;
        const imported = localBody === undefined ? binding : null;
        const targetFile = imported?.file || file;
        const body = localBody === undefined ? imported?.body : localBody;
        const key = `${targetFile}:${name}`;
        if (body === undefined || seen.has(key)) continue;
        // Deeper than the limit, a callee that resolves is one this trace did
        // not read. Said, not skipped quietly.
        if (depth >= PERSISTENCE_TRACE_DEPTH_LIMIT) {
          if (routeId) persistenceTraceTruncatedRoutes.add(routeId);
          continue;
        }
        seen.add(key);
        const evidence = bodyEvidence(targetFile, body);
        const { tables, rpcs, directInputs } = evidence;
        for (const provider of evidence.providers) providers.add(provider);
        if (evidence.outbound) outbound = true;
        for (const table of tables) found.add(table);
        for (const name of rpcs) rpcCalls.add(name);
        for (const group of ["body", "query", "params"]) for (const field of directInputs[group]) requestFields[group].add(field);
        const passedRequestGroup = String(source).slice(match.index + match[0].length).match(/^\s*req\s*\??\.\s*(body|query|params)\b/)?.[1];
        if (passedRequestGroup) {
          const targetName = (imported?.name || name).split(".").pop();
          const signature = readSource(targetFile).match(new RegExp(`\\bfunction\\s+${targetName}\\s*\\(\\s*([A-Za-z_$][\\w$]*)`));
          if (signature) {
            const argument = signature[1];
            const fields = new RegExp(`\\b${argument}\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)`, "g");
            for (const field of body.matchAll(fields)) {
              if (field[1] === "toString" && /^\s*\(/.test(body.slice(field.index + field[0].length))) continue;
              requestFields[passedRequestGroup].add(field[1]);
            }
          }
        }
        const nextBindings = localBody !== undefined
          ? closureBindings
          : new Map([...closureBindings, ...(imported?.injectedFunctions || new Map())]);
        visit(targetFile, body, depth + 1, nextBindings);
      }
    }
    visit(sourceFile, String(entrySource), 0, entryBindings);
    return {
      tables: sorted(found),
      rpcCalls: sorted(rpcCalls),
      providerEndpoints: sorted(providers),
      outbound,
      requestFields: Object.fromEntries(Object.entries(requestFields).map(([group, fields]) => [group, sorted(fields)]))
    };
  }

  // Routes registered in a loop over a literal list --
  //   for (const [suffix, handler] of [["evidence", addEvidence], ...])
  //     app.post(`/initiatives/:id/${suffix}`, ..., (req, res) => handler(req, deps))
  // -- call a loop variable, which no name lookup resolves. The list is in the
  // source, so the tuple that produced this route is too: substitute each
  // tuple's literals into the registered path and keep the one that matches.
  // Only an exact match binds; a loop whose tuples cannot be told apart binds
  // nothing.
  function loopBindingsForRegistration(sourceFile, line, routeBlock, routePath) {
    const bindings = new Map();
    bindings.literals = new Map();
    if (!sourceFile || !line || !routeBlock) return bindings;
    const source = readSource(sourceFile);
    const offset = source.split("\n").slice(0, line - 1).join("\n").length;
    const registration = routeBlock.match(/^\s*app\.[a-z]+\s*\(/);
    if (!registration) return bindings;
    const pathExpression = callArguments(routeBlock, registration[0].length - 1)[0] || "";
    const literal = (text) => text?.match(/^["'`]([^"'`$]*)["'`]$/)?.[1];
    for (const loop of source.slice(0, offset).matchAll(/for\s*\(\s*const\s*\[([^\]]+)\]\s*of\s*\[/g)) {
      const arrayOpen = loop.index + loop[0].length - 1;
      const arrayClose = closingBracket(source, arrayOpen);
      if (arrayClose < 0) continue;
      const bodyOpen = source.slice(arrayClose).search(/\{/) + arrayClose;
      const bodyClose = closingBrace(source, bodyOpen);
      if (!(bodyOpen < offset && offset < bodyClose)) continue;
      const names = topLevelEntries(loop[1]);
      const matches = [];
      for (const tuple of topLevelEntries(source.slice(arrayOpen + 1, arrayClose))) {
        if (!tuple.startsWith("[")) continue;
        const elements = topLevelEntries(tuple.slice(1, tuple.lastIndexOf("]")));
        const values = new Map(names.map((name, index) => [name, literal(elements[index])]));
        const produced = values.has(pathExpression)
          ? values.get(pathExpression)
          : pathExpression.startsWith("`")
            ? pathExpression.slice(1, -1).replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name) => (values.get(name) ?? whole))
            : literal(pathExpression);
        if (produced === routePath) matches.push({ names, elements });
      }
      if (matches.length !== 1) continue;
      const { names: tupleNames, elements } = matches[0];
      tupleNames.forEach((name, index) => {
        const element = elements[index];
        if (!/^[A-Za-z_$][\w$]*$/.test(element || "")) return;
        const localBody = localFunctionsFor(sourceFile).get(element);
        const resolved = localBody !== undefined
          ? { file: sourceFile, name: element, body: localBody }
          : importedFunctionsFor(sourceFile).get(element) || injectedFunctionsFor(sourceFile).get(element);
        if (resolved) bindings.set(name, resolved);
      });
    }
    // And for a registration helper -- `function registerCatalogRoute(route,
    // handler) { app.get(route, (req, res) => handler(req, res)) }` -- whose
    // handler is whatever the caller passed. The call whose route argument
    // produces this path supplies the handler; an interpolation the source
    // cannot evaluate matches one path segment, and anything other than exactly
    // one matching call binds nothing.
    const enclosing = [];
    for (const head of source.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^()]*)\)\s*=>\s*\{)/g)) {
      const open = head.index + head[0].length - 1;
      if (open > offset) break;
      const close = closingBrace(source, open);
      if (close > offset) enclosing.push({ name: head[1] || head[3], parameters: (head[2] ?? head[4]).split(",").map((name) => name.trim().replace(/\s*=[\s\S]*$/, "")), open });
    }
    const helper = enclosing.sort((left, right) => right.open - left.open)[0];
    const routeParameter = helper ? helper.parameters.indexOf(pathExpression) : -1;
    if (helper && routeParameter >= 0) {
      const produces = (argument) => {
        const plain = literal(argument);
        if (plain !== undefined) return plain === routePath;
        if (!argument?.startsWith("`")) return false;
        const pattern = argument.slice(1, -1).split(/\$\{[^}]*\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+");
        return new RegExp(`^${pattern}$`).test(routePath);
      };
      const calls = [...source.matchAll(new RegExp(`(?<![.$\\w])${escapeRegExp(helper.name)}\\s*\\(`, "g"))]
        .map((call) => callArguments(source, call.index + call[0].length - 1))
        .filter((args) => produces(args[routeParameter]));
      if (calls.length === 1) {
        helper.parameters.forEach((name, index) => {
          const argument = calls[0][index];
          if (!name || !argument || index === routeParameter) return;
          if (/^(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(argument)) {
            bindings.set(name, { file: sourceFile, name: "inline", body: argument });
            return;
          }
          if (!/^[A-Za-z_$][\w$]*$/.test(argument)) return;
          const localBody = localFunctionsFor(sourceFile).get(argument);
          const resolved = localBody !== undefined
            ? { file: sourceFile, name: argument, body: localBody }
            : importedFunctionsFor(sourceFile).get(argument) || injectedFunctionsFor(sourceFile).get(argument);
          if (resolved) bindings.set(name, resolved);
        });
      }
    }

    // The same for `ENTRIES.forEach((value, key) => app.get(key, ...))` over a
    // literal `const ENTRIES = new Map([[path, { table: "..." }], ...])`. The
    // entry whose key is this route's path supplies the literal properties its
    // handler reads, so `resource.table` is read as the table it names.
    bindings.literals = new Map();
    for (const loop of source.slice(0, offset).matchAll(/\b([A-Z][A-Z0-9_]*)\.forEach\(\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\{/g)) {
      const bodyOpen = loop.index + loop[0].length - 1;
      const bodyClose = closingBrace(source, bodyOpen);
      if (!(bodyOpen < offset && offset < bodyClose) || pathExpression !== loop[3]) continue;
      const declaration = source.match(new RegExp(`const\\s+${loop[1]}\\s*=\\s*new\\s+Map\\(\\s*\\[`));
      if (!declaration) continue;
      const arrayOpen = declaration.index + declaration[0].length - 1;
      const arrayClose = closingBracket(source, arrayOpen);
      for (const entry of topLevelEntries(source.slice(arrayOpen + 1, arrayClose))) {
        if (!entry.startsWith("[")) continue;
        const [key, value] = topLevelEntries(entry.slice(1, entry.lastIndexOf("]")));
        if (literal(key) !== routePath || !value?.startsWith("{")) continue;
        for (const property of topLevelEntries(value.slice(1, value.lastIndexOf("}")))) {
          const pair = property.match(/^([A-Za-z_$][\w$]*)\s*:\s*(["'`][^"'`$]*["'`])$/);
          if (pair) bindings.literals.set(`${loop[2]}.${pair[1]}`, pair[2]);
        }
      }
    }
    return bindings;
  }
  function closingBracket(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = openIndex; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
      if (char === "[") depth += 1;
      else if (char === "]" && --depth === 0) return index;
    }
    return -1;
  }

  const registrationRecords = captureLiveRoutes();
  const registryByRoute = new Map(ROUTE_REGISTRY.map((entry) => [`${entry.method.toUpperCase()} ${entry.route}`, entry]));
  const rawRoutes = registrationRecords.map((record) => {
    const method = record.method;
    const routePath = record.path;
    const routeEntry = registryByRoute.get(`${method} ${routePath}`) || null;
    const sourceFile = record.source.file || null;
    const handlers = record.layer.route.stack.map((item) => unwrapHandler(item.handle));
    const handlerSources = record.registeredHandlerSources || handlers.map((handler) => String(handler));
    const routeBlock = sourceBlockForRoute(sourceFile, record.source.line);
    const handlerSource = handlerSources.join("\n");
    const namedHandlerBodies = (record.registeredHandlerNames || []).map((name) =>
      sourceFile ? localFunctionsFor(sourceFile).get(name) : null).filter(Boolean);
    const evidenceSource = [handlerSource, routeBlock, ...namedHandlerBodies].filter(Boolean).join("\n");
    const inputs = extractReferences(evidenceSource);
    inputs.pathParams = [...routePath.matchAll(/:([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
    const literalRegistration = routeBlock.match(/^\s*app\.(get|post|put|patch|delete|head|options|all)\s*\(\s*["']([^"']+)["']/);
    const routeBlockIsEndpointSpecific = Boolean(literalRegistration && literalRegistration[1].toUpperCase() === method && literalRegistration[2] === routePath);
    const tableEvidenceSource = routeBlockIsEndpointSpecific ? evidenceSource : [handlerSource, ...namedHandlerBodies].join("\n");
    const handlerEntrySource = (record.registeredHandlerNames || []).filter((name) => name && name !== "anonymous").map((name) => `${name}()`).join("\n");
    const loopBindings = routeBlockIsEndpointSpecific ? Object.assign(new Map(), { literals: new Map() }) : loopBindingsForRegistration(sourceFile, record.source.line, routeBlock, routePath);
    // A property bound from the loop's literal entry is substituted in place,
    // so `supabaseList(config, resource.table)` reads as the table it names.
    let boundEvidenceSource = tableEvidenceSource;
    for (const [expression, value] of loopBindings.literals) {
      boundEvidenceSource = boundEvidenceSource.replace(new RegExp(`\\b${expression.split(".").map(escapeRegExp).join("\\s*\\.\\s*")}\\b`, "g"), value);
    }
    const graphEvidence = localCallGraphPersistenceReferences(sourceFile, [handlerEntrySource, boundEvidenceSource].filter(Boolean).join("\n"), `${method} ${routePath}`, loopBindings);
    for (const group of ["body", "query", "params"]) {
      inputs[group] = sorted([...inputs[group], ...graphEvidence.requestFields[group]]);
    }
    const directTables = sourceFile ? sorted([
      ...tablesReferencedByHandler(sourceFile, boundEvidenceSource),
      ...graphEvidence.tables
    ]) : [];
    const routeKey = `${method} ${routePath}`;
    return {
      id: routeKey,
      method,
      route: routePath,
      kind: routePath.startsWith("/api/webhooks/") || /\/webhook(?:s)?$/.test(routePath) ? "webhook" : routePath.startsWith("/api/") ? "api" : method === "GET" ? "page_or_download" : "form_or_action",
      source: record.source,
      handlerNames: record.registeredHandlerNames || record.layer.route.stack.map((item) => item.name || "anonymous"),
      inputs,
      response: responseContract(record.layer, routePath, evidenceSource),
      openApi: openApiByOperation.get(`${method} ${routePath}`) || null,
      routeRegistry: routeEntry ? {
        title: routeEntry.title,
        productOwner: routeEntry.productOwner,
        visibility: routeEntry.visibility,
        requiredRole: routeEntry.requiredRole,
        requiredPlan: routeEntry.requiredPlan,
        requiredProvider: routeEntry.requiredProvider,
        readiness: routeEntry.readiness,
        navigationPlacement: routeEntry.navigationPlacement
      } : null,
      workspace: workspaceFor(routePath, routeEntry, sourceFile),
      directTableReferences: directTables,
      rpcCalls: sorted([...rpcNamesIn(tableEvidenceSource), ...graphEvidence.rpcCalls]),
      providerEndpoints: graphEvidence.providerEndpoints,
      outboundCallObserved: graphEvidence.outbound,
      tableEvidenceLevel: routeBlockIsEndpointSpecific && directTables.length ? "literal_route_and_local_helper_evidence" : handlerSource && directTables.length ? "registered_handler_reference" : null,
      handlerSource,
      registrationSource: routeBlock,
      moduleTableNames: sourceFile ? null : []
    };
  });

  for (const route of rawRoutes) {
    if (!route.source.file) continue;
    if (!moduleTables.has(route.source.file)) moduleTables.set(route.source.file, referencesIn(readSource(route.source.file)));
    route.moduleTableNames = moduleTables.get(route.source.file);
  }
  const dataModules = [...moduleTables.entries()].map(([file, names]) => ({
    id: `module:${file}`,
    source: file,
    tableCount: names.length,
    tables: names.map((name) => ({ table: name, migrations: migrationByTable.get(name)?.createdBy || [] }))
  })).sort((a, b) => a.source.localeCompare(b.source));

  const getRoutes = rawRoutes.filter((route) => route.method === "GET");
  const getPageRoutes = getRoutes.filter((route) => !route.route.startsWith("/api/") && route.kind !== "webhook");
  const routeIds = new Set(rawRoutes.map((route) => route.id));
  const pageCandidateText = new Map(getPageRoutes.map((route) => [route.route, route.registrationSource || route.handlerSource]));
  const formActionPages = new Map();
  const formActionFields = new Map();
  // How many resolved function bodies the form walk may follow for one page.
  //
  // It was 40, and 40 silently changed the answer. Measured on 1 October 2026,
  // after lib/sonara-comment-stripping.cjs stopped swallowing string literals:
  // at 40 this file recorded 50 UI form links, and three of them were different
  // from the three it had recorded the day before -- the billing checkout, the
  // billing portal and the employee invite dropped out, because the walk now
  // sees more resolvable names and spent its forty on other branches first. At
  // 120 all three come back and the total is 53. At 400 it is still 53, so it
  // saturates well below this value, and the generator takes the same twenty
  // seconds at 40 as at 400.
  //
  // And it was not three pages. With the reporting below in place and the budget
  // put back to 40, the walk runs out on **41 of the 286 declared pages** --
  // /account, /business-builder/billing, /business-builder/checklist and
  // thirty-eight more. So the old number was not a performance decision, it was
  // an undisclosed truncation across a seventh of the application: which forms
  // got recorded depended on which names the scanner happened to resolve first,
  // and nothing in the output said a page had been cut short.
  //
  // The bound stays, because an unbounded walk over a call graph is how this
  // takes minutes on a bad day. What changes is that binding it is now visible:
  // `pagesTruncatedByFormWalkBudget` in the summary counts the pages where it
  // ran out, and tests/the-form-walk-says-when-it-gave-up.test.js fails if that
  // count is not zero.
  const FORM_WALK_FUNCTION_BUDGET = 400;
  const FORM_WALK_DEPTH_LIMIT = 4;
  const formWalkTruncatedPages = new Set();
  // An action written through an escaping call -- `action="${escape(`/api/x/${id}/follow`)}"`
  // or `action="${escape(`${base}/follow`)}"` with `const base = `/api/x/${id}``
  // declared beside it -- is the same action as one written out. Only those two
  // shapes are read: a template literal inside one call, starting with "/" or with
  // a constant declared as a string in the same function or file.
  function escapedFormAction(tag, code, file) {
    const wrapped = tag.match(/\baction\s*=\s*(["'])\$\{\s*[A-Za-z_$][\w$.]*\(\s*`((?:\$\{[^{}]*\}|[^`$]|\$(?!\{))*)`\s*\)\s*\}\1/i);
    if (!wrapped) return null;
    let inner = wrapped[2];
    const lead = inner.match(/^\$\{\s*([A-Za-z_$][\w$]*)\s*\}/);
    if (lead) {
      const declaration = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(lead[1])}\\s*=\\s*(?:\`((?:\\$\\{[^{}]*\\}|[^\`$]|\\$(?!\\{))*)\`|"([^"]*)"|'([^']*)')`);
      const found = String(code).match(declaration) || readSource(file).match(declaration);
      if (!found) return null;
      inner = (found[1] ?? found[2] ?? found[3]) + inner.slice(lead[0].length);
    }
    return inner.startsWith("/") ? inner : null;
  }
  // Markup held in a module-level constant -- `const LOCAL_IMAGE_FORM = \`<form
  // ...><script src="/creator-device-access.js">\`` -- and referenced by name.
  // The walk followed calls only, so a form or a script tag kept in a constant
  // was invisible to every page that rendered it. Only constants written at
  // column 0 as a string or template literal that contains markup are kept.
  const markupConstantCache = new Map();
  function markupConstantsFor(file) {
    if (markupConstantCache.has(file)) return markupConstantCache.get(file);
    const source = readSource(file);
    const constants = new Map();
    for (const head of source.matchAll(/^const ([A-Za-z_$][\w$]*)\s*=\s*([`"'])/gm)) {
      const quote = head[2];
      const start = head.index + head[0].length;
      let depth = 0;
      let end = -1;
      for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (char === "\\") { index += 1; continue; }
        if (quote === "`" && char === "$" && source[index + 1] === "{") { depth += 1; index += 1; continue; }
        if (quote === "`" && depth > 0 && char === "}") { depth -= 1; continue; }
        if (char === quote && depth === 0) { end = index; break; }
      }
      if (end < 0) continue;
      const text = source.slice(start, end);
      if (/<(?:form|script)\b/i.test(text)) constants.set(head[1], { text, reference: new RegExp(`(?<![.$\\w])${escapeRegExp(head[1])}(?![\\w$])`) });
    }
    markupConstantCache.set(file, constants);
    return constants;
  }
  function formActionsForPage(page) {
    const found = new Map();
    const scripts = new Set();
    const seen = new Set();
    function visit(file, source, depth, closureBindings = new Map()) {
      if (seen.size >= FORM_WALK_FUNCTION_BUDGET) {
        formWalkTruncatedPages.add(page.route);
        return;
      }
      if (depth > FORM_WALK_DEPTH_LIMIT) return;
      const code = withoutComments(String(source));
      for (const match of code.matchAll(/<form\b[^>]*>/gi)) {
        // An interpolated id can carry its own quotes -- `${encodeURIComponent(String(row.id || ""))}` --
        // and stopping at the first one read the action as ending mid-expression.
        const action = match[0].match(/\baction\s*=\s*(["'])(\/(?:\$\{[^{}]*\}|(?!\1)[^\\$]|\$(?!\{))+)\1/i)?.[2]
          || escapedFormAction(match[0], code, file);
        if (!action) continue;
        const method = (match[0].match(/\bmethod\s*=\s*["'](get|post|patch|delete)["']/i)?.[1] || "GET").toUpperCase();
        const operation = `${method} ${action.replace(/\$\{[^}]+\}/g, ":parameter").split("?")[0]}`;
        if (!found.has(operation)) found.set(operation, new Set());
        const closing = code.indexOf("</form>", match.index + match[0].length);
        if (closing < 0 || closing - match.index > 12000) continue;
        const fragment = code.slice(match.index, closing);
        for (const field of fragment.matchAll(/<(?:input|select|textarea)\b[^>]*\bname\s*=\s*["']([^"']+)["']/gi)) {
          found.get(operation).add(field[1]);
        }
      }
      // Scripts the page loads: a route called only from one of these has this
      // page as its screen.
      for (const script of code.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](\/[^"'?#]+\.js)/gi)) scripts.add(script[1]);
      // A lookbehind, not a consumed character: `(^|[^.$\w])name\(` used up the
      // "(" before a nested call, so `Promise.resolve(handler(req))` never
      // reached `handler` and neither did any other call written directly
      // inside another one.
      const calls = /(?<![.$\w])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(/g;
      for (const match of code.matchAll(calls)) {
        const name = match[1];
        const localBody = localFunctionsFor(file).get(name);
        const imported = localBody === undefined ? closureBindings.get(name) || importedFunctionsFor(file).get(name) || injectedFunctionsFor(file).get(name) : null;
        const targetFile = imported?.file || file;
        const body = localBody === undefined ? imported?.body : localBody;
        const key = `${targetFile}:${name}`;
        if (body === undefined || seen.has(key)) continue;
        seen.add(key);
        const bindings = localBody !== undefined ? closureBindings : new Map([...closureBindings, ...(imported?.injectedFunctions || new Map())]);
        visit(targetFile, body, depth + 1, bindings);
      }
      for (const [name, constant] of markupConstantsFor(file)) {
        const key = `${file}:const:${name}`;
        if (seen.has(key) || !constant.reference.test(code)) continue;
        seen.add(key);
        visit(file, constant.text, depth + 1, closureBindings);
      }
    }
    const handlerNames = (page.handlerNames || []).filter((name) => name && name !== "anonymous").map((name) => `${name}()`);
    visit(page.source.file, [...handlerNames, page.handlerSource, page.registrationSource].filter(Boolean).join("\n"), 0);
    return { forms: [...found.entries()].map(([operation, fields]) => ({ operation, fields: sorted(fields) })), scripts };
  }
  const scriptPages = new Map();
  for (const page of getPageRoutes) {
    const walked = formActionsForPage(page);
    for (const script of walked.scripts) {
      if (!scriptPages.has(script)) scriptPages.set(script, new Set());
      scriptPages.get(script).add(page.route);
    }
    for (const { operation, fields } of walked.forms) {
      if (!formActionPages.has(operation)) formActionPages.set(operation, new Set());
      formActionPages.get(operation).add(page.route);
      if (!formActionFields.has(operation)) formActionFields.set(operation, new Set());
      for (const field of fields) formActionFields.get(operation).add(field);
    }
  }
  const uiFormActionLinks = [...formActionPages.entries()].map(([operation, pages]) => ({
    method: operation.slice(0, operation.indexOf(" ")),
    action: operation.slice(operation.indexOf(" ") + 1),
    pages: sorted(pages),
    formFieldNamesObserved: sorted(formActionFields.get(operation) || [])
  })).sort((a, b) => a.action.localeCompare(b.action) || a.method.localeCompare(b.method));

  const homeByWorkspace = {
    business_builder: BUSINESS_HOME,
    business_builder_agent_ops: "/owner/agent-activity",
    creator_studio: CREATOR_HOME,
    growth_studio: GROWTH_HOME,
    admin_operations: "/admin",
    research_lab: "/research-lab/open-source",
    research_catalog: "/research-lab/open-source",
    shared_infrastructure: "/infrastructure",
    cross_workspace_formulas: "/formulas",
    shared_account: "/account",
    sonara_shared_api: "/dashboard",
    sonara_shared: "/dashboard"
  };
  // Path segments agree when they are equal or when either side is a
  // parameter: a literal "module_output" fills a route's ":resourceType".
  const pathSegmentsAgree = (left, right) => {
    const a = normalizeRouteParams(String(left).split(/[?#]/)[0]).split("/");
    const b = normalizeRouteParams(String(right).split(/[?#]/)[0]).split("/");
    return a.length === b.length && a.every((segment, index) => segment === b[index] || segment === ":parameter" || b[index] === ":parameter");
  };
  // The pages whose forms post to this route, the route's own parameters
  // accepting whatever literal a form fills them with.
  function formPagesFor(route) {
    const pages = new Set();
    const own = normalizeRouteParams(route.route).split("/");
    for (const [operation, set] of formActionPages) {
      const method = operation.slice(0, operation.indexOf(" "));
      const action = operation.slice(operation.indexOf(" ") + 1).split("/");
      if (method !== route.method || action.length !== own.length) continue;
      if (action.every((segment, index) => segment === own[index] || own[index] === ":parameter")) for (const page of set) pages.add(page);
    }
    return pages;
  }
  // Where the handler sends a browser back to: `res.redirect(303, `${back}?...`)`
  // with `const back = `/business-builder/owner/purchase-orders/${id}`` beside it.
  function redirectTargetsFor(route) {
    const source = withoutComments([route.handlerSource, route.registrationSource].filter(Boolean).join("\n"));
    const declared = (name) => {
      const pattern = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*(?:\`([^\`]*)\`|"([^"]*)"|'([^']*)')`);
      const found = source.match(pattern)
        || (route.source.file ? readSource(route.source.file).match(pattern) : null);
      return found ? (found[1] ?? found[2] ?? found[3]) : null;
    };
    const targets = new Set();
    for (const call of source.matchAll(/\bres\.redirect\(\s*(?:\d+\s*,\s*)?(`[^`]*`|"[^"]*"|'[^']*'|[A-Za-z_$][\w$]*)/g)) {
      let target = /^[`"']/.test(call[1]) ? call[1].slice(1, -1) : declared(call[1]);
      if (!target) continue;
      const lead = target.match(/^\$\{\s*([A-Za-z_$][\w$]*)\s*\}/);
      if (lead) {
        const base = declared(lead[1]);
        if (!base) continue;
        target = base + target.slice(lead[0].length);
      }
      if (target.startsWith("/")) targets.add(target.replace(/\$\{[^}]*\}/g, ":parameter").split(/[?#]/)[0]);
    }
    return [...targets];
  }
  // The pages that load a script in public/ which calls this route.
  const publicScripts = (() => {
    const directory = path.join(ROOT, "public");
    if (!fs.existsSync(directory)) return [];
    // `"/api/calls/" + encodeURIComponent(callId) + "/signals"` is the path
    // /api/calls/:callId/signals written in pieces, which is how
    // public/sonara-call.js builds every one of its requests. Joined into one
    // path so the matcher below can see it.
    const joinConcatenatedPaths = (code) => code.replace(/(["'])\s*\+\s*[^"'`;\n]{1,120}?\s*\+\s*(["'])/g, ":parameter");
    return fs.readdirSync(directory).filter((name) => name.endsWith(".js")).sort()
      .map((name) => ({ src: `/${name}`, code: joinConcatenatedPaths(withoutComments(fs.readFileSync(path.join(directory, name), "utf8"))) }));
  })();
  function scriptPagesFor(route) {
    const pattern = new RegExp(`${route.route.split("/").map((segment) => (segment.startsWith(":") ? "[^/\"'\`\\s]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}(?![\\w/-])`);
    const pages = new Set();
    for (const script of publicScripts) {
      if (!pattern.test(script.code)) continue;
      for (const page of scriptPages.get(script.src) || []) pages.add(page);
    }
    return pages;
  }
  // One screen from several: the page the handler redirects back to, else the
  // page the others sit under, else every page, listed.
  function destinationAmong(route, pages, reason) {
    const list = sorted(pages);
    if (list.length === 1) return { route: list[0], confidence: "form_reference", reason };
    const targets = redirectTargetsFor(route);
    const redirected = list.filter((page) => targets.some((target) => pathSegmentsAgree(page, target)));
    if (redirected.length === 1) return { route: redirected[0], confidence: "form_reference", reason: `${reason}_and_redirect_target`, pages: list };
    const parent = list.find((page) => list.every((other) => other === page || other.startsWith(`${page}/`)));
    if (parent) return { route: parent, confidence: "form_reference", reason: `${reason}_on_a_page_and_those_under_it`, pages: list };
    return { route: list[0], confidence: "form_reference", reason: `${reason}_on_several_pages`, pages: list };
  }
  // Doors a shared handler renders only for the pages that declare them.
  //
  // The record detail page is one handler registered for every record kind
  // with a page of its own, and it renders the share card only where the kind
  // declares `shareableAs` and the publish card only where it declares
  // `publishHandle`. The workspace page handler renders saved-result share
  // controls only on a `free_records` page. Source is identical for every page
  // such a handler serves, so reading source credited the publish form to all
  // thirteen record pages and the share form to every workspace page -- and the
  // first of those alphabetically was reported as the destination: the publish
  // form "on" the bookings page, which has never shown it.
  //
  // The declarations decide, so the declarations are read. Held from both sides
  // by map.validation.declaredDoorsNotRendered: a door route that is not
  // registered, a declared page that is not registered (which is the defect
  // that left quotes, bookings and artist profiles with a door and no page),
  // and a declared page whose source does not render the form all fail.
  const declaredDoors = (() => {
    const records = require(path.join(ROOT, "lib", "sonara-owner-record-pages.cjs"));
    const { createProductPages } = require(path.join(ROOT, "lib", "sonara-product-pages.cjs"));
    const productPages = createProductPages({ linkAction: () => "", logoutAction: () => "" });
    const workspacePages = ["business-builder", "creator-studio", "growth-studio"]
      .flatMap((slug) => Object.values(productPages.getProductPageDefinitions(slug)).flat());
    const recordPagesWhere = (predicate) => [...records.ALL_OWNER_PAGES, ...records.CREATOR_RECORD_PAGES]
      .filter(predicate).map((page) => `${page.path}/:recordId`);
    const doors = [
      {
        routes: ["POST /api/creator-profiles/:id/publish", "POST /api/creator-profiles/:id/unpublish"],
        pages: recordPagesWhere((page) => page.publishHandle)
      },
      {
        routes: ["POST /api/shared-links/:resourceType/:id/share", "POST /api/shared-links/:resourceType/:id/revoke"],
        pages: [
          ...recordPagesWhere((page) => page.shareableAs),
          ...workspacePages.filter((page) => page.module === "free_records").map((page) => page.path)
        ]
      },
      // The detail handler renders these two cards by table rather than by a
      // declared field: `page.table === "purchase_orders"` and
      // `page.table === "business_work_orders"` in routes/sonara-last9-routes.cjs.
      {
        routes: ["POST /api/business/purchase-orders/:recordId/approval"],
        pages: recordPagesWhere((page) => page.table === "purchase_orders")
      },
      {
        routes: ["POST /api/business/work-orders/:workOrderId/transition", "POST /api/business/work-orders/:workOrderId/invoice", "POST /api/business/work-orders/:workOrderId/repeat"],
        pages: recordPagesWhere((page) => page.table === "business_work_orders")
      }
    ];
    return Object.assign(new Map(doors.flatMap((door) => door.routes.map((id) => [id, door.pages]))), {
      recordDetailPages: recordPagesWhere((page) => records.hasDetailPage(page))
    });
  })();
  // Growth Studio's record pages, read from their declarations rather than
  // paired by name. Each page in lib/sonara-growth-record-pages.cjs names the
  // table it lists (`tableKey`), and the route file renders the create form of
  // the spec in lib/sonara-growth-create-specs.cjs for the same table, posting
  // to /api/growth/<spec.key>. Pairing by name found /growth-studio/segments
  // for /api/growth/segments and missed /growth-studio/consent for
  // /api/growth/consents -- a singular page name -- so the permission form a
  // campaign depends on was reported as having no screen.
  //
  // Held by map.validation.growthRecordDoorsNotHeld: the page and the route are
  // registered, a GET reads the page's table and a POST writes it, and every
  // create spec has a page. A declaration the code stopped honouring fails.
  const growthRecordDoors = (() => {
    const { GROWTH_RECORD_PAGES } = require(path.join(ROOT, "lib", "sonara-growth-record-pages.cjs"));
    const { GROWTH_CREATE_SPECS } = require(path.join(ROOT, "lib", "sonara-growth-create-specs.cjs"));
    const { GROWTH_TABLES } = require(path.join(ROOT, "lib", "sonara-growth-tables.cjs"));
    const doors = new Map();
    for (const page of GROWTH_RECORD_PAGES) {
      const table = GROWTH_TABLES[page.tableKey];
      doors.set(`GET /api/growth/${page.tableKey}`, { page: page.path, table, reason: "growth_record_page_lists_its_table", optional: true });
      for (const spec of GROWTH_CREATE_SPECS.filter((candidate) => candidate.tableKey === page.tableKey)) {
        doors.set(`POST /api/growth/${spec.key}`, { page: page.path, table, reason: "growth_record_page_renders_its_create_form" });
      }
    }
    const pagedTables = new Set(GROWTH_RECORD_PAGES.map((page) => page.tableKey));
    return Object.assign(doors, {
      pageCount: GROWTH_RECORD_PAGES.length,
      specsWithoutPage: GROWTH_CREATE_SPECS.filter((spec) => !pagedTables.has(spec.tableKey)).map((spec) => spec.key)
    });
  })();
  function growthRecordDoor(route) {
    const door = growthRecordDoors.get(route.id);
    if (!door) return null;
    return { route: door.page, confidence: "route_pair", reason: door.reason, table: door.table };
  }
  function growthRecordDoorProblems() {
    const problems = [];
    if (growthRecordDoors.pageCount < 5 || growthRecordDoors.size < 5) problems.push(`only ${growthRecordDoors.pageCount} growth record pages and ${growthRecordDoors.size} doors were read, so this check has gone blind`);
    for (const key of growthRecordDoors.specsWithoutPage) problems.push(`POST /api/growth/${key}: a create form is described and no growth record page lists its table, so nothing renders it`);
    for (const [id, door] of growthRecordDoors) {
      const raw = rawRoutes.find((candidate) => candidate.id === id);
      if (!raw) {
        if (!door.optional) problems.push(`${id}: described as a create form and not a registered route`);
        continue;
      }
      if (!rawRoutes.some((candidate) => candidate.id === `GET ${door.page}`)) problems.push(`${id}: ${door.page} is not a registered page`);
      if (!door.table) problems.push(`${id}: ${door.page} names a table key GROWTH_TABLES does not have`);
      else if (!(raw.directTableReferences || []).includes(door.table)) problems.push(`${id}: does not touch ${door.table}, the table ${door.page} lists`);
    }
    return problems;
  }
  function declaredDoorProblems() {
    const problems = [];
    // The other side. A form the source credits to every record detail page is
    // a card the one detail handler renders for some of them, and which ones is
    // a declaration this list has to carry -- otherwise the next such card is
    // credited to all thirteen pages, and the first of them alphabetically is
    // reported as where it lives.
    const detailPages = declaredDoors.recordDetailPages;
    if (detailPages.length < 2) problems.push(`only ${detailPages.length} record detail pages were found, so the check for undeclared doors has gone blind`);
    const declaredOperations = new Set([...declaredDoors.keys()].map((id) => `${id.slice(0, id.indexOf(" "))} ${normalizeRouteParams(id.slice(id.indexOf(" ") + 1))}`));
    for (const [operation, pages] of formActionPages) {
      if (detailPages.length < 2 || !detailPages.every((page) => pages.has(page))) continue;
      if (!declaredOperations.has(operation)) problems.push(`${operation}: credited to every record detail page, and no declared door says which ones render it`);
    }
    for (const [id, pages] of declaredDoors) {
      if (!routeIds.has(id)) {
        problems.push(`${id}: not a registered route`);
        continue;
      }
      if (!pages.length) problems.push(`${id}: no page declares this door, so this check has gone blind`);
      const [method, routePath] = [id.slice(0, id.indexOf(" ")), id.slice(id.indexOf(" ") + 1)];
      const rendered = formPagesFor({ method, route: routePath });
      for (const page of pages) {
        if (!routeIds.has(`GET ${page}`)) problems.push(`${id}: declared on ${page}, which is not a registered page`);
        else if (!rendered.has(page)) problems.push(`${id}: declared on ${page}, whose handler source does not render it`);
      }
    }
    return problems;
  }
  // Routes whose screen is not a page, each with evidence checked below. See
  // lib/sonara-route-destination-reviews.cjs for the kinds and what each must
  // prove.
  const { KINDS: DESTINATION_REVIEW_KINDS, ROUTE_DESTINATION_REVIEWS } = require(path.join(ROOT, "lib", "sonara-route-destination-reviews.cjs"));
  const destinationReviewByRoute = new Map(ROUTE_DESTINATION_REVIEWS.map((entry) => [entry.route, entry]));
  const destinationReviewsUsed = new Set();
  function reviewedDestination(route) {
    const reviewed = destinationReviewByRoute.get(route.id);
    if (!reviewed) return null;
    destinationReviewsUsed.add(route.id);
    if (reviewed.kind === "json_form_of_page") return { route: reviewed.page, confidence: "route_pair", reason: "json_form_of_page", evidence: reviewed.evidence };
    if (reviewed.kind === "json_form_of_action") {
      const action = rawRoutes.find((candidate) => candidate.id === reviewed.action);
      const page = action ? pageForAction(action) : null;
      if (page?.route && !["workspace_fallback", "no_user_page"].includes(page.confidence)) {
        return { route: page.route, confidence: "route_pair", reason: "json_form_of_action", action: reviewed.action, evidence: reviewed.evidence };
      }
      return null;
    }
    if (reviewed.kind === "linked_evidence") return { route: reviewed.page, confidence: "static_page_link", reason: reviewed.kind, consumers: reviewed.consumers };
    return { route: null, confidence: "reviewed_no_page", reason: reviewed.kind, consumers: reviewed.consumers || [] };
  }
  function destinationReviewProblems() {
    const problems = [];
    if (ROUTE_DESTINATION_REVIEWS.length < 5) problems.push(`only ${ROUTE_DESTINATION_REVIEWS.length} destination reviews were read, so this check has gone blind`);
    const callsRoute = (text, routePath) => new RegExp(`${routePath.split("/").map((segment) => (segment.startsWith(":") ? "[^/\"'\`\\s]+" : escapeRegExp(segment))).join("/")}(?![\\w/-])`).test(text);
    for (const entry of ROUTE_DESTINATION_REVIEWS) {
      if (!DESTINATION_REVIEW_KINDS[entry.kind]) { problems.push(`${entry.route}: unknown kind ${entry.kind}`); continue; }
      const raw = rawRoutes.find((candidate) => candidate.id === entry.route);
      if (!raw) { problems.push(`${entry.route}: not a registered route`); continue; }
      if (!destinationReviewsUsed.has(entry.route)) problems.push(`${entry.route}: the generator places it on a page without this entry, so the entry is not needed`);
      if (["monitor", "scheduler", "linked_evidence"].includes(entry.kind) && !(entry.consumers || []).length) problems.push(`${entry.route}: names no consumer`);
      for (const consumer of entry.consumers || []) {
        const file = path.join(ROOT, consumer);
        if (!fs.existsSync(file)) problems.push(`${entry.route}: ${consumer} does not exist`);
        else if (!callsRoute(fs.readFileSync(file, "utf8"), raw.route)) problems.push(`${entry.route}: ${consumer} does not call it`);
      }
      if (entry.kind === "linked_evidence" && !fs.existsSync(path.join(ROOT, "public", String(entry.page || "").replace(/^\//, "")))) {
        problems.push(`${entry.route}: ${entry.page} is not a page in public/`);
      }
      if (entry.kind === "json_form_of_page") {
        const page = rawRoutes.find((candidate) => candidate.id === `GET ${entry.page}`);
        if (!page) problems.push(`${entry.route}: ${entry.page} is not a registered page`);
        else if (entry.evidence?.table) {
          for (const [label, subject] of [["the route", raw], ["the page", page]]) {
            if (!(subject.directTableReferences || []).includes(entry.evidence.table)) problems.push(`${entry.route}: ${label} does not read ${entry.evidence.table}, so it is not the JSON form of ${entry.page}`);
          }
        } else if (entry.evidence?.function) {
          const call = new RegExp(`\\b${escapeRegExp(entry.evidence.function)}\\s*\\(`);
          for (const [label, subject] of [["the route", raw], ["the page", page]]) {
            const direct = call.test(String(subject.handlerSource || ""));
            // A page may delegate to a shared renderer that actually performs
            // the same read as its JSON endpoint. Make that indirection an
            // explicit, falsifiable review instead of inventing a direct call.
            let viaRenderer = false;
            if (!direct && label === "the page" && entry.evidence?.function) {
              const file = subject.source?.file;
              const handler = String(subject.handlerSource || "");
              // Infer real page->renderer calls from source rather than
              // writing extra unverified metadata into the review registry.
              // The canonical capability inventory output therefore stays
              // stable while the evidence checker gets more stringent.
              if (typeof file === "string" && file.startsWith("routes/")
                  && file === raw.source?.file) {
                const sourceText = fs.readFileSync(path.join(ROOT, file), "utf8");
                const invocations = handler.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(\s*req\s*,\s*res\s*,\s*["']([a-z_]+)["']/g);
                for (const invocation of invocations) {
                  const renderer = invocation[1];
                  const declaration = new RegExp("\\b(?:async\\s+)?function\\s+" + escapeRegExp(renderer) + "\\s*\\(");
                  const found = declaration.exec(sourceText);
                  if (!found) continue;
                  const rest = sourceText.slice(found.index + found[0].length);
                  const nextFunction = /\n  (?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(rest);
                  const rendererBody = nextFunction ? rest.slice(0, nextFunction.index) : rest;
                  if (call.test(rendererBody)) { viaRenderer = true; break; }
                }
              }
            }
            if (!direct && !viaRenderer) problems.push(`${entry.route}: ${label} does not call ${entry.evidence.function} (directly or by the reviewed renderer), so it is not the JSON form of ${entry.page}`);
          }
        } else problems.push(`${entry.route}: gives no evidence that it is the JSON form of ${entry.page}`);
      }
      if (entry.kind === "json_form_of_action") {
        const action = rawRoutes.find((candidate) => candidate.id === entry.action);
        if (!action) problems.push(`${entry.route}: ${entry.action} is not a registered route`);
        else {
          const page = pageForAction(action);
          if (!page.route || ["workspace_fallback", "no_user_page"].includes(page.confidence)) problems.push(`${entry.route}: ${entry.action} is not on a page either, so this places nothing`);
          const call = entry.evidence?.function ? new RegExp(`\\b${escapeRegExp(entry.evidence.function)}\\s*\\(`) : null;
          if (!call) problems.push(`${entry.route}: gives no function that it shares with ${entry.action}`);
          else {
            for (const [label, subject] of [["the route", raw], ["the action", action]]) {
              if (!call.test(String(subject.handlerSource || ""))) problems.push(`${entry.route}: ${label} does not call ${entry.evidence.function}, so it is not the JSON form of ${entry.action}`);
            }
          }
        }
      }
      if (entry.kind === "method_refusal" && ROUTE_DATA_REVIEWS.find((review) => review.route === entry.route)?.kind !== "method_not_allowed") {
        problems.push(`${entry.route}: lib/sonara-route-data-reviews.cjs does not record it as a route that only refuses a method`);
      }
    }
    return problems;
  }
  const twinSeen = new Set();
  function pageForAction(route) {
    if (route.method === "GET" && !route.route.startsWith("/api/")) return { route: route.route, confidence: "exact", reason: "page_route" };
    if (route.kind === "webhook") return { route: null, confidence: "machine_ingress", reason: "provider_or_system_webhook" };
    const strippedApi = route.route.replace(/^\/api(?=\/)/, "");
    const directOptions = [strippedApi, route.route.replace(/^\/auth\//, "/"), route.route.replace(/^\/api\/admin\//, "/admin/")];
    for (const candidate of directOptions) {
      if (routeIds.has(`GET ${candidate}`) && !candidate.startsWith("/api/")) return { route: candidate, confidence: "route_pair", reason: "matching_get_route" };
    }
    const nearestRegisteredPage = (candidate, reason) => {
      const segments = candidate.split("/").filter(Boolean);
      while (segments.length > 0) {
        segments.pop();
        const parent = `/${segments.join("/")}`;
        if (segments.length > 0 && routeIds.has(`GET ${parent}`)) return { route: parent, confidence: "parent_route", reason };
      }
      return null;
    };
    if (!route.route.startsWith("/api/")) {
      const parent = nearestRegisteredPage(route.route, "nearest_registered_parent_page");
      if (parent) return parent;
    }
    const growthDoor = growthRecordDoor(route);
    if (growthDoor) return growthDoor;
    const productApi = route.route.match(/^\/api\/(business-builder|business|creator-studio|creator|growth-studio|growth)\/(.+)$/);
    if (productApi) {
      const prefix = /^(business-builder|business)$/.test(productApi[1]) ? "/business-builder"
        : /^(creator-studio|creator)$/.test(productApi[1]) ? "/creator-studio" : "/growth-studio";
      const exactPage = `${prefix}/${productApi[2]}`;
      if (routeIds.has(`GET ${exactPage}`)) return { route: exactPage, confidence: "route_pair", reason: "matching_product_workspace_page" };
      const parent = nearestRegisteredPage(exactPage, "nearest_registered_product_workspace_page");
      if (parent && parent.route !== prefix) return parent;
    }
    // A JSON route with a page-form twin -- `POST /api/x/:id/evidence` beside
    // `POST /x/:id/evidence`, which the page's form posts to -- is the same
    // action answering JSON instead of redirecting, so the twin's page is its
    // screen. Same method and the same path without /api, and only when the
    // twin itself resolves to a page rather than a workspace home.
    if (route.route.startsWith("/api/") && route.method !== "GET" && !twinSeen.has(route.id)) {
      const twin = rawRoutes.find((candidate) => candidate.id === `${route.method} ${strippedApi}`);
      if (twin) {
        twinSeen.add(route.id);
        const page = pageForAction(twin);
        twinSeen.delete(route.id);
        if (page.route && page.confidence !== "workspace_fallback" && page.confidence !== "no_user_page") {
          return { route: page.route, confidence: "route_pair", reason: "page_form_twin", twin: twin.id };
        }
      }
    }
    const declaredPages = declaredDoors.get(route.id);
    if (declaredPages?.length) return destinationAmong(route, new Set(declaredPages), "declared_door_on_the_page_that_renders_it");
    const uiPages = formPagesFor(route);
    if (uiPages.size) return destinationAmong(route, uiPages, "rendered_form_action");
    const scriptPagesForRoute = scriptPagesFor(route);
    if (scriptPagesForRoute.size) return destinationAmong(route, scriptPagesForRoute, "page_script_calls_route");
    const literalOptions = [route.route, strippedApi];
    for (const [page, handlerSource] of pageCandidateText) {
      if (literalOptions.some((value) => value && handlerSource.includes(value))) return { route: page, confidence: "form_reference", reason: "page_handler_mentions_action_path" };
    }
    const reviewed = reviewedDestination(route);
    if (reviewed) return reviewed;
    const home = homeByWorkspace[route.workspace] || workspaceHome(route.workspace);
    if (routeIds.has(`GET ${home}`)) return { route: home, confidence: "workspace_fallback", reason: "no_exact_page_binding_found" };
    return { route: null, confidence: "no_user_page", reason: "machine_api_or_workspace_home_not_registered" };
  }

  const ownerRecordPageModule = require(path.join(ROOT, "lib", "sonara-owner-record-pages.cjs"));
  const pageForApi = ownerRecordPageModule.pageForApi;
  const ownerRecordPages = [
    ...ownerRecordPageModule.OWNER_RECORD_PAGES,
    ...ownerRecordPageModule.OPERATIONS_RECORD_PAGES,
    ...ownerRecordPageModule.CREATOR_RECORD_PAGES
  ].map((page) => {
    const childRecords = ownerRecordPageModule.childrenOf(page);
    const formFields = (page.form?.fields || []).map((field) => ({
      name: field.name,
      type: field.type || "text",
      required: field.required === true,
      maxLength: field.maxLength || null,
      options: field.options || [],
      default: field.default ?? null
    }));
    return {
      id: `record-page:${page.path}`,
      path: page.path,
      api: page.api || null,
      title: page.title,
      table: page.table,
      selectFields: String(page.select || "").split(",").map((field) => field.trim()).filter(Boolean),
      formFields,
      requiredFields: formFields.filter((field) => field.required).map((field) => field.name),
      formActionRoute: page.form?.action || page.api || null,
      rowActions: [page.rowAction, ...(page.additionalRowActions || [])].filter(Boolean).map((action) => ({
        route: action.api,
        label: action.label || null,
        idField: action.idField || null
      })),
      childTables: childRecords.map((child) => ({
        table: child.table,
        api: child.api || null,
        parentColumn: child.parentColumn || null,
        formFields: (child.form?.fields || []).map((field) => ({ name: field.name, type: field.type || "text", required: field.required === true, options: field.options || [] }))
      })),
      workspace: page.path.startsWith("/creator-studio/") ? "creator_studio" : "business_builder",
      source: "lib/sonara-owner-record-pages.cjs"
    };
  });
  const ownerPageByPath = new Map(ownerRecordPages.map((page) => [page.path, page]));
  const ownerPageByApi = new Map(ownerRecordPages.filter((page) => page.api).map((page) => [page.api, page]));
  const ownerChildRecords = ownerRecordPages.flatMap((page) => page.childTables.map((child) => ({
    id: `record-child:${page.path}:${child.api || child.table}`,
    route: child.api,
    pageRoute: page.path,
    workspace: page.workspace,
    table: child.table,
    parentTable: page.table,
    parentColumn: child.parentColumn,
    requiredFields: child.formFields.filter((field) => field.required).map((field) => field.name),
    requiredFieldsEvidence: "owner_record_child_form",
    formFields: child.formFields,
    selectFields: columnsFor(child.table).map((column) => column.name),
    referencedTables: [page.table],
    source: "lib/sonara-owner-record-pages.cjs"
  })));
  const ownerRecordActions = ownerRecordPages.flatMap((page) => [
    ...(page.formActionRoute && page.formActionRoute !== page.api ? [{
      id: `record-form-action:${page.path}`,
      route: page.formActionRoute,
      method: "POST",
      pageRoute: page.path,
      workspace: page.workspace,
      table: page.table,
      operationKind: "form_action",
      requiredFields: page.requiredFields,
      requiredFieldsEvidence: "owner_record_form",
      formFields: page.formFields,
      selectFields: page.selectFields,
      referencedTables: page.childTables.map((child) => child.table),
      source: page.source
    }] : []),
    ...page.rowActions.map((action) => ({
      id: `record-row-action:${page.path}:${action.route}`,
      route: action.route,
      method: "POST",
      pageRoute: page.path,
      workspace: page.workspace,
      table: page.table,
      operationKind: "row_action",
      actionLabel: action.label,
      rowIdField: action.idField,
      requiredFields: action.idField ? [action.idField] : [],
      requiredFieldsEvidence: action.idField ? "owner_record_row_action" : "route_path_parameter",
      formFields: [],
      selectFields: page.selectFields,
      referencedTables: page.childTables.map((child) => child.table),
      source: page.source
    }))
  ]);
  const ownerChildByApi = new Map(ownerChildRecords.filter((child) => child.route).map((child) => [child.route, child]));
  const moduleResourceRecords = Object.entries(moduleCrud.RESOURCES).map(([key, resource]) => {
    const [productKey, resourceName] = key.split(":");
    const slug = productKey.replace(/_/g, "-");
    return {
      id: `crud:${key}`,
      key,
      route: `/api/${slug}/${resourceName}`,
      pageRoute: `/${slug}/${resourceName}`,
      workspace: productKey,
      table: resource.table,
      form: resource.form,
      editable: resource.editable || [],
      requiredFields: resource.required || [],
      requiredFieldsEvidence: Array.isArray(resource.required) ? "resource_registry" : "not_declared_in_resource_registry",
      selectFields: String(resource.select || "").split(",").map((field) => field.trim()).filter(Boolean),
      statuses: resource.statuses || [],
      activeStatus: resource.activeStatus || null,
      migrationFiles: migrationByTable.get(resource.table)?.createdBy || [],
      source: "lib/sonara-module-crud.cjs"
    };
  });
  const businessResourceRecords = Object.entries(businessResources.RESOURCE_MAP).map(([route, resource]) => ({
    id: `business-resource:${route}`,
    route,
    pageRoute: pageForApi(route)?.path || null,
    workspace: "business_builder",
    table: resource.table,
    requiredFields: resource.required || [],
    requiredFieldsEvidence: "resource_registry",
    defaults: resource.defaults || {},
    planLimit: resource.planLimit || null,
    personField: resource.person || null,
    referencedTables: Object.values(resource.references || {}),
    migrationFiles: migrationByTable.get(resource.table)?.createdBy || [],
    source: "routes/sonara-last9-routes.cjs"
  }));
  const resourceContracts = [...moduleResourceRecords, ...businessResourceRecords];
  const formulaDefinitions = formulaLibrary.listFormulaDefinitions();
  const formulaInputsByKey = formulaDefinitions.map((definition) => ({
    formulaKey: definition.formulaKey,
    requiredInputs: definition.requiredInputs,
    targetTables: definition.targetTables,
    outputUnit: definition.outputUnit
  }));
  const agentQueueTable = require(path.join(ROOT, "lib", "sonara-agent-queue.cjs")).TABLE;
  const agentActionLogTable = require(path.join(ROOT, "lib", "sonara-agent-action-log.cjs")).TABLE;
  const agentRouteContracts = [
    { routeId: "POST /api/agents/queue/propose", action: "propose_agent_action", requiredInputs: ["action_type", "subject", "payload"], tables: [agentQueueTable, agentActionLogTable], sources: ["routes/sonara-agent-activity-routes.cjs", "lib/sonara-agent-queue.cjs", "lib/sonara-agent-action-log.cjs"] },
    { routeId: "POST /api/agents/queue/approve", action: "approve_and_run_queued_action", requiredInputs: ["id"], tables: [agentQueueTable, agentActionLogTable], sources: ["routes/sonara-agent-activity-routes.cjs", "lib/sonara-agent-queue.cjs", "lib/sonara-agent-action-log.cjs"] },
    { routeId: "POST /api/agents/queue/decline", action: "decline_queued_action", requiredInputs: ["id"], tables: [agentQueueTable, agentActionLogTable], sources: ["routes/sonara-agent-activity-routes.cjs", "lib/sonara-agent-queue.cjs", "lib/sonara-agent-action-log.cjs"] }
  ].map((contract) => ({ ...contract, tables: sorted(contract.tables.filter((table) => tableNameSet.has(table))), output: "Bounded status/result JSON; owner approval is required for sensitive categories." }));
  const agentRouteContractById = new Map(agentRouteContracts.map((contract) => [contract.routeId, contract]));

  function resourceForOperation(routePath, method) {
    for (const resource of moduleResourceRecords) {
      if (routePath === resource.pageRoute && method === "GET") return { ...resource, operationKind: "workspace_record_list" };
      const isBase = routePath === resource.route;
      const isRecordRoute = new RegExp(`^${resource.route}/:id(?:/(?:archive|restore))?$`).test(routePath);
      if (isBase && ["GET", "POST"].includes(method)) return { ...resource, operationKind: method === "POST" ? "create" : "list" };
      if (isRecordRoute && ["GET", "POST", "PATCH"].includes(method)) return { ...resource, operationKind: routePath.endsWith("/archive") ? "archive" : routePath.endsWith("/restore") ? "restore" : method === "GET" ? "read" : "update" };
    }
    for (const resource of businessResourceRecords) {
      const ownerPage = ownerPageByApi.get(resource.route);
      const ownerChild = ownerChildByApi.get(resource.route);
      if (routePath === resource.route && ["GET", "POST"].includes(method)) return {
        ...resource,
        requiredFields: sorted([...(resource.requiredFields || []), ...(ownerChild?.requiredFields || [])]),
        formFields: ownerChild?.formFields || ownerPage?.formFields || [],
        selectFields: ownerChild?.selectFields || ownerPage?.selectFields || [],
        referencedTables: sorted([...(resource.referencedTables || []), ...(ownerPage?.childTables || []).map((child) => child.table), ...(ownerChild?.referencedTables || [])]),
        childTables: ownerPage?.childTables || [],
        operationKind: method === "POST" ? "create" : "list"
      };
      if (resource.pageRoute && routePath === resource.pageRoute && method === "GET") {
        const ownerPage = ownerPageByApi.get(resource.route);
        return {
          ...resource,
          formFields: ownerPage?.formFields || [],
          selectFields: ownerPage?.selectFields || [],
          referencedTables: sorted([...(resource.referencedTables || []), ...(ownerPage?.childTables || []).map((child) => child.table)]),
          childTables: ownerPage?.childTables || [],
          operationKind: "workspace_record_list"
        };
      }
    }
    const ownerPage = ownerPageByPath.get(routePath);
    if (ownerPage && method === "GET") return {
      ...ownerPage,
      route: ownerPage.api,
      pageRoute: ownerPage.path,
      formFields: ownerPage.formFields,
      editable: ownerPage.formFields.map((field) => field.name),
      referencedTables: ownerPage.childTables.map((child) => child.table),
      operationKind: "workspace_record_list"
    };
    const ownerApi = ownerPageByApi.get(routePath);
    if (ownerApi && ["GET", "POST"].includes(method)) return {
      ...ownerApi,
      route: ownerApi.api,
      pageRoute: ownerApi.path,
      formFields: ownerApi.formFields,
      editable: ownerApi.formFields.map((field) => field.name),
      referencedTables: ownerApi.childTables.map((child) => child.table),
      operationKind: method === "POST" ? "create" : "list"
    };
    const ownerChild = ownerChildByApi.get(routePath);
    if (ownerChild && ["GET", "POST"].includes(method)) return { ...ownerChild, operationKind: method === "POST" ? "create" : "list" };
    for (const page of ownerRecordPages) {
      if (!["GET", "POST", "PATCH"].includes(method)) continue;
      const suffixes = [
        [`${page.path}/:recordId/edit`, ["GET"], "edit_form"],
        [`${page.path}/:recordId`, ["GET"], "record_detail"],
        [`${page.path}/:recordId`, ["POST", "PATCH"], "update"],
        [`${page.path}/:recordId/archive`, ["POST"], "archive"],
        [`${page.path}/:recordId/status`, ["POST"], "status_transition"]
      ];
      const match = suffixes.find(([candidate, methods]) => candidate === routePath && methods.includes(method));
      if (match) return {
        ...page,
        route: page.api,
        pageRoute: page.path,
        formFields: page.formFields,
        editable: page.formFields.map((field) => field.name),
        referencedTables: page.childTables.map((child) => child.table),
        operationKind: match[2]
      };
    }
    const ownerAction = ownerRecordActions.find((action) =>
      action.method === method && normalizeRouteParams(action.route) === normalizeRouteParams(routePath));
    if (ownerAction) return ownerAction;
    return null;
  }

  const { ROUTE_DATA_REVIEWS } = require(path.join(ROOT, "lib", "sonara-route-data-reviews.cjs"));
  const routeDataReviewByRoute = new Map(ROUTE_DATA_REVIEWS.map((entry) => [entry.route, entry]));
  const routeDataReviewOutcomes = new Map();
  const routes = rawRoutes.map((route) => {
    const moduleTablesForRoute = route.moduleTableNames || [];
    const creatorData = CONTRACT_BY_ROUTE.get(route.id) || null;
    const creatorPending = creatorData?.kind === "pending_database";
    const resource = resourceForOperation(route.route, route.method);
    const agentContract = agentRouteContractById.get(route.id) || null;
    const isFormulaEvaluate = route.method === "POST" && route.route === "/api/formulas/evaluate";
    const isFormulaSave = route.method === "POST" && route.route === "/api/formulas/results";
    const isFormulaCatalog = /^GET \/api\/formulas\/(?:readiness|definitions)$/.test(route.id);
    const supabaseBackedPage = route.method === "GET" && !route.route.startsWith("/api/") && route.routeRegistry?.requiredProvider === "supabase";
    const resourceTableNames = resource ? sorted([resource.table, ...(resource.referencedTables || [])]) : [];
    const formulaTableNames = isFormulaSave ? ["sonara_formula_results", "activity_events"].filter((table) => tableNameSet.has(table)) : [];
    const rpcContracts = route.rpcCalls.map((name) => databaseFunctionByName.get(name) || {
      id: `database-function:${name}`,
      name,
      readTables: [],
      writeTables: [],
      definitionMigrations: [],
      evidence: "migration_definition_not_found"
    });
    const rpcEffectTables = sorted(rpcContracts.flatMap((contract) => [...contract.readTables, ...contract.writeTables]));
    const triggeredEffects = databaseTriggers.filter((trigger) => rpcContracts.some((contract) =>
      (contract.writeOperations || []).some((write) => write.table === trigger.table && trigger.events.includes(write.operation))));
    const mappedTables = sorted([
      ...resourceTableNames, ...formulaTableNames, ...(agentContract?.tables || []), ...route.directTableReferences, ...rpcEffectTables,
      ...triggeredEffects.flatMap((effect) => [...effect.readTables, ...effect.writeTables])
    ]);
    const tracedMode = creatorData ? (creatorPending ? "creator_proposal_only_adapter" : "creator_unsaved_preview")
      : resource ? "resource_registry_contract"
      : agentContract ? "agent_registry_route_contract"
        : isFormulaEvaluate ? "deterministic_compute_no_write"
          : isFormulaSave ? "formula_result_and_activity_write"
            : isFormulaCatalog ? "static_formula_catalog"
              : route.directTableReferences.length ? "endpoint_handler_evidence"
                : rpcEffectTables.length ? "migration_rpc_effects"
                : route.providerEndpoints.length ? "provider_endpoint_evidence"
            : route.kind === "webhook" ? "webhook_ingress_requires_data_effect_review"
              : route.kind === "page_or_download" && !supabaseBackedPage ? "navigation_or_static_output"
                : /\/(?:health|readiness|manifest|definitions|catalog|open-source|model-engines|agent-skill-strategies|batch-convergence|source-evidence|learning-memory)(?:\/|$)/.test(route.route) ? "static_or_read_only_contract"
                  : moduleTablesForRoute.length ? "source_module_candidates"
                    : route.method === "GET" ? "read_or_provider_status_needs_handler_review" : "write_needs_table_or_explicit_no_persistence_reason";
    const destination = resource?.pageRoute
      ? { route: resource.pageRoute, confidence: "form_reference", reason: "registered_resource_page" }
      : pageForAction(route);
    const isUserAction = route.method !== "GET" && route.kind !== "webhook";
    const dataModuleId = route.source.file ? `module:${route.source.file}` : null;
    const knownNoPersistence = ["navigation_or_static_output", "deterministic_compute_no_write", "static_formula_catalog", "static_or_read_only_contract"].includes(tracedMode) && !supabaseBackedPage;
    const tracedStatus = creatorData ? (creatorPending ? "explicit_proposed_schema_not_migrated" : "explicit_no_persistent_table_expected")
      : resource ? "explicit_resource_registry"
      : agentContract ? "explicit_agent_runner_registry"
      : isFormulaSave ? "explicit_formula_result_registry"
        : isFormulaEvaluate || isFormulaCatalog ? "explicit_no_persistent_table_expected"
          : route.directTableReferences.length || rpcEffectTables.length ? "handler_source_table_reference"
            : route.providerEndpoints.length ? "provider_endpoint_reference"
            : knownNoPersistence ? "explicit_no_persistent_table_expected"
          : "needs_explicit_data_contract";
    // A reviewed "reads nothing" applies only where the trace agrees and the
    // route would otherwise be left for review. Anything else is recorded as a
    // review that has stopped being true, and the generator refuses it.
    const dataReview = routeDataReviewByRoute.get(route.id) || null;
    const traceContradictions = [
      ...route.directTableReferences.map((table) => `table ${table}`),
      ...rpcContracts.map((contract) => `function ${contract.name}`),
      ...route.providerEndpoints.map((endpoint) => `provider ${endpoint}`),
      ...(route.outboundCallObserved ? ["an outbound request"] : []),
      ...(persistenceTraceTruncatedRoutes.has(route.id) ? ["a trace that was cut short"] : [])
    ];
    if (dataReview) {
      routeDataReviewOutcomes.set(route.id, { contradictions: traceContradictions, wouldOtherwiseBeReviewed: tracedStatus === "needs_explicit_data_contract" });
    }
    const reviewApplies = Boolean(dataReview) && !traceContradictions.length && tracedStatus === "needs_explicit_data_contract";
    const mode = reviewApplies ? "reviewed_no_database_access" : tracedMode;
    const dataMappingStatus = reviewApplies ? "explicit_no_persistent_table_expected" : tracedStatus;
    const noPersistenceReason = creatorData && !creatorPending ? creatorData.reason
      : reviewApplies ? dataReview.reason
      : isFormulaEvaluate ? "Deterministic calculation; result persistence is a separate POST /api/formulas/results action."
      : isFormulaCatalog ? "Formula definitions and static readiness metadata are returned from the in-repository formula registry."
      : mode === "static_or_read_only_contract" ? "Read-only health, readiness, manifest, definition, or catalog response."
            : mode === "navigation_or_static_output" && !supabaseBackedPage ? "Page navigation or rendered content with no direct database contract in the route registry."
              : null;
    const contractFields = resource ? {
      resourceId: resource.id,
      operationKind: resource.operationKind,
      requiredFields: resource.requiredFields,
      requiredFieldsEvidence: resource.requiredFieldsEvidence,
      editableFields: resource.editable || [],
      fields: resource.formFields || [],
      defaults: resource.defaults || {},
      statuses: resource.statuses || [],
      referencedTables: resource.referencedTables || [],
      outputFields: resource.selectFields || [],
      actionLabel: resource.actionLabel || null,
      rowIdField: resource.rowIdField || null,
      childTables: resource.childTables || []
    } : null;
    if (resource) {
      if (["POST", "PATCH", "PUT"].includes(route.method) && ["create", "update", "form_action", "row_action"].includes(resource.operationKind)) {
        route.inputs.body = sorted([...route.inputs.body, ...(resource.requiredFields || []), ...(resource.editable || []), ...(resource.formFields || []).map((field) => field.name), ...Object.keys(resource.defaults || {})]);
      }
      route.response.jsonFieldsObserved = sorted([...route.response.jsonFieldsObserved, ...(resource.selectFields || [])]);
    }
    const formFieldsObserved = sorted(formActionFields.get(`${route.method} ${normalizeRouteParams(route.route)}`) || []);
    if (formFieldsObserved.length) {
      const requestGroup = route.method === "GET" ? "query" : "body";
      route.inputs[requestGroup] = sorted([...route.inputs[requestGroup], ...formFieldsObserved]);
      route.inputs.renderedFormFieldsObserved = formFieldsObserved;
    }
    if (isFormulaEvaluate || isFormulaSave) {
      route.inputs.body = sorted([...route.inputs.body, "formulaKey", "formula_key", "inputValues", "input_values"]);
      if (isFormulaEvaluate) route.inputs.conditionalInputFields = formulaInputsByKey;
    }
    const openApi = route.openApi;
    if (openApi) {
      route.response.statusCodes = sorted([...route.response.statusCodes, ...openApi.responseStatusCodes]);
      route.inputs.openApiBody = openApi.requestBodyRef || (openApi.requestBodyDeclared ? "declared_without_single_line_ref" : null);
    }
    const tableLineage = mappedTables.map((table) => ({
      table,
      tableId: `table:${table}`,
      migrationLineage: migrationByTable.get(table) || null
    }));
    return {
      id: route.id,
      method: route.method,
      route: route.route,
      kind: route.kind,
      workspace: route.workspace,
      destination,
      accessMiddleware: route.handlerNames.filter((name) => /require|auth|rate|limiter|admin|customer|workspace|manager|owner/i.test(name)),
      routeRegistry: route.routeRegistry,
      openApi,
      request: route.inputs,
      response: route.response,
      data: {
        mappingStatus: dataMappingStatus,
        // Proposal-only dependencies are never counted as active migration
        // tables. Keep them distinct from directTables and schemaMigrations.
        creatorDataContract: creatorData ? {
          kind: creatorData.kind,
          lifecycle: creatorPending ? "reviewed_sql_proposal_unapplied" : "unsaved_local_compute",
          operation: creatorData.operation,
          proposedReadTables: creatorData.reads,
          proposedWriteTables: creatorData.writes,
          runtimeFlag: creatorData.flag,
          sourceAdapter: creatorData.adapter,
          sourceReason: creatorData.reason
        } : null,
        directTables: mappedTables,
        candidateTables: moduleTablesForRoute,
        tableLineage,
        noPersistenceReason,
        resourceContract: contractFields,
        agentRouteContract: agentContract,
        rpcEffects: rpcContracts,
        // Supabase Auth, Supabase Storage and Stripe endpoints the traced
        // handler reaches. Not tables, but a data contract all the same.
        providerEndpoints: route.providerEndpoints,
        triggeredEffects,
        formulaInputCatalog: isFormulaEvaluate ? formulaInputsByKey : undefined,
        sourceModule: dataModuleId,
        moduleTableCandidateCount: moduleTablesForRoute.length,
        schemaMigrations: sorted([
          ...tableLineage.flatMap((entry) => [...(entry.migrationLineage?.createdBy || []), ...(entry.migrationLineage?.changedBy || [])]),
          ...rpcContracts.flatMap((entry) => entry.definitionMigrations),
          ...triggeredEffects.flatMap((entry) => [entry.migration, entry.functionDefinition].filter(Boolean))
        ]),
        persistenceMode: mode
      },
      source: route.source,
      contractCompleteness: {
        route: Boolean(route.route),
        workspace: Boolean(route.workspace),
        // A reviewed route with no page is complete: its consumer is recorded and
        // checked in lib/sonara-route-destination-reviews.cjs.
        destination: Boolean(destination.route || ["machine_ingress", "reviewed_no_page"].includes(destination.confidence)),
        inputEvidence: route.inputs.body.length || route.inputs.query.length || route.inputs.pathParams.length ? "handler_form_or_path_fields_found" : "no_named_fields_found_or_delegated",
        outputEvidence: route.response.evidence,
        persistence: dataMappingStatus,
        openApi: Boolean(openApi),
        requestFieldSource: resource ? "resource_registry_plus_handler_observation" : formFieldsObserved.length ? "rendered_form_plus_handler_observation" : route.inputs.body.length ? "handler_or_route_path_observation" : openApi?.requestBodyDeclared ? "generic_openapi_body_contract" : "not_declared"
      },
      action: isUserAction
    };
  }).sort((a, b) => a.method.localeCompare(b.method) || a.route.localeCompare(b.route));

  const workspaceDirectory = getWorkspaceDirectoryGroups();
  const coreWorkspaceByKey = new Map(workspaceDirectory.workspaces.map((workspace) => [workspace.key, workspace]));
  const workspaceSpecs = [
    ["business_builder", "Business Builder", ["/business-builder", "/api/business-builder", "/api/business"]],
    ["business_builder_agent_ops", "Business Builder Agent Operations", ["/owner/agent-activity", "/owner/agent-schedule", "/api/agents"]],
    ["creator_studio", "Creator Studio", ["/creator-studio", "/api/creator-studio", "/api/creator"]],
    ["growth_studio", "Growth Studio", ["/growth-studio", "/api/growth-studio", "/api/growth"]],
    ["admin_operations", "Administration", ["/admin", "/api/admin"]],
    ["research_lab", "Research Lab", ["/research-lab", "/api/research-lab"]],
    ["research_catalog", "Technology and Repository Catalog", ["/technology-radar", "/api/ecosystem"]],
    ["shared_infrastructure", "Shared Infrastructure", ["/infrastructure", "/api/infrastructure"]],
    ["cross_workspace_formulas", "Cross-workspace Formulas", ["/formulas", "/api/formulas"]],
    ["shared_account", "Shared Account", ["/account", "/auth"]],
    ["sonara_shared_api", "SONARA Shared API", ["/api"]],
    ["sonara_shared", "SONARA Shared Pages", ["/"]]
  ];
  const workspaces = workspaceSpecs.map(([key, name, routePrefixes]) => {
    const core = coreWorkspaceByKey.get(key);
    const pageRoutes = routes.filter((route) => route.workspace === key && route.method === "GET" && !route.route.startsWith("/api/")).map((route) => route.route);
    return {
      key,
      name,
      prefix: core?.prefix || routePrefixes[0],
      routePrefixes,
      routeCount: routes.filter((route) => route.workspace === key).length,
      registeredPageCount: core?.count || pageRoutes.length,
      registeredPageRoutes: sorted(pageRoutes),
      categories: core?.categories.map((category) => ({ name: category.name, routes: category.items.map((item) => item.route) })) || [],
      homeRoute: homeByWorkspace[key]
    };
  });

  const resourceRecords = moduleResourceRecords;
  const checks = recordChecks.CHECKS.map((check) => ({
    id: check.id, product: check.product, table: check.table, columns: check.columns, fixPath: check.fixPath, fixLabel: check.fixLabel,
    severity: check.severity, migrationFiles: migrationByTable.get(check.table)?.createdBy || []
  }));

  const formulas = formulaDefinitions.map((definition) => {
    const inputs = Object.fromEntries(definition.requiredInputs.map((input) => [
      input,
      input === "ingredients" ? [{ quantity: 1, unit_cost: 1 }] : 1
    ]));
    const evaluation = formulaLibrary.evaluateFormula(definition.formulaKey, inputs);
    return {
      key: definition.formulaKey,
      group: definition.groupKey,
      productArea: definition.productArea,
      workspace: formulaLibrary.productAreaToWorkspace(definition.productArea),
      label: definition.publicLabel,
      expression: definition.expressionText,
      inputs: definition.requiredInputs,
      tables: definition.targetTables,
      outputUnit: definition.outputUnit,
      evaluatorStatus: evaluation.ok ? "evaluator_returns_result" : evaluation.code,
      resultRoute: "/api/formulas/evaluate",
      savedResultRoute: "/api/formulas/results",
      savedTable: "sonara_formula_results",
      migrationFiles: sorted([...definition.targetTables, "sonara_formula_results"].flatMap((table) => migrationByTable.get(table)?.createdBy || []))
    };
  });
  const supplementalFinancial = financialFormulas.getFinancialIntelligenceFormulaCatalog();

  const skills = findFiles([".claude/skills", ".agents"], (name) => name === "SKILL.md").map((file) => {
    const body = fs.readFileSync(path.join(ROOT, file), "utf8");
    return {
      name: body.match(/^name:\s*(.+)$/m)?.[1]?.trim() || path.basename(path.dirname(file)),
      description: body.match(/^description:\s*(.+)$/m)?.[1]?.trim() || "",
      path: file,
      audience: "repository_development_and_review",
      applicationRoute: null,
      note: "Developer workflow guidance; not a customer-executable product capability."
    };
  });

  const agentSource = fs.readFileSync(path.join(ROOT, "routes", "sonara-agent-activity-routes.cjs"), "utf8");
  const agentSkillStrategies = require(path.join(ROOT, "lib", "sonara-agent-skill-strategies.cjs")).getAgentSkillStrategyCatalog();
  const schedulable = [...agentSource.matchAll(/\{\s*action:\s*["']([^"']+)["']\s*,\s*label:\s*["']([^"']+)["']\s*\}/g)].map((match) => ({ action: match[1], label: match[2] }));
  const registeredAgentHandlers = sorted([...agentSource.matchAll(/runner\.register\(\s*["']([^"']+)["']/g)].map((match) => match[1]));
  const agentTables = activeTableNames.filter((name) => /^(?:entity_|agent_)/.test(name));
  const agents = {
    policy: {
      selfServeActions: agentAuthority.SELF_SERVE_ACTIONS,
      sensitiveCategories: agentAuthority.SENSITIVE_CATEGORIES.map((item) => ({ category: item.category, pattern: item.pattern.source, reason: item.reason })),
      ownerApprovalRoles: agentAuthority.OWNER_APPROVAL_ROLES,
      unknownActionPolicy: "owner_review"
    },
    schedulableActions: schedulable.map((item) => ({ ...item, handlerRegistered: registeredAgentHandlers.includes(item.action) })),
    registeredHandlers: registeredAgentHandlers,
    skillStrategyCatalog: agentSkillStrategies,
    runRoutes: routes.filter((route) => /\/api\/agents\/|\/owner\/agent-|\/admin\/agent-activity/.test(route.route)),
    tables: agentTables.map((table) => ({ table, migrationFiles: migrationByTable.get(table)?.createdBy || [] })),
    sourceFiles: ["lib/sonara-agent-authority.cjs", "lib/sonara-agent-runner.cjs", "lib/sonara-agent-queue.cjs", "lib/sonara-agent-action-log.cjs", "lib/sonara-agent-schedule.cjs", "lib/sonara-agent-skill-strategies.cjs", "routes/sonara-agent-activity-routes.cjs"],
    executionBoundary: "Registered handlers only; action classification, tenant scope, durable record, and owner approval apply. This is bounded business automation, not an unrestricted general-purpose agent."
  };

  const openSourceRecords = openSourceRegistry.readOpenSourceTools().map((record) => normalizeRepository(record, "data/open-source-tools.ts", "/research-lab/open-source"));
  const requestedRecords = requestedRepoRegistry.REQUESTED_REPOSITORIES.map((record) => normalizeRepository(record, "lib/sonara-requested-repository-registry.cjs", "/research-lab/requested-repositories"));
  const screenshotCatalogs = [];
  const screenshotRecords = [];
  const radarFiles = fs.readdirSync(path.join(ROOT, "lib")).filter((name) => /^sonara-screenshot-tool-radar-batch\d+\.cjs$/.test(name)).sort((a, b) => Number(a.match(/batch(\d+)/)[1]) - Number(b.match(/batch(\d+)/)[1]));
  for (const file of radarFiles) {
    const batch = file.match(/batch(\d+)/)[1];
    const exports = require(path.join(ROOT, "lib", file));
    const catalogFunction = Object.entries(exports).find(([name, value]) => name.startsWith("getPublicScreenshotToolCatalog") && typeof value === "function")?.[1];
    const raw = catalogFunction?.();
    const records = Array.isArray(raw) ? raw : raw?.repositories || [];
    screenshotCatalogs.push({ id: `screenshot_radar_batch_${batch}`, batch: Number(batch), source: `lib/${file}`, entryCount: records.length });
    screenshotRecords.push(...records.map((record) => normalizeRepository(record, `lib/${file}`, "/research-lab/open-source", `screenshot_batch_${batch}`)));
  }
  const githubRadar = loadTsExport("data/github-radar-repos.ts", "githubRadarRepos").map((record) => normalizeRepository(record, "data/github-radar-repos.ts", "/technology-radar"));
  const repositoryIntake = readRepositoryIntake();
  const repositoryRecords = [...openSourceRecords, ...requestedRecords, ...screenshotRecords, ...githubRadar, ...repositoryIntake.records];
  const repositoryStatusCounts = countBy(repositoryRecords, (record) => record.status || "status_unrecorded");
  const researchOnlyRepositories = repositoryRecords.filter((record) => /research.?only|reference.?only|watch.?only/i.test(record.status || ""));

  const creatorTools = loadTsExport("data/creator-tools.ts", "creatorTools");
  const technologyTools = loadTsExport("data/technology-registry.ts", "technologyRegistry");
  const aiIntegrations = aiRegistry.getPublicAIIntegrationCatalog();
  const otherReferenceRecords = [
    ...creatorTools.map((record) => normalizeRepository(record, "data/creator-tools.ts", "/creator-studio/technology")),
    ...technologyTools.map((record) => normalizeRepository(record, "data/technology-registry.ts", "/technology-radar")),
    ...aiIntegrations.map((record) => normalizeRepository(record, "lib/sonara-ai-integration-registry.cjs", "/admin/ai-integrations"))
  ];
  const serviceFiles = infrastructureFiles();
  const resourceContractChecks = [...resourceRecords, ...businessResourceRecords].map((resource) => {
    const table = tables.find((record) => record.name === resource.table);
    const routeExists = routes.some((route) => route.route === resource.route && ["POST", "GET"].includes(route.method));
    const requiredFields = resource.requiredFields || [];
    const columns = new Set(table?.columns.map((column) => column.name) || []);
    return {
      id: resource.id,
      route: resource.route,
      table: resource.table,
      routeRegistered: routeExists,
      tableInMigrations: Boolean(table),
      missingRequiredColumns: requiredFields.filter((field) => !columns.has(field)),
      createMigrations: table?.migrationLineage.createdBy || [],
      status: routeExists && table && requiredFields.every((field) => columns.has(field)) ? "route_table_columns_connected" : "contract_gap"
    };
  });
  const normalizedRouteIds = new Set(routes.map((route) => `${route.method} ${normalizeRouteParams(route.route)}`));
  // A form whose action interpolates a fixed segment -- `/api/growth/${spec.key}`
  // -- cannot be expanded here, so it is matched as a pattern against the
  // registered routes and named in the summary rather than passed silently.
  // Matching nothing is still a form with no route.
  const templatedFormMatches = new Map();
  const formHasRoute = (link) => {
    const id = `${link.method} ${normalizeRouteParams(link.action)}`;
    if (normalizedRouteIds.has(id)) return true;
    const action = normalizeRouteParams(link.action).split("/");
    if (routes.some((route) => {
      const own = normalizeRouteParams(route.route).split("/");
      return route.method === link.method && own.length === action.length
        && action.every((segment, index) => segment === own[index] || own[index] === ":parameter");
    })) return true;
    if (!link.action.includes(":parameter")) return false;
    const pattern = new RegExp(`^${link.method} ${link.action.split(":parameter").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}$`);
    const matched = routes.filter((route) => pattern.test(`${route.method} ${normalizeRouteParams(route.route)}`)).map((route) => route.id);
    if (matched.length) templatedFormMatches.set(`${link.method} ${link.action}`, sorted(matched));
    return matched.length > 0;
  };
  const ownerActionContractChecks = ownerRecordActions.map((action) => ({
    id: action.id,
    route: action.route,
    method: action.method,
    pageRoute: action.pageRoute,
    table: action.table,
    routeRegistered: normalizedRouteIds.has(`${action.method} ${normalizeRouteParams(action.route)}`),
    tableInMigrations: tableNameSet.has(action.table),
    requiredFields: action.requiredFields,
    source: action.source
  }));

  const routeCounts = countBy(routes, (route) => route.method);
  const workspaceRouteCounts = countBy(routes, (route) => route.workspace);
  const duplicateRouteIds = routes.map((route) => route.id).filter((id, index, list) => list.indexOf(id) !== index);
  const dataGapRoutes = routes.filter((route) => route.data.mappingStatus === "needs_explicit_data_contract");
  const rawRouteById = new Map(rawRoutes.map((route) => [route.id, route]));
  const destinationGapRoutes = routes.filter((route) => route.destination.confidence === "workspace_fallback");
  const destinations = countBy(routes, (route) => route.destination.confidence);
  const map = {
    schemaVersion: 1,
    source: {
      repository: "famouslytrill-boop/sonara-os",
      workingTree: true,
      generatedFrom: ["live Express registration stack", "Supabase migration files", "repository registries", "workspace, formula, agent, and infrastructure registries"]
    },
    summary: {
      routeOperationCount: routes.length,
      routesByMethod: routeCounts,
      workspaceCount: workspaces.length,
      declaredPageCount: ROUTE_REGISTRY.length,
      workspaceRouteCounts,
      actionDestinationCounts: destinations,
      routeDataMappingCounts: countBy(routes, (route) => route.data.mappingStatus),
      routesUsingWorkspaceHomeFallback: destinations.workspace_fallback || 0,
      formActionLinkCount: uiFormActionLinks.length,
      // Zero, or this file is reporting fewer forms than the application has and
      // naming the pages where it stopped looking.
      pagesTruncatedByFormWalkBudget: sorted(formWalkTruncatedPages),
      formWalkFunctionBudget: FORM_WALK_FUNCTION_BUDGET,
      // The same rule for the table tracer: zero, or a route's tables were read
      // from part of what it calls and it says which routes.
      routesTruncatedByPersistenceTraceBudget: sorted(persistenceTraceTruncatedRoutes),
      routesReviewedAsReadingNothing: ROUTE_DATA_REVIEWS.length,
      persistenceTraceFunctionBudget: PERSISTENCE_TRACE_FUNCTION_BUDGET,
      formActionsWithoutRegisteredRoute: uiFormActionLinks.filter((link) => !formHasRoute(link)).length,
      templatedFormActionsMatchedByPattern: Object.fromEntries([...templatedFormMatches].sort(([left], [right]) => left.localeCompare(right))),
      routesWithoutDestination: routes.filter((route) => !route.contractCompleteness.destination).length,
      openApiApiOperationCount: routes.filter((route) => route.route.startsWith("/api/") && route.openApi).length,
      databaseTableCount: tables.length,
      databaseContractCoreTableCount: tables.filter((table) => table.databaseContractCore).length,
      queriedTableCount: tables.filter((table) => table.queryCoverage === "queried_by_runtime_source_audit").length,
      neverQueriedTableCount: orphanSet.size,
      migrationCount: migrationRows.length,
      databaseFunctionCount: databaseFunctions.length,
      databaseTriggerCount: databaseTriggers.length,
      routesCallingDatabaseFunctions: routes.filter((route) => route.data.rpcEffects.length > 0).length,
      routesWithMissingDatabaseFunctionDefinition: routes.filter((route) => route.data.rpcEffects.some((effect) => effect.evidence === "migration_definition_not_found")).length,
      routeDataContractsNeedingExplicitReview: dataGapRoutes.length,
      routeDataReviewByMethod: countBy(dataGapRoutes, (route) => route.method),
      routeDestinationReviewByWorkspace: countBy(destinationGapRoutes, (route) => route.workspace),
      resourceTableContractCount: resourceContractChecks.length,
      resourceTableContractGaps: resourceContractChecks.filter((record) => record.status !== "route_table_columns_connected").length,
      ownerRecordPageCount: ownerRecordPages.length,
      ownerRecordChildResourceCount: ownerChildRecords.length,
      ownerRecordActionCount: ownerRecordActions.length,
      ownerRecordActionsWithoutRegisteredRoute: ownerActionContractChecks.filter((action) => !action.routeRegistered).length,
      formulaCount: formulas.length,
      formulasWithEvaluator: formulas.filter((formula) => formula.evaluatorStatus === "evaluator_returns_result").length,
      supplementalFinancialFormulaCount: supplementalFinancial.count || (supplementalFinancial.formulas || []).length || 0,
      localSkillCount: skills.length,
      agentSchedulableActionCount: schedulable.length,
      agentHandlerCount: registeredAgentHandlers.length,
      agentStrategyCount: agentSkillStrategies.strategyCount,
      agentPatternCount: agentSkillStrategies.agentArchitecture?.patternCount || 0,
      businessAISkillCount: agentSkillStrategies.businessAI?.skillCount || 0,
      openSourceRegisterCount: openSourceRecords.length,
      requestedRepositoryCount: requestedRecords.length,
      screenshotRadarRepositoryRecordCount: screenshotRecords.length,
      screenshotRadarBatchCount: screenshotCatalogs.length,
      githubRadarRepositoryCount: githubRadar.length,
      repositoryRecordCountAcrossCatalogs: repositoryRecords.length,
      otherReferenceCatalogRecordCount: otherReferenceRecords.length,
      catalogEntryCountAcrossAllRegistries: repositoryRecords.length + otherReferenceRecords.length,
      repositoryRecordsEnabledInProduction: repositoryRecords.filter((record) => record.enabledInProduction).length,
      researchOrReferenceRepositoryRecordCount: researchOnlyRepositories.length,
      infrastructureServiceCount: infrastructure.INFRASTRUCTURE_SERVICES.length,
      infrastructurePipelineLayerCount: infrastructure.PIPELINE_LAYERS.length,
      infrastructureCapabilityTrackCount: infrastructure.CAPABILITY_EXPANSION_TRACKS.length,
      infrastructureSourceFileCount: serviceFiles.length
    },
    workspaces,
    routeOperations: routes,
    uiFormActionLinks,
    routeDataModules: dataModules,
    tables,
    migrations: migrationRows,
    databaseFunctions,
    databaseTriggers,
    workTableResources: resourceRecords,
    businessBuilderResources: businessResourceRecords,
    explicitResourceContracts: resourceContracts,
    ownerRecordPages,
    ownerRecordChildResources: ownerChildRecords,
    ownerRecordActions,
    deterministicRecordChecks: checks,
    formulas,
    supplementalFinancialFormulas: supplementalFinancial,
    skills,
    internalGuidanceSources: [
      ...findFiles([".ai/shared"], () => true),
      ...findFiles(["docs/agents"], () => true),
      "AGENTS.md",
      "CLAUDE.md"
    ].filter((file) => fs.existsSync(path.join(ROOT, file))).sort(),
    agents,
    agentRouteContracts,
    repositories: {
      records: repositoryRecords,
      otherReferenceRecords,
      researchOrReferenceRecords: researchOnlyRepositories,
      statusCountsAcrossSourceRecords: repositoryStatusCounts,
      sourceCatalogs: [
        { id: "reviewed_open_source_register", source: "data/open-source-tools.ts", route: "/research-lab/open-source", count: openSourceRecords.length, statusCounts: countBy(openSourceRecords, (record) => record.status) },
        { id: "requested_repository_intake", source: "lib/sonara-requested-repository-registry.cjs", route: "/research-lab/requested-repositories", count: requestedRecords.length, statusCounts: countBy(requestedRecords, (record) => record.status) },
        ...screenshotCatalogs,
        { id: "github_radar", source: "data/github-radar-repos.ts", route: "/technology-radar", count: githubRadar.length, statusCounts: countBy(githubRadar, (record) => record.status) },
        { id: "repository_intake_snapshot", source: "data/repository-intake-2026-09-18.json", route: "/research-lab/requested-repositories", count: repositoryIntake.records.length, notes: repositoryIntake.summary }
      ],
      otherReferenceCatalogs: [
        { source: "data/creator-tools.ts", count: creatorTools.length, statuses: countBy(creatorTools, (record) => record.status), route: "/creator-studio/technology" },
        { source: "data/technology-registry.ts", count: technologyTools.length, statuses: countBy(technologyTools, (record) => record.integrationStatus), route: "/technology-radar" },
        { source: "lib/sonara-ai-integration-registry.cjs", count: aiIntegrations.length, statuses: countBy(aiIntegrations, (record) => record.integrationStatus), route: "/admin/ai-integrations" }
      ],
      repositoryLifecycle: "Research/reference/blocked records resolve to the research catalog. Listing a repository does not install it or enable a customer integration. Promotion requires the separate review and adapter path recorded by its catalog."
    },
    infrastructure: {
      services: infrastructure.INFRASTRUCTURE_SERVICES,
      pipelineLayers: infrastructure.PIPELINE_LAYERS,
      capabilityExpansionTracks: infrastructure.CAPABILITY_EXPANSION_TRACKS,
      mobileExperienceChecks: infrastructure.MOBILE_EXPERIENCE_CHECKS,
      sourceFiles: serviceFiles,
      routeDestinations: ["/infrastructure", "/admin/infrastructure", "/api/infrastructure/manifest", "/api/infrastructure/readiness"],
      databaseContract: {
        schemas: databaseContract.DATABASE_SCHEMAS,
        tables: databaseContract.DATABASE_TABLES,
        functions: databaseContract.DATABASE_FUNCTIONS,
        indexes: databaseContract.DATABASE_INDEXES,
        storageBuckets: databaseContract.STORAGE_BUCKETS
      }
    },
    resourceContractChecks,
    ownerActionContractChecks,
    databaseFunctionReviewGaps: routes.filter((route) => route.data.rpcEffects.some((effect) => effect.evidence === "migration_definition_not_found"))
      .map((route) => ({ id: route.id, missingFunctions: route.data.rpcEffects.filter((effect) => effect.evidence === "migration_definition_not_found").map((effect) => effect.name), source: route.source })),
    routeDataContractGaps: dataGapRoutes.map((route) => ({
      id: route.id,
      workspace: route.workspace,
      kind: route.kind,
      source: route.source,
      destination: route.destination,
      method: route.method,
      reason: route.data.persistenceMode,
      moduleCandidateTables: route.data.candidateTables,
      requestFieldsObserved: { body: route.request.body, query: route.request.query, pathParams: route.request.pathParams },
      responseKindsObserved: route.response.kinds,
      // What the trace saw, so a reviewer starts from evidence: whether
      // anything the handler calls makes an outbound request, and whether the
      // trace read all of what it calls.
      traceObservations: {
        outboundCallObserved: rawRouteById.get(route.id)?.outboundCallObserved === true,
        traceComplete: !persistenceTraceTruncatedRoutes.has(route.id)
      },
      reviewAction: route.method === "GET"
        ? "Trace any delegated read to its exact table or provider; otherwise record a source-backed no-table reason."
        : "Trace writes, SQL functions, provider effects, and input/output validation; record exact tables or a source-backed no-table reason."
    })),
    routeDestinationReviewGaps: destinationGapRoutes.map((route) => ({
      id: route.id,
      workspace: route.workspace,
      source: route.source,
      currentDestination: route.destination.route,
      reason: "No exact registered page, parent page, or unique rendered form action was established."
    }))
  };

  map.validation = {
    // lib/sonara-route-data-reviews.cjs, held from both sides: an entry for a
    // route that is not registered, an entry the trace now contradicts, and an
    // entry for a route the generator would not have left for review.
    routeDataReviewsWithoutRoute: ROUTE_DATA_REVIEWS.filter((entry) => !routeDataReviewOutcomes.has(entry.route)).map((entry) => entry.route),
    routeDataReviewsContradictedByTrace: [...routeDataReviewOutcomes].filter(([, outcome]) => outcome.contradictions.length)
      .map(([id, outcome]) => `${id}: the review says it reads nothing, and the trace found ${outcome.contradictions.join(", ")}`),
    routeDataReviewsNotNeeded: [...routeDataReviewOutcomes].filter(([, outcome]) => !outcome.contradictions.length && !outcome.wouldOtherwiseBeReviewed).map(([id]) => id),
    // Zero since 6 October 2026, and held there. A new route either traces to
    // the tables, functions or provider endpoints it reaches, or somebody reads
    // it and records why it reaches none in lib/sonara-route-data-reviews.cjs.
    // Contract list must exactly match real registrations and the schema
    // proposal inventory, and must not override a true traced table or outbound
    // provider call. A new route cannot slip in as "unsaved" by assertion.
    creatorProposedRouteContracts: inspectCreatorRouteDataContracts({
      registeredRouteIds: rawRoutes.map((route) => route.id),
      pendingTables: PENDING_CREATOR_SCHEMA.map((entry) => entry.table),
      creatorProjectRoutesSource: fs.readFileSync(path.join(ROOT, "routes/sonara-creator-project-routes.cjs"), "utf8"),
      creatorPlannerRoutesSource: fs.readFileSync(path.join(ROOT, "routes/creator-music-system-readonly.cjs"), "utf8"),
      worldAdapter: fs.readFileSync(path.join(ROOT, "lib/sonara-world-bible-store.cjs"), "utf8"),
      storyAdapter: fs.readFileSync(path.join(ROOT, "lib/sonara-interactive-story-store.cjs"), "utf8")
    }),
    creatorProposedRouteContractsContradictedByTrace: routes.filter((route) => {
      const item = CONTRACT_BY_ROUTE.get(route.id);
      return item?.kind !== "pending_database" && item &&
        (route.data.directTables.length || route.data.rpcEffects.length
          || route.data.providerEndpoints.length ||
          rawRouteById.get(route.id)?.outboundCallObserved ||
          persistenceTraceTruncatedRoutes.has(route.id));
    }).map((route) => route.id),
    routesWithoutDataContract: dataGapRoutes.map((route) => route.id),
    // Two signals about one route that cannot both be true.
    routesSayingNoTableWhileTracingOne: routes.filter((route) => route.data.noPersistenceReason && route.data.directTables.length).map((route) => `${route.id}: ${route.data.directTables.join(", ")}`),
    duplicateRouteIds: sorted(duplicateRouteIds),
    routesMissingSource: routes.filter((route) => !route.source.file).map((route) => route.id),
    routesMissingWorkspace: routes.filter((route) => !route.workspace).map((route) => route.id),
    routesMissingDestination: routes.filter((route) => !route.contractCompleteness.destination).map((route) => route.id),
    apiRoutesMissingOpenApiContract: routes.filter((route) => route.route.startsWith("/api/") && !route.openApi).map((route) => route.id),
    formActionsWithoutRegisteredRoute: uiFormActionLinks.filter((link) => !formHasRoute(link)).map((link) => `${link.method} ${link.action}`),
    declaredDoorsNotRendered: declaredDoorProblems(),
    routeDestinationReviewsNotHeld: destinationReviewProblems(),
    growthRecordDoorsNotHeld: growthRecordDoorProblems(),
    ownerActionsWithoutRegisteredRoute: ownerActionContractChecks.filter((action) => !action.routeRegistered).map((action) => action.id),
    ownerActionsWithoutActiveTable: ownerActionContractChecks.filter((action) => !action.tableInMigrations).map((action) => action.id),
    activeTablesWithoutCreateMigration: tables.filter((table) => table.migrationLineage.createdBy.length === 0).map((table) => table.name),
    formulaTargetsOutsideActiveSchema: formulas.filter((formula) => formula.tables.some((table) => !tableNameSet.has(table))).map((formula) => formula.key),
    schedulableActionsWithoutRegisteredHandler: agents.schedulableActions.filter((action) => !action.handlerRegistered).map((action) => action.action)
  };
  return map;
}

function normalizeRepository(record, source, route, batch = null) {
  const status = record.integrationStatus || record.status || record.reviewStatus || record.disposition || "status_unrecorded";
  const repoUrl = record.repoUrl || record.repositoryUrl || record.url || record.officialUrl || null;
  const name = record.name || record.label || record.title || record.repository || record.fullName || record.slug || "unnamed repository record";
  return {
    id: `${source}:${record.slug || record.key || record.name || name}`,
    name,
    repository: record.repository || record.fullName || null,
    repoUrl,
    status,
    license: record.license || record.licence || null,
    licenseRisk: record.licenseRisk || record.licenceRisk || null,
    category: Array.isArray(record.category) ? record.category : typeof record.category === "string" ? [record.category] : [],
    productFit: Array.isArray(record.productFit) ? record.productFit : Array.isArray(record.product_fit) ? record.product_fit : [],
    enabledInProduction: record.enabledInProduction === true,
    source,
    batch,
    catalogRoute: route,
    repositoryVerified: record.repositoryVerified ?? null,
    repositoryUrlPresent: Boolean(repoUrl)
  };
}

function loadTsExport(relative, exportName) {
  const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
  const marker = new RegExp(`export\\s+const\\s+${exportName}\\b[^=]*=\\s*`).exec(source);
  if (!marker) return [];
  const start = marker.index + marker[0].length;
  if (source[start] !== "[") return [];
  const expression = extractArrayExpression(source, start);
  const value = vm.runInNewContext(`(${expression})`, Object.create(null), { timeout: 200 });
  return Array.isArray(value) ? value : [];
}

function extractArrayExpression(source, start) {
  const stack = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (character === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (["'", "\"", "`"].includes(character)) { quote = character; continue; }
    if (character === "[" || character === "{" || character === "(") stack.push(character);
    if (character === "]" || character === "}" || character === ")") {
      stack.pop();
      if (stack.length === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unterminated array export beginning at offset ${start}`);
}

function readRepositoryIntake() {
  const relative = "data/repository-intake-2026-09-18.json";
  const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
  const parsed = JSON.parse(source);
  const records = [];
  function visit(value, ancestry = []) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, ancestry);
      return;
    }
    if (!value || typeof value !== "object") return;
    const repoUrl = value.repoUrl || value.repositoryUrl || value.url || null;
    const name = value.name || value.repository || value.fullName || null;
    if (repoUrl || (name && (value.status || value.category))) {
      records.push(normalizeRepository({ ...value, name, repoUrl }, relative, "/research-lab/requested-repositories", ancestry.join(".")));
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...ancestry, key]);
  }
  visit(parsed);
  return { records, summary: { topLevelKeys: Object.keys(parsed || {}), entryCount: records.length } };
}

function findFiles(directories, predicate) {
  const found = [];
  function walk(relative) {
    const absolute = path.join(ROOT, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (predicate(entry.name, child)) found.push(child.split(path.sep).join("/"));
    }
  }
  for (const directory of directories) walk(directory);
  return found;
}

function infrastructureFiles() {
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("docker-compose") || /^Dockerfile(?:\.|$)/.test(name) || ["vercel.json", "Procfile", ".nvmrc", "pnpm-workspace.yaml"].includes(name))
    .map((name) => name);
  const files = [
    ...findFiles([".github/workflows", "infra", "ops", "config", "docs/infrastructure"], () => true),
    ...rootFiles
  ];
  return sorted(files);
}

function countBy(items, keyFunction) {
  const counts = {};
  for (const item of items) {
    const key = typeof keyFunction === "function" ? keyFunction(item) : item[keyFunction];
    counts[key || "unclassified"] = (counts[key || "unclassified"] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function markdownFor(map) {
  const rows = [
    "# Repository Capability Map",
    "",
    "Generated by `node scripts/generate-capability-inventory.cjs --write`; verify with `node scripts/generate-capability-inventory.cjs --check`.",
    "",
    "This map is derived from the checked out source. The JSON inventory is the row-level index for all routes, tables, migrations, repository records, formulas, agents, skills, and infrastructure sources.",
    "",
    "## Coverage",
    "",
    "| Area | Current inventory |",
    "| --- | ---: |",
    `| Registered HTTP route operations | ${map.summary.routeOperationCount} |`,
    `| GET / POST / PATCH / DELETE | ${map.summary.routesByMethod.GET || 0} / ${map.summary.routesByMethod.POST || 0} / ${map.summary.routesByMethod.PATCH || 0} / ${map.summary.routesByMethod.DELETE || 0} |`,
    `| Declared page routes / workspace groups | ${map.summary.declaredPageCount} / ${map.summary.workspaceCount} |`,
    `| API operations matched to OpenAPI | ${map.summary.openApiApiOperationCount} |`,
    `| Destinations using workspace-home fallback | ${map.summary.routesUsingWorkspaceHomeFallback} |`,
    `| Form action destinations traced to registered pages | ${map.summary.formActionLinkCount} |`,
    `| Traced forms with no matching method/path route | ${map.summary.formActionsWithoutRegisteredRoute} |`,
    `| Route data contracts needing explicit review | ${map.summary.routeDataContractsNeedingExplicitReview} |`,
    `| Active migration tables | ${map.summary.databaseTableCount} |`,
    `| Runtime-queried / never-queried tables | ${map.summary.queriedTableCount} / ${map.summary.neverQueriedTableCount} |`,
    `| Migration files | ${map.summary.migrationCount} |`,
    `| SQL functions / triggers / calling routes / missing function definition | ${map.summary.databaseFunctionCount} / ${map.summary.databaseTriggerCount} / ${map.summary.routesCallingDatabaseFunctions} / ${map.summary.routesWithMissingDatabaseFunctionDefinition} |`,
    `| Resource route/table/schema contracts / record pages / child resources | ${map.summary.resourceTableContractCount} / ${map.summary.ownerRecordPageCount} / ${map.summary.ownerRecordChildResourceCount} |`,
    `| Owner record form overrides and row actions / missing route | ${map.summary.ownerRecordActionCount} / ${map.summary.ownerRecordActionsWithoutRegisteredRoute} |`,
    `| Deterministic formulas with evaluators | ${map.summary.formulasWithEvaluator} / ${map.summary.formulaCount} |`,
    `| Local developer skills / agent strategies | ${map.summary.localSkillCount} / ${map.summary.agentStrategyCount} |`,
    `| Agent patterns / business AI skill groups / schedules / handlers | ${map.summary.agentPatternCount} / ${map.summary.businessAISkillCount} / ${map.summary.agentSchedulableActionCount} / ${map.summary.agentHandlerCount} |`,
    `| Reviewed repository records across catalogs | ${map.summary.repositoryRecordCountAcrossCatalogs} |`,
    `| Other tool/AI catalog entries / enabled repo records | ${map.summary.otherReferenceCatalogRecordCount} / ${map.summary.repositoryRecordsEnabledInProduction} |`,
    `| Research/reference-only repository records | ${map.summary.researchOrReferenceRepositoryRecordCount} |`,
    `| Infrastructure services / pipeline layers / expansion tracks | ${map.summary.infrastructureServiceCount} / ${map.summary.infrastructurePipelineLayerCount} / ${map.summary.infrastructureCapabilityTrackCount} |`,
    "",
    "## How to use the inventory",
    "",
    "Each `routeOperations` row records the live method/path, destination and its confidence, all-workspace owner, route-registry access metadata, request fields observed in source, response kind/status and literal JSON fields observed, OpenAPI operation metadata when it is an API route, source location, exact table lineage or an explicit data-contract review state. Request and response field observations describe repository source; they are not a claim of runtime validation for every field.",
    "",
    "Each `tables` row records the parsed columns, creating and altering migrations, row-level-security and policy evidence, tenant-scope classification, subsystem, and query-audit state. Each route's `data.tableLineage` links directly to these schema rows and their migrations. `migrations` maps every migration file to the tables it creates, changes, drops, or protects.",
    "The `databaseFunctions` catalog traces SQL function reads and writes from their migration definitions. Routes that call PostgREST functions list the function, its source migration, and the tables it reads or writes under `data.rpcEffects`. Triggered writes from those SQL functions are listed under `data.triggeredEffects`; unresolved function definitions are listed under `databaseFunctionReviewGaps`.",
    "",
    "The remaining sections connect the existing resource registries, deterministic record checks, formulas, bounded agent actions, local development skills, repository catalogs, and infrastructure manifest to their routes and database evidence.",
    "",
    "## What the map says today",
    "",
    `- The HTTP layer registers ${map.summary.routeOperationCount} unique method/path operations across ${map.summary.workspaceCount} workspace groups. Every row has a source location and destination. ${map.summary.routesWithoutDestination} lack a destination; “workspace_fallback” destinations lead to the workspace home and do not prove which screen owns the action.`,
    `- All ${map.summary.openApiApiOperationCount} registered API operations have an OpenAPI operation record. Each API row contains its operation ID, summary, tags, request body contract reference, authentication marker, and documented response statuses.`,
    `- ${map.summary.routeDataContractsNeedingExplicitReview} operations are explicitly listed in \`routeDataContractGaps\` because the checked out route handler or a formal resource/record registry does not prove the exact table effects or a no-write reason. Their module-level candidate tables are kept separate from confirmed endpoint tables.`
  ];
  rows.push(`- ${map.summary.routesUsingWorkspaceHomeFallback} operations are listed in \`routeDestinationReviewGaps\` because their page destination is still the workspace home fallback.`);
  rows.push(
    "",
    "### Route data-contract evidence",
    "",
    "| Evidence state | Operations |",
    "| --- | ---: |",
    ...Object.entries(map.summary.routeDataMappingCounts).map(([state, count]) => `| \`${state}\` | ${count} |`)
  );
  if (map.summary.neverQueriedTableCount) {
    rows.push(`- ${map.summary.neverQueriedTableCount} active schema tables are not queried by runtime source according to the repository's comment-stripped orphan-table audit. Their table-level dispositions are listed in the JSON; the map does not invent a route for a schema that has not been built.`);
  }
  if (map.summary.resourceTableContractGaps) {
    rows.push(`- ${map.summary.resourceTableContractGaps} explicit resource contracts do not yet prove the full route → table → required-column chain. See \`resourceContractChecks\` for the exact entries.`);
  }
  rows.push(
    "",
    "### Workspace destinations",
    "",
    "| Workspace | Route prefixes | Operations | Pages | Home |",
    "| --- | --- | ---: | ---: | --- |",
    ...map.workspaces.map((workspace) => `| ${workspace.name} | ${workspace.routePrefixes.map((prefix) => `\`${prefix}\``).join(", ")} | ${workspace.routeCount} | ${workspace.registeredPageCount} | \`${workspace.homeRoute}\` |`),
    "",
    "### Destination workflows still open",
    "",
    "These operations still resolve to workspace homes. Each needs a real destination workflow; an entry in this list is not provider execution or customer proof.",
    "",
    "| Operation | Workspace | Current fallback | Source |",
    "| --- | --- | --- | --- |",
    ...map.routeDestinationReviewGaps.map((gap) => `| \`${gap.id}\` | ${gap.workspace} | \`${gap.currentDestination}\` | \`${gap.source.file}:${gap.source.line}\` |`),
    ...(map.routeDestinationReviewGaps.length ? [] : ["| None | — | — | — |"]),
    "",
    "### Research-only repositories",
    "",
    "All 497 repository records are in `repositories.records`; the 259 records marked research/reference/watch-only are also listed under `repositories.researchOrReferenceRecords`. The additional 25 creator-tool, technology, and AI integration catalog entries are row-level under `repositories.otherReferenceRecords`. Each record retains source catalog, status, route, and any URL/license/product-fit fields present in the source.",
    "",
    "Source catalogs include the reviewed 269-entry open-source register, requested repositories, the dated 30 research-only and 30 install-target snapshot, screenshot-radar batches present in this checkout, GitHub radar, creator tools, technology registry, and AI integration registry. Duplicate records are preserved with their catalog source so differing reviews remain visible. Research/reference status does not enable installation or runtime execution.",
    "",
    "### Skills and agents",
    "",
    "The 11 local `SKILL.md` files are developer instructions, not customer features. The agent strategy catalog includes 13 reusable strategies, five architecture patterns, ten business-AI skill groups, verified model profiles, screenshot-derived strategies, and its packaging boundaries. Runtime agent rows list five schedulable actions, six registered handlers, approval policy, routes, and tables. An external agent repository is not a running SONARA agent.",
    "",
    "### Formulas and infrastructure",
    "",
    "The formula registry maps every deterministic formula to its input names, target tables, output unit, evaluator result, compute route, save route, and migration files. The infrastructure manifest maps services to readiness routes and environment-key names; the separate `sourceFiles` list inventories workflow, container, operations, and infrastructure documentation. Secret values are never part of this map.",
    "",
    "## Capability contract for new work",
    "",
    "Before adding a visible button, form, API action, agent, formula, or background job, give it a stable capability identifier and record:",
    "",
    "1. the exact route or event destination and the page that reaches it;",
    "2. its owning workspace, tenant boundary, required role/plan, and approval rule;",
    "3. validated input fields and a typed output or state transition;",
    "4. the work table(s), schema columns, migration lineage, and source of truth;",
    "5. retries/idempotency and audit/telemetry behavior for writes or jobs; and",
    "6. a truthful setup-required, unsupported, or research-only fallback where it cannot run.",
    "",
    "A no-write action must explicitly say why it has no data table, such as deterministic calculation, static catalog, or navigation. A webhook is not presumed to be no-write; unmapped webhook effects stay in the review list. A research entry never receives an install route merely because it appears in a repository list.",
    "",
    "## Exact inventories",
    "",
    "- `data/capability-inventory.json` — full machine-readable capability map.",
    "- `lib/sonara-route-registry.cjs` and `routes/` — page metadata and live HTTP registrations.",
    "- `lib/sonara-module-crud.cjs` and `routes/sonara-last9-routes.cjs` — record forms, required fields, defaults, and work tables.",
    "- `lib/sonara-migration-columns.cjs`, `supabase/migrations/`, and `lib/sonara-database-contract.cjs` — schema and migration lineage.",
    "- `data/open-source-tools.ts`, `lib/sonara-requested-repository-registry.cjs`, and `lib/sonara-screenshot-tool-radar-batch*.cjs` — external repository reviews.",
    "- `lib/sonara-formula-library.cjs`, `lib/sonara-agent-authority.cjs`, and `lib/sonara-infrastructure-manifest.cjs` — formulas, agent policy, and infrastructure contracts."
  );
  return `${rows.join("\n")}\n`;
}

function validateMap(map) {
  const errors = [];
  for (const [key, value] of Object.entries(map.validation)) {
    // Keep the gate strict, but name the actual review evidence that failed.
    // Counts alone hide the route or file the engineer needs to repair.
    if (Array.isArray(value) && value.length) {
      errors.push(`${key}: ${value.length}`);
      for (const detail of value.slice(0, 20)) errors.push(`${key}: ${String(detail).slice(0, 300)}`);
      if (value.length > 20) errors.push(`${key}: ... ${value.length - 20} additional item(s)`);
    }
  }
  if (!map.routeOperations.length) errors.push("no live route registrations were discovered");
  if (map.routeOperations.some((route) => !route.source.file || !route.workspace)) errors.push("one or more routes lack source or workspace ownership");
  // A null destination is allowed for a webhook and for a route recorded in
  // lib/sonara-route-destination-reviews.cjs as having no page by design --
  // whose evidence routeDestinationReviewsNotHeld has already checked.
  if (map.routeOperations.some((route) => !route.destination.route && !["machine_ingress", "reviewed_no_page"].includes(route.destination.confidence))) errors.push("one or more routes lack a page or a reviewed reason for having none");
  return errors;
}

function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) {
    console.error("Use exactly one of --write or --check.");
    process.exitCode = 2;
    return;
  }
  const map = buildInventory();
  const json = `${JSON.stringify(map, null, 2)}\n`;
  const markdown = markdownFor(map);
  const invariantErrors = validateMap(map);
  if (invariantErrors.length) {
    console.error(`Capability inventory invariants failed:\n- ${invariantErrors.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  if (write) {
    fs.writeFileSync(DATA_PATH, json);
    fs.writeFileSync(DOC_PATH, markdown);
    console.log(`Wrote ${relativeFile(DATA_PATH)} and ${relativeFile(DOC_PATH)}: ${map.summary.routeOperationCount} routes, ${map.tables.length} tables, ${map.migrations.length} migrations.`);
    return;
  }
  const differences = [];
  if (!fs.existsSync(DATA_PATH) || fs.readFileSync(DATA_PATH, "utf8") !== json) differences.push(relativeFile(DATA_PATH));
  if (!fs.existsSync(DOC_PATH) || fs.readFileSync(DOC_PATH, "utf8") !== markdown) differences.push(relativeFile(DOC_PATH));
  if (differences.length) {
    console.error(`Capability inventory is stale. Run node scripts/generate-capability-inventory.cjs --write.\n${differences.map((file) => `- ${file}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Capability inventory verified: ${map.summary.routeOperationCount} routes, ${map.tables.length} active tables, ${map.migrations.length} migrations, ${map.summary.repositoryRecordCountAcrossCatalogs} repository records.`);
}

main();

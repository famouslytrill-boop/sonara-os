import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(repoRoot, "openapi", "sonara.yaml");
const source = await readFile(specPath, "utf8");

assert.match(source, /^openapi: 3\.1\.0$/m, "OpenAPI contract must use version 3.1.0.");
assert.match(source, /^info:\s*$/m, "OpenAPI contract is missing info metadata.");
assert.match(source, /^paths:\s*$/m, "OpenAPI contract is missing paths.");
assert.match(source, /^components:\s*$/m, "OpenAPI contract is missing components.");
assert.match(source, /^    bearerAuth:\s*$/m, "OpenAPI contract must define bearerAuth.");
assert.match(source, /^    ErrorResponse:\s*$/m, "OpenAPI contract must define ErrorResponse.");

const documented = new Set();
const operationIds = [];
let currentPath;

for (const line of source.split(/\r?\n/)) {
  const pathMatch = line.match(/^  (\/api\/[^:]+):\s*$/);
  if (pathMatch) {
    currentPath = pathMatch[1];
    continue;
  }

  const methodMatch = line.match(/^    (get|post|patch|delete|put):\s*$/);
  if (methodMatch && currentPath) {
    documented.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    continue;
  }

  const operationMatch = line.match(/^      operationId: ([A-Za-z][A-Za-z0-9]+)\s*$/);
  if (operationMatch) operationIds.push(operationMatch[1]);
}

const app = require(path.join(repoRoot, "server.js"));
const registered = new Set();

for (const layer of app._router?.stack ?? []) {
  if (!layer.route || typeof layer.route.path !== "string" || !layer.route.path.startsWith("/api/")) continue;
  const contractPath = layer.route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  for (const method of Object.keys(layer.route.methods)) {
    registered.add(`${method.toUpperCase()} ${contractPath}`);
  }
}

const missing = [...registered].filter((route) => !documented.has(route)).sort();
const stale = [...documented].filter((route) => !registered.has(route)).sort();
const duplicateOperationIds = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);

assert.equal(missing.length, 0, `OpenAPI is missing registered routes:\n${missing.join("\n")}`);
assert.equal(stale.length, 0, `OpenAPI documents routes not registered by Express:\n${stale.join("\n")}`);
assert.equal(operationIds.length, documented.size, "Every documented operation must have one operationId.");
assert.equal(duplicateOperationIds.length, 0, `Duplicate operationId values:\n${[...new Set(duplicateOperationIds)].join("\n")}`);
assert.doesNotMatch(source, /\b(TODO|TBD|placeholder)\b/i, "OpenAPI contract cannot contain placeholder language.");

const pathCount = new Set([...documented].map((route) => route.slice(route.indexOf(" ") + 1))).size;
console.log(`OpenAPI contract verified: ${documented.size} operations across ${pathCount} paths match the Express runtime.`);

"use strict";

const assert = require("node:assert/strict");
const app = require("../server");
const {
  PRODUCTION_ORIGIN,
  ROUTE_REGISTRY,
  PUBLIC_SITEMAP_ROUTES
} = require("../lib/sonara-route-registry.cjs");

const registrations = [];
for (const layer of app._router.stack) {
  if (!layer.route) continue;
  const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
  for (const method of Object.keys(layer.route.methods)) {
    for (const route of paths) registrations.push(`${method.toUpperCase()} ${route}`);
  }
}

const duplicateRegistrations = registrations.filter((entry, index) => registrations.indexOf(entry) !== index);
assert.deepEqual([...new Set(duplicateRegistrations)], [], "Express has duplicate method/path registrations");

const registryPaths = ROUTE_REGISTRY.map((record) => record.route);
const duplicateRegistryPaths = registryPaths.filter((route, index) => registryPaths.indexOf(route) !== index);
assert.deepEqual([...new Set(duplicateRegistryPaths)], [], "Route registry has duplicate paths");

const registeredGets = new Set(registrations.filter((entry) => entry.startsWith("GET ")).map((entry) => entry.slice(4)));
const missingGets = registryPaths.filter((route) => !registeredGets.has(route));
assert.deepEqual(missingGets, [], `Registered GET routes are missing: ${missingGets.join(", ")}`);

for (const record of ROUTE_REGISTRY) {
  assert.equal(record.method, "GET", `${record.route} has an unexpected registry method`);
  assert.ok(record.title && record.description, `${record.route} needs route metadata`);
  assert.ok(record.navigationPlacement, `${record.route} needs a navigation placement`);
  assert.ok(record.indexingPolicy, `${record.route} needs an indexing policy`);
  if (record.visibility !== "public") {
    assert.equal(record.sitemap, false, `${record.route} must not appear in the public sitemap`);
    assert.equal(record.canonicalUrl, null, `${record.route} must not advertise a public canonical URL`);
  }
}

for (const record of PUBLIC_SITEMAP_ROUTES) {
  assert.equal(record.visibility, "public", `${record.route} is not a public route`);
  assert.ok(record.canonicalUrl.startsWith(PRODUCTION_ORIGIN), `${record.route} has an invalid canonical origin`);
  assert.doesNotMatch(record.route, /^\/(admin|account)(\/|$)/, `${record.route} exposes a protected surface`);
}

console.log(`Route registry verification passed: ${ROUTE_REGISTRY.length} required GET routes, ${registrations.length} total registrations, no duplicates.`);

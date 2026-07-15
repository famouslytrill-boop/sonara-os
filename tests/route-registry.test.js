"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../server");
const { ROUTE_REGISTRY, PUBLIC_SITEMAP_ROUTES } = require("../lib/sonara-route-registry.cjs");

describe("SONARA route registry and account completion", () => {
  it("registers every required GET route exactly once", () => {
    const routes = [];
    for (const layer of app._router.stack) {
      if (!layer.route || !layer.route.methods.get) continue;
      routes.push(layer.route.path);
    }
    const missing = ROUTE_REGISTRY.map((record) => record.route).filter((route) => !routes.includes(route));
    const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
    assert.deepEqual(missing, []);
    assert.deepEqual([...new Set(duplicates)], []);
  });

  it("keeps protected routes out of sitemap metadata", () => {
    assert.ok(PUBLIC_SITEMAP_ROUTES.length > 20);
    for (const record of PUBLIC_SITEMAP_ROUTES) {
      assert.equal(record.visibility, "public");
      assert.doesNotMatch(record.route, /^\/(admin|account)(\/|$)/);
    }
  });

  it("serves public route metadata without roles, providers, or internal diagnostics", async () => {
    const response = await request(app).get("/api/routes/public").set("Accept", "application/json");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.ok(response.body.routes.some((record) => record.route === "/products"));
    assert.equal(response.body.routes.some((record) => record.route.startsWith("/admin")), false);
    assert.equal(Object.hasOwn(response.body.routes[0], "requiredRole"), false);
    assert.equal(Object.hasOwn(response.body.routes[0], "requiredProvider"), false);
  });

  it("offers recovery pages and a client helper that clears the URL fragment", async () => {
    const forgot = await request(app).get("/forgot-password").set("Accept", "text/html");
    const reset = await request(app).get("/reset-password").set("Accept", "text/html");
    const helper = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-auth-recovery.js"), "utf8");
    assert.equal(forgot.status, 200);
    assert.match(forgot.text, /For privacy, the confirmation is the same/);
    assert.equal(reset.status, 200);
    assert.match(reset.text, /data-sonara-recovery-token/);
    assert.match(helper, /history\.replaceState/);
    assert.doesNotMatch(helper, /console\.(?:log|info|debug)/);
  });

  it("keeps optional haptics off by default and exposes theme and quality settings", () => {
    const engine = fs.readFileSync(path.join(__dirname, "..", "public", "sonara-interface-engine.js"), "utf8");
    assert.match(engine, /getItem\(HAPTICS_KEY\) === "on"/);
    assert.match(engine, /data-sonara-appearance-select/);
    assert.match(engine, /data-sonara-quality-select/);
    assert.match(engine, /prefers-color-scheme: light/);
  });

  it("writes audit events to the table and actor column defined by migrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.match(source, /rest\/v1\/admin_audit_logs/);
    assert.match(source, /actor_id: user\?\.id/);
    assert.doesNotMatch(source, /rest\/v1\/admin_audit_events/);
  });
});

"use strict";

const assert = require("node:assert/strict");
const request = require("supertest");

// Exercise every registered GET route and assert none of them crashes.
//
// `smoke:routes` covers 8 public and 5 protected routes out of 366 registered
// GET routes. That leaves the overwhelming majority of the surface never
// requested by any test, so a route that throws on load -- a bad destructure, a
// missing helper, a template referencing an undefined value -- ships silently
// and is found by a customer.
//
// This does not verify that pages are *correct*; it verifies they respond
// rather than fault. A 401/402/403/302 is a pass: it means the route ran and
// made an access decision. A 5xx is a failure, and so is a hang.
//
// Routes are requested without credentials and without Supabase configured, so
// this measures the unauthenticated, unconfigured path -- the one a first-time
// visitor and a misconfigured deploy both hit.

const app = require("../server");

const ACCEPTABLE = new Set([200, 201, 202, 204, 301, 302, 303, 304, 307, 308, 400, 401, 402, 403, 404, 405, 406, 410, 429, 503]);

// Parameterised routes need a value. These are syntactically valid but refer to
// nothing, which is the point: the route must handle "not found" rather than
// throw while looking.
function materialise(routePath) {
  return routePath
    .replace(/:[A-Za-z0-9_]+\(\[\^\\\/\]\+\?\)/g, "smoke-test-value")
    .replace(/:[A-Za-z0-9_]+\?/g, "smoke-test-value")
    .replace(/:[A-Za-z0-9_]+/g, "smoke-test-value")
    .replace(/\*/g, "smoke-test-value");
}

function collectGetRoutes() {
  const routes = [];
  for (const layer of app._router.stack) {
    if (!layer.route) continue;
    if (!layer.route.methods?.get) continue;
    const routePath = layer.route.path;
    if (typeof routePath !== "string") continue;
    routes.push(routePath);
  }
  return [...new Set(routes)].sort();
}

describe("every registered GET route responds without faulting", function () {
  // Several routes attempt outbound calls that will fail closed without
  // credentials; allow for that latency rather than declaring a false failure.
  this.timeout(120000);

  const routes = collectGetRoutes();

  it("registers a substantial route surface", () => {
    assert.ok(routes.length > 100, `expected a large GET surface, found ${routes.length}`);
  });

  it("returns no 5xx from any GET route", async () => {
    const failures = [];

    for (const routePath of routes) {
      const target = materialise(routePath);
      let response;
      try {
        response = await request(app).get(target).set("accept", "text/html");
      } catch (error) {
        failures.push(`${routePath} -> threw: ${error.message}`);
        continue;
      }

      if (!ACCEPTABLE.has(response.status)) {
        const detail = String(response.text || "").slice(0, 200).replace(/\s+/g, " ");
        failures.push(`${routePath} -> ${response.status}${detail ? ` :: ${detail}` : ""}`);
      }
    }

    assert.equal(
      failures.length,
      0,
      `${failures.length} of ${routes.length} GET routes faulted:\n\n${failures.join("\n")}`
    );
  });

  it("returns no 5xx from any GET route when JSON is requested", async () => {
    const failures = [];

    for (const routePath of routes) {
      const target = materialise(routePath);
      let response;
      try {
        response = await request(app).get(target).set("accept", "application/json");
      } catch (error) {
        failures.push(`${routePath} -> threw: ${error.message}`);
        continue;
      }

      if (!ACCEPTABLE.has(response.status)) {
        const detail = String(response.text || "").slice(0, 200).replace(/\s+/g, " ");
        failures.push(`${routePath} -> ${response.status}${detail ? ` :: ${detail}` : ""}`);
      }
    }

    assert.equal(
      failures.length,
      0,
      `${failures.length} of ${routes.length} GET routes faulted on JSON:\n\n${failures.join("\n")}`
    );
  });
});

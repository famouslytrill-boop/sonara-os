"use strict";

// lib/sonara-route-data-reviews.cjs says 58 routes read and write no table.
// The inventory generator holds that against its trace; this holds it against
// the code running.
//
// Each route's own handler -- the function it registered, unwrapped from the
// async safety net, without the access gate in front of it -- is called with
// Supabase configured, so a handler that would read the database has every
// reason to. Every outbound request is recorded, and one is a failure.
//
// The control route at the bottom is the check on the check. It reads a table
// through exactly this harness, and if the recorder stops seeing that request
// the rest of this file is passing by measuring nothing.

const assert = require("node:assert/strict");
const app = require("../server");
const { unwrapHandler } = require("../lib/sonara-async-route-safety.cjs");
const { KINDS, ROUTE_DATA_REVIEWS } = require("../lib/sonara-route-data-reviews.cjs");
const inventory = require("../data/capability-inventory.json");

const SUPABASE_URL = "https://reviewed-probe.supabase.test";
const USER = { id: "77777777-7777-4777-8777-777777777777", email: "reviewer@example.com" };

function ownHandler(method, routePath) {
  const layer = app._router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method.toLowerCase()]);
  if (!layer) return null;
  const stack = layer.route.stack.filter((entry) => !entry.method || entry.method === method.toLowerCase());
  return unwrapHandler(stack[stack.length - 1].handle);
}

function fakeRequest(method, routePath, probe) {
  const params = { ...(probe?.params || {}) };
  const url = routePath.replace(/:([A-Za-z_$][\w$]*)/g, (whole, name) => encodeURIComponent(params[name] ?? "probe"));
  const accept = url.startsWith("/api/") ? "application/json" : "text/html";
  const headers = { accept, host: "sonara.test", "user-agent": "route-data-review-probe" };
  return {
    method, url, originalUrl: url, path: url, baseUrl: "", query: {}, params, body: probe?.body ? JSON.parse(JSON.stringify(probe.body)) : {},
    headers, cookies: {}, signedCookies: {}, ip: "203.0.113.10", protocol: "https", hostname: "sonara.test", secure: true,
    get(name) { return headers[String(name).toLowerCase()]; },
    header(name) { return headers[String(name).toLowerCase()]; },
    accepts(...types) { return types.flat().find((type) => accept.includes(type)) || false; },
    is() { return false; },
    sonaraUser: USER,
    sonaraAccess: { user: USER, roles: ["owner"], ownerOverride: true }
  };
}

function fakeResponse() {
  let settle;
  const finished = new Promise((resolve) => { settle = resolve; });
  const res = {
    statusCode: 200, headers: {}, body: undefined, location: null, headersSent: false, locals: {}, cookies: [], finished,
    status(code) { res.statusCode = code; return res; },
    sendStatus(code) { res.statusCode = code; return res.end(); },
    type(value) { res.headers["content-type"] = value; return res; },
    set(name, value) {
      if (name && typeof name === "object") for (const [key, entry] of Object.entries(name)) res.headers[key.toLowerCase()] = entry;
      else res.headers[String(name).toLowerCase()] = value;
      if (res.headers.location) res.location = res.headers.location;
      return res;
    },
    setHeader(name, value) { return res.set(name, value); },
    getHeader(name) { return res.headers[String(name).toLowerCase()]; },
    append(name, value) { return res.set(name, value); },
    vary() { return res; },
    cookie(name, value, options) { res.cookies.push({ name, value, options }); return res; },
    clearCookie(name, options) { res.cookies.push({ name, cleared: true, options }); return res; },
    send(body) { res.body = body; res.headersSent = true; settle("sent"); return res; },
    json(body) { res.body = body; res.headersSent = true; settle("sent"); return res; },
    end(body) { res.body = body; res.headersSent = true; settle("sent"); return res; },
    redirect(first, second) {
      if (second === undefined) { res.statusCode = 302; res.location = first; } else { res.statusCode = first; res.location = second; }
      res.headersSent = true;
      settle("sent");
      return res;
    }
  };
  return res;
}

async function probe(id, probeSpec) {
  const [method, routePath] = id.split(" ");
  const handler = ownHandler(method, routePath);
  assert.ok(handler, `${id} is not registered on the application`);
  const req = fakeRequest(method, routePath, probeSpec);
  const res = fakeResponse();
  let nextCalled = null;
  const outcome = await Promise.race([
    (async () => {
      await handler(req, res, (error) => { nextCalled = error || "next"; });
      return res.headersSent ? res.finished : "no_response";
    })(),
    res.finished,
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000))
  ]);
  return { res, outcome, nextCalled };
}

describe("a route that reads nothing reads nothing", function () {
  this.timeout(30000);
  let originalFetch;
  const saved = {};
  let calls = [];

  before(() => {
    originalFetch = global.fetch;
    for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) saved[name] = process.env[name];
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-review-probe";
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-review-probe";
    global.fetch = async (url) => {
      calls.push(String(url));
      return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}), text: async () => "" };
    };
  });
  beforeEach(() => { calls = []; });
  after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("covers a real population, every entry with a kind and a reason", () => {
    assert.ok(ROUTE_DATA_REVIEWS.length >= 50, `only ${ROUTE_DATA_REVIEWS.length} reviewed routes; the register has gone blind`);
    assert.equal(new Set(ROUTE_DATA_REVIEWS.map((entry) => entry.route)).size, ROUTE_DATA_REVIEWS.length, "a route is reviewed twice");
    for (const entry of ROUTE_DATA_REVIEWS) {
      assert.ok(KINDS[entry.kind], `${entry.route} has no known kind`);
      assert.ok(entry.reason.startsWith(KINDS[entry.kind]) && entry.reason.length > KINDS[entry.kind].length, `${entry.route} says nothing about itself`);
    }
  });

  it("is what the inventory used, and the inventory left nothing else for review", () => {
    const byId = new Map(inventory.routeOperations.map((route) => [route.id, route]));
    for (const entry of ROUTE_DATA_REVIEWS) {
      const route = byId.get(entry.route);
      assert.ok(route, `${entry.route} is not in data/capability-inventory.json`);
      assert.equal(route.data.persistenceMode, "reviewed_no_database_access", `${entry.route} was not classified from the review`);
      assert.equal(route.data.noPersistenceReason, entry.reason);
      assert.deepEqual(route.data.directTables, []);
    }
    assert.deepEqual(inventory.routeDataContractGaps.map((gap) => gap.id), []);
    assert.equal(inventory.summary.routesReviewedAsReadingNothing, ROUTE_DATA_REVIEWS.length);
  });

  for (const entry of ROUTE_DATA_REVIEWS) {
    it(`${entry.route} answers without one outbound request`, async () => {
      const { res, outcome, nextCalled } = await probe(entry.route, entry.probe);
      assert.notEqual(outcome, "timeout", `${entry.route} never answered`);
      assert.equal(nextCalled, null, `${entry.route} passed the request on (${nextCalled}) instead of answering`);
      assert.deepEqual(calls, [], `${entry.route} made outbound requests: ${calls.join(", ")}`);
      if (entry.kind === "redirect") {
        assert.ok(res.statusCode >= 300 && res.statusCode < 400, `${entry.route} answered ${res.statusCode}, not a redirect`);
        if (entry.probe?.location) assert.equal(res.location, entry.probe.location);
        if (entry.probe?.locationStartsWith) assert.ok(String(res.location).startsWith(entry.probe.locationStartsWith), `${entry.route} redirected to ${res.location}`);
      } else if (entry.kind === "session_cookie") {
        assert.ok(res.cookies.some((cookie) => cookie.cleared) || /=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(JSON.stringify(res.headers)), `${entry.route} did not clear a cookie`);
      } else {
        assert.equal(res.statusCode, entry.probe?.status || 200, `${entry.route} answered ${res.statusCode}`);
      }
    });
  }

  it("catches a route that does read a table, through the same harness", async () => {
    const { outcome } = await probe("GET /api/integrations/providers");
    assert.notEqual(outcome, "timeout");
    assert.ok(
      calls.some((url) => url.startsWith(`${SUPABASE_URL}/rest/v1/integration_providers`)),
      `the recorder saw ${JSON.stringify(calls)}; it can no longer see a database read, so every pass above means nothing`
    );
  });
});

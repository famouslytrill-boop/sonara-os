"use strict";

// The manifest that says who may see a page, checked against the server.
//
// lib/sonara-route-registry.cjs declares 248 routes with a `visibility`, a
// `requiredRole`, a `requiredPlan` and a `productOwner`. It is the closest
// thing this product has to a module boundary: it is what says which of the
// three studios owns a page and who is allowed to open it, and it is read by
// the sitemap, the navigation, the smoke tests and the route registry gate.
//
// **Nothing checked it against the server.** `scripts/verify-route-registry.cjs`
// asserts that every declared route is registered and that public routes are
// declared public; neither it nor any test ever asked whether a route declared
// `requiredRole: "customer"` actually refuses somebody who is not one.
//
// Measured on 19 August 2026: **16 of 246 declared GET routes served 200 to an
// anonymous visitor while declaring they required a customer.** None of them
// leaked data — thirteen are studio funnel pages with no database read, one is
// the support form, and the two account pages render a form whose write returns
// 401 and stores nothing. So the server was right about all sixteen and the
// manifest was wrong about all sixteen.
//
// That is worth failing a build over anyway. A boundary that misdescribes one
// route in fifteen cannot be used to reason about which pages belong to which
// studio, which is the question anybody separating them has to answer first.
//
// Probed against a *configured* server on purpose. Without Supabase, pages that
// would redirect instead render "setup required" and answer 200, so a check run
// on a bare machine measures the machine rather than the product.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-manifest",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-manifest"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");

// Visibilities that mean "anybody may open this without signing in".
const OPEN_TO_ANYONE = new Set(["public", "auth"]);

function declaredGets() {
  return ROUTE_REGISTRY.filter((record) =>
    record.method === "GET" && !record.route.includes(":") && !record.route.includes("*"));
}

describe("the route manifest agrees with the server", () => {
  let realFetch;
  let answers;

  before(() => {
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  before(async () => {
    // An anonymous visitor against a working database: every read answers, and
    // the session lookup says nobody is signed in.
    global.fetch = async (url) => {
      const target = String(url);
      const signedOut = target.includes("/auth/v1/user");
      return {
        ok: !signedOut,
        status: signedOut ? 401 : 200,
        headers: { get: () => null },
        json: async () => (signedOut ? { error: "no session" } : [])
      };
    };

    answers = [];
    for (const record of declaredGets()) {
      const response = await request(app).get(record.route).set("Accept", "text/html").redirects(0);
      answers.push({ ...record, status: response.status });
    }
  });

  it("has a manifest to check", () => {
    // Guards every assertion below. All of them pass over an empty list.
    const gets = declaredGets();
    assert.ok(gets.length > 200, `only ${gets.length} declared GET routes; this check has gone blind`);
    assert.ok(answers.length === gets.length, "not every declared route was probed");
  });

  it("declares a visibility this check understands, for every route", () => {
    // A visibility nobody here recognises would be skipped by both assertions
    // below, and skipping is how a check quietly stops covering something.
    const known = new Set(["public", "auth", "customer", "admin", "product"]);
    const unknown = [...new Set(ROUTE_REGISTRY.map((record) => record.visibility).filter((value) => !known.has(value)))];
    assert.deepEqual(unknown, [], `visibility values this check does not handle: ${unknown.join(", ")}`);
  });

  it("opens no page to a stranger that it says needs a customer", () => {
    const open = answers
      .filter((record) => record.status === 200 && !OPEN_TO_ANYONE.has(record.visibility))
      .map((record) => `${record.route} [${record.visibility}/${record.requiredRole || "no role"}] answered 200`);

    assert.deepEqual(
      open,
      [],
      "These routes answer a signed-out visitor with a page while the manifest says they need a signed-in customer.\n  "
        + open.join("\n  ")
        + "\n\nEither the page should refuse — send them to /login — or the manifest should say it is public. "
        + "Both are one-line changes; leaving them disagreeing is what is not allowed, because the manifest is what says which studio owns which page."
    );
  });

  it("refuses a stranger on every page it says is for a customer", () => {
    // The other direction, and the one that matters for a leak rather than for
    // tidiness: a page declared customer-only must actually turn somebody away.
    // 303 to /login, 401, 402 and 403 are all refusals; 200 is not.
    const REFUSALS = new Set([301, 302, 303, 307, 308, 401, 402, 403, 404, 503]);
    const admitted = answers
      .filter((record) => !OPEN_TO_ANYONE.has(record.visibility) && !REFUSALS.has(record.status))
      .map((record) => `${record.route} [${record.visibility}] answered ${record.status}`);
    assert.deepEqual(admitted, [], `these pages neither served nor refused a stranger cleanly:\n  ${admitted.join("\n  ")}`);
  });

  it("serves every page it says anybody may open", () => {
    // The reverse blind spot. A route declared public that redirects a stranger
    // is a manifest claiming a page exists for people who cannot reach it --
    // and the sitemap is built from this list, so it would be advertised too.
    const refused = answers
      .filter((record) => OPEN_TO_ANYONE.has(record.visibility) && record.status !== 200 && record.status !== 503)
      .map((record) => `${record.route} [${record.visibility}] answered ${record.status}`);
    assert.deepEqual(refused, [], `these routes are declared open to anyone and did not serve one:\n  ${refused.join("\n  ")}`);
  });

  it("gives every route to exactly one owner, from the three studios or the platform", () => {
    // The module boundary itself. Separating the studios means knowing what
    // belongs to each, and a route owned by nothing or by something that is not
    // a product is a route nobody would move.
    const OWNERS = new Set(["sonara_industries", "business_builder", "creator_studio", "growth_studio"]);
    const wrong = ROUTE_REGISTRY
      .filter((record) => !OWNERS.has(record.productOwner))
      .map((record) => `${record.route} -> ${record.productOwner}`);
    assert.deepEqual(wrong, [], `routes owned by nothing this product recognises:\n  ${wrong.join("\n  ")}`);

    // And every owner has to actually own something, or the boundary has
    // collapsed into one module wearing four names.
    for (const owner of OWNERS) {
      const count = ROUTE_REGISTRY.filter((record) => record.productOwner === owner).length;
      assert.ok(count > 0, `${owner} owns no routes; the module boundary has collapsed`);
    }
  });

  it("keeps a studio's pages under that studio's path", () => {
    // A Creator Studio page served from /business-builder/... would have to be
    // moved by hand if the studios were ever split, and nothing else would say
    // so. The platform owns the shared surface and is exempt.
    const PREFIX = {
      business_builder: "/business-builder",
      creator_studio: "/creator-studio",
      growth_studio: "/growth-studio"
    };
    const misfiled = ROUTE_REGISTRY
      .filter((record) => PREFIX[record.productOwner])
      .filter((record) => !record.route.startsWith(PREFIX[record.productOwner]))
      .map((record) => `${record.route} is owned by ${record.productOwner}`);
    assert.deepEqual(misfiled, [], `these routes sit outside their owner's path:\n  ${misfiled.join("\n  ")}`);
  });
});

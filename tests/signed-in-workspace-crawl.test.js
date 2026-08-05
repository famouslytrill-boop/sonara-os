"use strict";

// Can a customer who has just signed up open every workspace page?
//
// tests/no-dead-links.test.js crawls logged out, so 184 of the registered pages
// only ever answered "303 to /login". That proves they are protected. It proves
// nothing about what happens after signing in, and a page that throws for an
// authenticated customer looks identical to a healthy one from outside.
//
// This crawls the same router with a session attached. Supabase auth points at a
// host that never answers, and fetch is stubbed so:
//
//   /auth/v1/user returns a customer, so the session resolves;
//   /rest/v1/<table> returns an empty list, so every page renders the state a
//   brand-new account is actually in.
//
// The empty case is the right one to check. A workspace with no records is what
// every customer sees on their first day, it is the state most likely to divide
// by zero or read [0] of nothing, and it is the hardest state to reach by hand
// once an account has data in it.
//
// A note on the stub keys, because the first version of this file got it wrong
// in a way worth leaving a marker for. They were "anon-placeholder" and
// "service-role-placeholder", and isPlaceholderValue() in server.js matches the
// literal word "placeholder" -- so getReadiness() reported Supabase as
// unconfigured, isSupabaseConfigured() returned false, and the nineteen
// /business-builder/owner/* pages took requireBusinessManager's setup-required
// branch and redirected. The file passed, because a 303 is an accepted status
// here. The keys below are shaped like real ones for that reason, and
// "renders enough pages to prove the session is doing something" below fails if
// it ever regresses -- a guard on /dashboard alone did not catch it, since
// /dashboard authenticates through a path that does not consult readiness.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_KEYS = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const original = Object.fromEntries(SUPABASE_KEYS.map((key) => [key, process.env[key]]));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-crawl";
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-crawl";

// server.js reads configuration at require time, so the environment has to be
// in place before this line.
const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "new-customer@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

// Flipped by the paid-tier checks. Off means a free account that has never paid,
// which is the state 21 of these pages gate on.
let entitled = false;

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stubFetch() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();

    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});

    if (target.includes("/rest/v1/")) {
      const table = (target.split("/rest/v1/")[1] || "").split("?")[0];

      // The customer belongs to one organization and manages it.
      if (table === "organization_memberships") {
        return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
      }
      if (table === "business_memberships") {
        return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
      }
      if (table === "organizations") {
        return json([{ id: ORGANIZATION_ID, name: "New Customer Ltd" }]);
      }

      // getCustomerPaidEntitlement filters on entitlement_key=in.(...) with the
      // keys mapped to the product being opened. Echoing back a key the request
      // itself asked for keeps this honest: it grants exactly the entitlement
      // the page requires rather than a guess at what the column contains,
      // which is how an earlier attempt at this concluded that paying customers
      // were locked out when the stub simply had the wrong field name.
      if (entitled && table === "billing_entitlements") {
        const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1])
          .split(",").filter(Boolean);
        return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
      }

      if (method === "POST" || method === "PATCH") return json([{ id: "created" }], 201);
      return json([]);
    }

    // Anything else -- Stripe, Resend, a provider -- is unreachable, which is
    // the honest state for an account that has connected nothing.
    return undefined;
  };
}

function registeredPages() {
  const routes = [];
  (function walk(stack) {
    for (const layer of stack) {
      if (layer.route) routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      else if (layer.handle && layer.handle.stack) walk(layer.handle.stack);
    }
  })(app._router ? app._router.stack : app.router.stack);
  return [...new Set(routes.filter((route) => route.methods.includes("get")).map((route) => route.path))]
    .filter((route) => !route.includes(":"))
    .filter((route) => !route.startsWith("/api/"))
    .filter((route) => !route.startsWith("/admin"))
    .sort();
}

function asCustomer(page) {
  return request(app)
    .get(page)
    .set("Accept", "text/html")
    .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`)
    .redirects(0);
}

const REDIRECTS = [301, 302, 303, 307, 308];

describe("a signed-in customer opening every workspace", () => {
  let realFetch;

  before(() => {
    realFetch = global.fetch;
    global.fetch = stubFetch();
  });

  after(() => {
    global.fetch = realFetch;
    entitled = false;
    for (const key of SUPABASE_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  const pages = registeredPages();
  let statuses = new Map();

  it("finds enough pages to be crawling something", () => {
    assert.ok(pages.length >= 200, `only ${pages.length} pages found; this check has gone blind`);
  });

  it("is actually signed in, so the rest of this file means something", async () => {
    // Without this, every page would 303 to /login and the crawl below would
    // pass while proving nothing.
    const anonymous = await request(app).get("/dashboard").set("Accept", "text/html").redirects(0);
    assert.equal(anonymous.status, 303, "/dashboard renders without a session, so it cannot vouch for one");

    const res = await asCustomer("/dashboard");
    assert.equal(res.status, 200, `/dashboard returned ${res.status} for a signed-in customer`);
  });

  it("renders every workspace page without throwing", async function () {
    this.timeout(180000);
    const failures = [];
    for (const page of pages) {
      const res = await asCustomer(page);
      statuses.set(page, { status: res.status, location: res.headers.location });
      // 200 renders. A 3xx is checked below for where it actually leads. 402 is
      // the paid-plan boundary, covered by its own checks. 503 is this
      // codebase's "not set up yet" and says so on screen.
      if ([200, ...REDIRECTS, 402, 503].includes(res.status)) continue;
      failures.push(`${res.status}  ${page}`);
    }
    assert.deepEqual(failures, [], `these pages fail for a signed-in customer with no records:\n  ${failures.join("\n  ")}`);
  });

  it("renders enough pages to prove the session reaches past the front door", async () => {
    // The check that the /dashboard guard above is not enough for. A stub that
    // authenticates but leaves the app believing its database is unconfigured
    // sends whole blocks of workspaces down a setup-required redirect, and
    // every one of those is an accepted status -- so the crawl stays green
    // while the pages it exists to exercise are never rendered. Counting what
    // actually returned 200 is what notices.
    const rendered = [...statuses.values()].filter((entry) => entry.status === 200).length;
    assert.ok(rendered >= 180, `only ${rendered} of ${pages.length} pages rendered; the session is authenticating but the app is not serving workspaces`);
  });

  it("opens the fourteen owner record pages rather than bouncing to a second login", async () => {
    // These sit behind requireBusinessManager, which is a different gate from
    // the one protecting the rest of the application. A customer who is signed
    // in and manages their business should land on the page, not on another
    // login screen.
    const { OWNER_RECORD_PAGES } = require("../lib/sonara-owner-record-pages.cjs");
    assert.ok(OWNER_RECORD_PAGES.length >= 10, `only ${OWNER_RECORD_PAGES.length} owner pages; this check has gone blind`);
    const bounced = OWNER_RECORD_PAGES
      .map((page) => [page.path, statuses.get(page.path)])
      .filter(([, entry]) => !entry || entry.status !== 200)
      .map(([path, entry]) => `${entry ? entry.status : "unvisited"}  ${path}${entry?.location ? "  ->  " + entry.location : ""}`);
    assert.deepEqual(bounced, [], `these owner pages do not open for the manager who owns them:\n  ${bounced.join("\n  ")}`);
  });

  it("never redirects a signed-in customer into a page that is not there", async function () {
    this.timeout(120000);
    // A redirect that resolves is fine -- /billing sends you to
    // /business-builder/billing, /trust to /security. A redirect into a 404 is
    // a dead link wearing a 302, and the logged-out crawl cannot see these
    // because it never gets past the login gate to follow them.
    const broken = [];
    for (const [page, entry] of statuses) {
      if (!REDIRECTS.includes(entry.status) || !entry.location) continue;
      const target = entry.location.split("#")[0];
      if (!target.startsWith("/")) continue;
      const res = await asCustomer(target);
      if (res.status === 404 || res.status >= 500) broken.push(`${page}  ->  ${target}  (${res.status})`);
    }
    assert.deepEqual(broken, [], `these redirects lead nowhere:\n  ${broken.join("\n  ")}`);
  });

  it("offers a way to pay on every page it locks behind paying", async function () {
    this.timeout(60000);
    // 21 pages answer 402 to a free account. That is a correct answer, but only
    // if the page says so on screen and points somewhere. A bare status code
    // with no upgrade path is a dead end no different from a 404.
    const gated = [...statuses].filter(([, entry]) => entry.status === 402).map(([page]) => page);
    assert.ok(gated.length >= 10, `only ${gated.length} paid pages seen; this check has gone blind`);
    const silent = [];
    for (const page of gated) {
      const res = await asCustomer(page);
      if (!/href="\/pricing"/.test(res.text)) silent.push(page);
    }
    assert.deepEqual(silent, [], `these pages refuse access without offering a way to buy it:\n  ${silent.join("\n  ")}`);
  });

  it("opens those same pages once the customer has paid for them", async function () {
    this.timeout(60000);
    // The other half. A paywall that never lifts is the failure this codebase
    // has already shipped once: lib/sonara-paid-access.cjs records a catalog
    // that defined "entitlement verified" as "the plan is free", leaving all
    // thirty-one paid products permanently shut.
    const gated = [...statuses].filter(([, entry]) => entry.status === 402).map(([page]) => page);
    entitled = true;
    try {
      const stillLocked = [];
      for (const page of gated) {
        const res = await asCustomer(page);
        if (res.status !== 200) stillLocked.push(`${res.status}  ${page}`);
      }
      assert.deepEqual(stillLocked, [], `these pages stay locked for a customer holding the entitlement they ask for:\n  ${stillLocked.join("\n  ")}`);
    } finally {
      entitled = false;
    }
  });

  it("does not leak a stack trace when something does go wrong", async () => {
    // If a page ever does throw, what reaches the customer matters. Express's
    // default error handler prints the stack in development.
    const res = await request(app)
      .get("/dashboard")
      .set("Accept", "text/html")
      .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub-access-token`);
    assert.doesNotMatch(res.text, /at \w+ \(\/home\//, "a filesystem path from a stack trace reached the page");
    assert.doesNotMatch(res.text, /node_modules/, "an internal module path reached the page");
  });
});

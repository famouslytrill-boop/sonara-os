"use strict";

// A page nothing links to is a page nobody finds.
//
// tests/page-reachability.test.js checks a hand-listed set of destinations, and
// that list is only as good as somebody remembering to add to it. This is the
// whole surface: every registered page route must be reachable by following
// links from a signed-in session, or be declared below with the reason it is
// not.
//
// It found 110 unreachable routes on its first honest run -- eleven owner
// record pages, seventy-three product pages, and the rest. All of them were
// registered, rendering, and reachable only by typing the URL, because the
// screens that should have linked them carried hand-written lists that had
// fallen behind the registry.
//
// Two earlier attempts were wrong and are worth knowing about before trusting
// this one. A source scan of link constructs reported 57, because /tutorials
// builds its links from a list and the literal path never appears in source. An
// unauthenticated crawl reported 162, because a session that does not render
// the signed-in pages cannot follow their links. Rendered HTML from a session
// that actually renders is the only honest answer.

const assert = require("node:assert/strict");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-for-reachability",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-for-reachability",
  ADMIN_EMAILS: "owner@example.com"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const request = require("supertest");
const app = require("../server");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");

const USER = { id: "77777777-7777-4777-8777-777777777777", email: "owner@example.com" };
const ORGANIZATION_ID = "88888888-8888-4888-8888-888888888888";

// Where a customer or owner starts. Everything else has to be reachable from
// one of these by following links.
const ROOTS = Object.freeze([
  "/", "/dashboard", "/account", "/pricing",
  "/business-builder", "/creator-studio", "/growth-studio",
  "/business-builder/owner", "/staff", "/admin"
]);

// Routes that are correctly unlinked, each with the reason. Being here is a
// decision, not an exemption -- and a route listed here that turns out to be
// reachable fails too, because a stale reason is how this list would rot the
// same way the ones it replaced did.
const NOT_LINKED = Object.freeze({
  "/sitemap.xml": "A machine endpoint. Search engines fetch it; a link to it on a page would be noise.",
  "/robots.txt": "Same as the sitemap: fetched by crawlers, not by people.",

  "/logout": "Reached by the sign-out control, which posts rather than linking, and only exists while signed in.",
  "/auth/callback": "The redirect target a provider sends the browser back to. Nothing links it because nothing should.",
  "/reset-password": "Arrives as a link in an email, with a token. A link from a page would land without one.",
  "/business-builder/invite/accept": "Arrives as a link in an invitation email, carrying the token that makes it work.",
  "/shared": "Reached by trimming a shared result's link, and linked from every /shared/:token page. Those carry a token, so they are not registered and this crawl cannot see the link from them.",

  // The canonical legal pages live under /legal/* and the footer links all of
  // them on every page. These are aliases kept for older links.
  "/legal": "The legal index. The footer links each policy directly, which is what people follow.",
  "/terms": "Alias of /legal/terms, which the footer links on every page.",
  "/cookies": "Alias of /legal/cookie-policy, which the footer links on every page.",
  "/acceptable-use": "Alias of /legal/acceptable-use, which the footer links on every page.",
  "/accessibility": "Alias of /legal/accessibility, which the footer links on every page.",
  "/earnings-disclaimer": "Alias of the earnings disclaimer the footer links. Kept so older links do not break."
});

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

function stubFetch() {
  return async (url) => {
    const target = String(url);
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return json({});
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") {
      return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    }
    if (table === "business_memberships") {
      return json([{ id: "membership", organization_id: ORGANIZATION_ID, workspace_id: "workspace", role: "owner", status: "active" }]);
    }
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Stub Co", slug: "stub" }]);
    // Empty rather than absent: a page with no records still renders its links.
    return json([]);
  };
}

async function crawl() {
  const visited = new Set();
  const reached = new Set(ROOTS);
  const queue = [...ROOTS];

  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);

    const response = await request(app)
      .get(path)
      .set("Accept", "text/html")
      .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
      .redirects(0);

    if (response.status !== 200) continue;

    for (const match of String(response.text || "").matchAll(/href="([^"#?]+)"/g)) {
      const href = match[1];
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      if (/\.(css|js|png|svg|ico|webmanifest)$/.test(href)) continue;
      reached.add(href);
      if (!visited.has(href)) queue.push(href);
    }
  }

  return { visited, reached };
}

describe("every registered page is reachable, or says why not", () => {
  let result;

  let realFetch;

  before(async function () {
    // A few hundred renders. Generous because a slow runner must not turn this
    // into a flake, bounded because a hang has to still fail.
    this.timeout(180000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
    result = await crawl();
  });

  after(() => {
    // Restoring fetch matters more than restoring the environment. Leaving the
    // stub in place made ten sign-in tests fail in files that run after this
    // one -- they got a stubbed Supabase that answered every auth call
    // successfully, so a refusal test saw a redirect instead. tests/setup-env.cjs
    // installs an offline firewall on this handle; putting it back restores it.
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("actually crawled, rather than passing on an empty result", () => {
    // The check that stops this reporting "nothing unreachable" because the
    // session broke and every page 302'd away.
    assert.ok(result.visited.size > 100, `only ${result.visited.size} pages were fetched; the session is not rendering`);
    assert.ok(result.reached.size > 150, `only ${result.reached.size} paths were reached; the crawl is not following links`);
  });

  it("reaches every registered page, or has a stated reason", () => {
    const pages = ROUTE_REGISTRY.filter(
      (entry) => entry.method === "GET" && !entry.route.startsWith("/api/") && !entry.route.includes(":")
    );
    assert.ok(pages.length > 200, `only ${pages.length} page routes found; this check has gone blind`);

    const unaccounted = pages
      .filter((entry) => !result.reached.has(entry.route) && !NOT_LINKED[entry.route])
      .map((entry) => `${entry.route}  [${entry.visibility}]`);

    assert.deepEqual(
      unaccounted,
      [],
      "These pages are registered and nothing links to them:\n  " +
        `${unaccounted.join("\n  ")}\n` +
        "Link them from a screen a person actually opens, or add them to NOT_LINKED with the reason."
    );
  });

  it("has no stale reasons for pages that are reachable after all", () => {
    // A reason left behind after somebody links the page is how this list would
    // rot the same way the hand-written link lists it replaced did.
    const stale = Object.keys(NOT_LINKED).filter((route) => result.reached.has(route));
    assert.deepEqual(stale, [], `these are declared unlinked and are reachable: ${stale.join(", ")}`);
  });

  it("gives every declaration a reason somebody can argue with", () => {
    for (const [route, reason] of Object.entries(NOT_LINKED)) {
      assert.ok(String(reason).length > 40, `${route} is declared without a real reason`);
    }
  });
});

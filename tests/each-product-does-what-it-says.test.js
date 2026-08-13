"use strict";

// Every catalog product, opened as a paying customer, against what it claims.
//
// tests/catalog-routes-go-somewhere-real.test.js asks whether a route resolves
// and whether the plan opens it. Both were true of "Selling Your Work" while it
// pointed at a page rendering two cards -- "What this tool does" and "Access" --
// with no records and no form. It had been repointed there on the strength of
// the page *definition* being titled "Offer Records". Reading a definition is
// not reading a page.
//
// Six rows were wrong when this was first written, and the shape of each is
// worth keeping:
//
//   Quotes, Invoices & Getting Paid  ->  /business-builder/billing, which is the
//     customer's own SONARA subscription. A row about invoicing their customers
//     sent them to a page about paying us.
//   File Storage                     ->  /dashboard, claiming file storage,
//     versions, approvals and provenance. Nothing in this product stores an
//     uploaded file.
//   Brand & Asset Library            ->  /creator-studio/dashboard, the generic
//     workspace index, when /creator-studio/assets is the asset catalogue.
//   Logins, Team & Permissions       ->  /account/setup, which renders no cards.
//   One Connected Account            ->  /products, the public marketing index.
//   Selling Your Work                ->  as above.
//
// A page need not have a form. Several products are reports and status views,
// and demanding a button of them would be demanding the wrong thing. What every
// product must do is render its own substance: cards of its own, not the
// workspace furniture, and not a placeholder saying what it would do.

const assert = require("node:assert/strict");
const request = require("supertest");

const SUPABASE_ENV = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-anon-key-for-audit",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stub-service-role-for-audit"
});
const original = Object.fromEntries(Object.keys(SUPABASE_ENV).map((key) => [key, process.env[key]]));

const app = require("../server");
const { CUSTOMER_SESSION_COOKIE } = require("../lib/sonara-customer-auth.cjs");
const { RECOMMENDED_PRODUCT_CATALOG } = require("../lib/sonara-recommended-product-catalog.cjs");

const USER = { id: "33333333-3333-4333-8333-333333333333", email: "audit@example.com" };
const ORGANIZATION_ID = "44444444-4444-4444-8444-444444444444";

function json(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => body };
}

// Entitled, because the question here is what a paying customer gets. The
// entitlement key asked for is echoed back, so the stub grants exactly what the
// page requires rather than guessing at the column.
function stubFetch() {
  return async (url, options = {}) => {
    const target = String(url);
    const method = (options.method || "GET").toUpperCase();
    if (target.includes("/auth/v1/user")) return json(USER);
    if (target.includes("/rest/v1/rpc/")) return json({});
    if (!target.includes("/rest/v1/")) return undefined;
    const table = (target.split("/rest/v1/")[1] || "").split("?")[0];
    if (table === "organization_memberships") return json([{ organization_id: ORGANIZATION_ID, user_id: USER.id, role: "owner", status: "active" }]);
    if (table === "business_memberships") return json([{ id: "m", organization_id: ORGANIZATION_ID, workspace_id: "w", role: "owner", status: "active" }]);
    if (table === "organizations") return json([{ id: ORGANIZATION_ID, name: "Audit Ltd" }]);
    if (table === "billing_entitlements") {
      const asked = decodeURIComponent((target.match(/entitlement_key=in\.\(([^)]*)\)/) || ["", ""])[1]).split(",").filter(Boolean);
      return json(asked[0] ? [{ entitlement_key: asked[0], status: "active" }] : []);
    }
    if (method === "POST" || method === "PATCH") return json([{ id: "created" }], 201);
    return json([]);
  };
}

// The application frame: present on every page, so it says nothing about this
// one. Without stripping it, every product looks like it has content.
const FURNITURE = /^(Skip animation|Command|Experience|Log ?out|Logout|×|Navigate|Free customer access)$/i;

// Cards a page renders when it has nothing of its own to show.
const PLACEHOLDER = /^(What this tool does|Access|Ready when you are|Next step|Your saved work)$/i;

function textOf(html, pattern) {
  return [...html.matchAll(pattern)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe("each product does what it says", () => {
  let realFetch;
  const rendered = new Map();

  before(async function render() {
    this.timeout(120000);
    Object.assign(process.env, SUPABASE_ENV);
    realFetch = global.fetch;
    global.fetch = stubFetch();
    for (const item of RECOMMENDED_PRODUCT_CATALOG) {
      const response = await request(app)
        .get(item.route)
        .set("Accept", "text/html")
        .set("Cookie", `${CUSTOMER_SESSION_COOKIE}=stub`)
        .redirects(0);
      const html = String(response.text || "");
      rendered.set(item.serviceKey, {
        status: response.status,
        location: response.headers.location || null,
        cards: textOf(html, /<h2[^>]*>([\s\S]*?)<\/h2>/g).filter((card) => !FURNITURE.test(card))
      });
    }
  });

  after(() => {
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("rendered every product, rather than measuring an empty map", () => {
    assert.equal(rendered.size, RECOMMENDED_PRODUCT_CATALOG.length);
    assert.ok(rendered.size >= 20, `only ${rendered.size} products rendered`);
  });

  it("opens for a paying customer rather than redirecting or failing", () => {
    const refused = RECOMMENDED_PRODUCT_CATALOG
      .map((item) => ({ item, page: rendered.get(item.serviceKey) }))
      .filter(({ page }) => page.status !== 200)
      .map(({ item, page }) => `${item.name} -> ${item.route} (HTTP ${page.status}${page.location ? ` to ${page.location}` : ""})`);
    assert.deepEqual(refused, [], "these products do not open for a customer whose plan includes them");
  });

  it("shows something of its own, not just the workspace furniture", () => {
    const bare = RECOMMENDED_PRODUCT_CATALOG
      .map((item) => ({ item, page: rendered.get(item.serviceKey) }))
      .filter(({ page }) => page.cards.length === 0)
      .map(({ item }) => `${item.name} -> ${item.route}`);
    assert.deepEqual(
      bare,
      [],
      "these products render no card of their own, so the page is the application frame and nothing else"
    );
  });

  it("is not sold on a page that only says what it would do", () => {
    const placeholders = RECOMMENDED_PRODUCT_CATALOG
      .map((item) => ({ item, page: rendered.get(item.serviceKey) }))
      .filter(({ page }) => page.cards.length > 0 && page.cards.every((card) => PLACEHOLDER.test(card)))
      .map(({ item, page }) => `${item.name} -> ${item.route} renders only: ${page.cards.join(", ")}`);
    assert.deepEqual(
      placeholders,
      [],
      "these products point at a page that describes itself and does nothing"
    );
  });

  // The guard on the two above. Both pass trivially if the card scrape stops
  // matching, and a silent scrape is exactly how the first version of this
  // audit reported every page as healthy.
  it("is actually reading cards out of the pages", () => {
    const withCards = [...rendered.values()].filter((page) => page.cards.length > 0).length;
    assert.ok(
      withCards >= RECOMMENDED_PRODUCT_CATALOG.length - 1,
      `only ${withCards} of ${rendered.size} pages yielded any card; the scrape has stopped matching`
    );
    const total = [...rendered.values()].reduce((sum, page) => sum + page.cards.length, 0);
    assert.ok(total >= 60, `only ${total} cards scraped across every product; the scrape has gone blind`);
  });
});

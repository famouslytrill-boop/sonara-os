// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { test, expect } = require("@playwright/test");
const { createPageFrame } = require("../lib/sonara-page-frame.cjs");
const shell = require("../lib/sonara-shell.cjs");
const { registerMarketplaceReconciliationRoutes, RECONCILIATION_PAGE } = require("../routes/sonara-marketplace-reconciliation-routes.cjs");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const ORG = "aaaaaaaa-0000-4000-8000-00000000000a";
const BUYER = "cccccccc-0000-4000-8000-00000000000c";
const ORDER = "33333333-3333-4333-8333-333333333333";
const VERSION = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "acct_seller12345678";
const SESSION = "cs_test_browser123";
const INTENT = "pi_browser123";

// Render the route with fixture payment evidence and the real document/card
// shell. Browser assets come from the isolated runtime. No signed-in account,
// live provider, purchase, refund or payout is used by this proof.
async function renderReport(query, { missingGrant = false, providerFailure = false } = {}) {
  const frame = createPageFrame({ legalPages: () => [], safeListTable: async () => ({ ok: true, rows: [] }) });
  let handler;
  const reads = [];
  registerMarketplaceReconciliationRoutes({ get: (_path, _guard, render) => { handler = render; } }, {
    ...shell, layout: (input) => frame.layout({ ...input, authenticated: true }),
    requireWorkspaceAccess: () => (_req, _res, next) => next(),
    getCustomerPrimaryOrganization: async () => ({ ok: true, organizationId: ORG }),
    getSupabaseServerConfig: () => ({ ok: true, url: "https://fixture.example.invalid" }),
    supabaseHeaders: () => ({}),
    getEnv: (name) => ({ STRIPE_CONNECT_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_test_browser_fixture_not_a_secret",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_browserfixture1234567890" })[name] || ""
  });
  const originalFetch = global.fetch;
  global.fetch = async (raw, init) => {
    const url = new URL(raw);
    reads.push({ method: init?.method || "GET", host: url.host });
    if (url.host === "api.stripe.com") {
      if (providerFailure) return new Response("{}", { status: 503 });
      return new Response(JSON.stringify({ data: [{
        id: SESSION, status: "complete", payment_status: "paid", amount_total: 2500, currency: "usd",
        client_reference_id: ORDER, metadata: { sonara_kind: "creator_marketplace", sonara_order_id: ORDER },
        payment_intent: { id: INTENT, client_secret: "never-publish-this-fixture-secret",
          latest_charge: { amount: 2500, currency: "usd", amount_refunded: 0, refunded: false, disputed: false,
            balance_transaction: { currency: "usd", fee: 100, net: 2400 } } }
      }], has_more: false }));
    }
    if (url.host !== "fixture.example.invalid") throw new Error("Unexpected external read");
    const rows = {
      "/rest/v1/business_payment_accounts": [{ organization_id: ORG, stripe_account_id: ACCOUNT }],
      "/rest/v1/creator_marketplace_orders": [{ id: ORDER, organization_id: ORG, title: "My licensed track",
        buyer_user_id: BUYER, version_id: VERSION, licence: "commercial_single",
        price_cents: 2500, currency: "usd", stripe_account_id: ACCOUNT,
        checkout_session_id: SESSION, payment_intent_id: INTENT, state: "paid" }],
      "/rest/v1/creator_licence_grants": missingGrant ? [] : [{ order_id: ORDER, organization_id: ORG,
        buyer_user_id: BUYER, version_id: VERSION, licence: "commercial_single", revoked_at: null, revoked_reason: null }]
    }[url.pathname];
    if (!rows) throw new Error("Unexpected database table");
    return new Response(JSON.stringify(rows));
  };
  const response = { statusCode: 0, status(value) { this.statusCode = value; return this; },
    type() { return this; }, set() { return this; }, send(body) { this.body = body; return this; } };
  try {
    await handler({ query, sonaraUser: { id: BUYER } }, response);
  } finally {
    global.fetch = originalFetch;
  }
  expect(reads.every((read) => read.method === "GET")).toBe(true);
  return response;
}

async function mountReport(page, options) {
  await page.route("**" + RECONCILIATION_PAGE + "*", async (route) => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams.entries());
    const response = await renderReport(query, options);
    await route.fulfill({ status: response.statusCode, contentType: "text/html", body: response.body });
  });
  return page.goto(BASE_URL + RECONCILIATION_PAGE);
}

test.describe("seller reconciliation browser proof with fixture transactions", () => {
  for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    test("renders the report and refreshes its period on " + viewport.name, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mountReport(page);
      await expect(page.getByRole("heading", { name: "Check sales and licences", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Records checked", exact: true })).toBeVisible();
      await expect(page.getByText("My licensed track", { exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("<p>");
      await expect(page.locator("body")).not.toContainText("<ul>");
      await expect(page.getByRole("button", { name: "Check again", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const button = await page.getByRole("button", { name: "Check again", exact: true }).boundingBox();
      expect(button.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: "artifacts/browser/marketplace-reconciliation-" + viewport.name + ".png", fullPage: true });
      await page.getByLabel("Orders created in the last").selectOption("7");
      await page.getByRole("button", { name: "Check again", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("days=7"));
      await expect(page.getByLabel("Orders created in the last")).toHaveValue("7");
      await expect(page.locator("body")).toContainText("Orders created in the last 7 days");
      await expect(page.locator("body")).not.toContainText("never-publish-this-fixture-secret");
      expect(errors).toEqual([]);
    });
  }
  test("makes a paid order with no licence visibly incomplete", async ({ page }) => {
    await mountReport(page, { missingGrant: true });
    await expect(page.getByRole("listitem").filter({ hasText: "The paid order has no recorded licence grant." })).toBeVisible();
    await expect(page.locator("body")).toContainText("1 records need attention");
    await expect(page.locator("body")).not.toContainText("The payment record and licence state agree");
  });
  test("shows provider failure without claiming an empty or verified report", async ({ page }) => {
    const response = await mountReport(page, { providerFailure: true });
    await expect(page.getByRole("heading", { name: "Check sales and licences", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("No reconciliation result is claimed");
    await expect(page.locator("body")).not.toContainText("No records in this period");
    await expect(page.locator("body")).not.toContainText("Records checked");
    expect(response.status()).toBe(503);
  });
});

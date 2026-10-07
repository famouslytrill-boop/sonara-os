// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { test, expect } = require("@playwright/test");
const { createPageFrame } = require("../lib/sonara-page-frame.cjs");
const shell = require("../lib/sonara-shell.cjs");
const register = require("../routes/sonara-operations-expansion-routes.cjs");
const { createFakeSupabase } = require("../tests/helpers/fake-supabase.cjs");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const ORG = "11111111-1111-4111-8111-111111111111";
const WORKSPACE = "33333333-3333-4333-8333-333333333333";
const RESOURCE_PAGE = "/business-builder/owner/reservation-resources";
const WAITLIST_PAGE = "/business-builder/owner/waitlist";

// Exercise the actual controller, persistence queries, form POSTs and page
// renderer with an offline database fixture. Frame/CSS/scripts come from the
// real isolated runtime. The manager gate itself has separate real-server tests.
async function mountWorkflow(page, { unavailable = false, unconfirmedSave = false } = {}) {
  const db = createFakeSupabase({ ids: "uuid", tables: { business_assets: [], business_bookings: [], business_locations: [] } });
  const fetch = db.install(async () => { throw new Error("external fixture request refused"); });
  const frame = createPageFrame({ legalPages: () => [], safeListTable: async () => ({ ok: true, rows: [] }) });
  const routes = new Map();
  const app = {};
  for (const method of ["get", "post"]) app[method] = (path, ...handlers) => routes.set(method + " " + path, handlers);
  register(app, {
    ...shell, layout: (input) => frame.layout({ ...input, authenticated: true }),
    requireBusinessManager: (req, _res, next) => {
      req.sonaraUser = { id: "77777777-7777-4777-8777-777777777777" };
      req.sonaraBusinessMembership = { organization_id: ORG, workspace_id: WORKSPACE, role: "manager", status: "active" };
      return next();
    },
    getCustomerPrimaryOrganization: async (_user, options) => {
      expect(options.autoBootstrap).toBe(false);
      return { ok: true, organizationId: ORG };
    },
    getSupabaseServerConfig: () => ({ ok: true, url: db.url }),
    supabaseHeaders: () => ({})
  });
  const matcher = /\/(?:business-builder\/owner\/(?:reservation-resources|waitlist)|api\/business\/(?:reservation-resources|waitlist(?:\/[0-9a-f-]+\/offer)?))(?:\?.*)?$/;
  await page.route(matcher, async (route) => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    let path = url.pathname;
    const params = {};
    const offer = path.match(/^\/api\/business\/waitlist\/([0-9a-f-]+)\/offer$/);
    if (offer) { params.bookingId = offer[1]; path = "/api/business/waitlist/:bookingId/offer"; }
    const posted = new URLSearchParams(incoming.postData() || "");
    const body = Object.fromEntries(posted.entries());
    if (posted.getAll("resource_ids").length > 1) body.resource_ids = posted.getAll("resource_ids");
    const req = { body, params, query: Object.fromEntries(url.searchParams.entries()), get: () => "text/html" };
    const res = { statusCode: 200, headers: {},
      status(value) { this.statusCode = value; return this; },
      set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      type() { return this; }, send(value) { this.body = value; return this; },
      json(value) { this.body = JSON.stringify(value); return this; },
      redirect(status, location) { this.statusCode = status; this.headers.location = location; this.body = ""; return this; }
    };
    const savedFetch = global.fetch;
    global.fetch = (raw, init = {}) => {
      if (unavailable && init.method === "GET") return Promise.resolve(new Response("{}", { status: 503 }));
      if (unconfirmedSave && init.method === "POST") return Promise.resolve(new Response("[]", { status: 201 }));
      return fetch(raw, init);
    };
    try {
      const handlers = routes.get(incoming.method().toLowerCase() + " " + path);
      expect(handlers).toHaveLength(2);
      await handlers[0](req, res, () => handlers[1](req, res));
    } finally { global.fetch = savedFetch; }
    await route.fulfill({ status: res.statusCode, contentType: "text/html", headers: res.headers, body: res.body });
  });
  return db;
}

async function readableScreenshot(page, name) {
  const cards = page.locator("main .grid .card");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS("opacity", "1");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "artifacts/browser/" + name + ".png", fullPage: true });
}

test.describe("reservation and waitlist browser workflows", () => {
  for (const size of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    test("saves a resource, waitlist entry and offer on " + size.name, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const db = await mountWorkflow(page);
      await page.goto(BASE_URL + RESOURCE_PAGE + "?workspaceId=" + WORKSPACE);
      await page.getByLabel("Resource name", { exact: true }).fill("Quiet room");
      await page.getByLabel("Kind", { exact: true }).selectOption("room");
      await page.getByLabel("Capacity", { exact: true }).fill("6");
      const button = await page.getByRole("button", { name: "Add resource", exact: true }).boundingBox();
      expect(button.height).toBeGreaterThanOrEqual(44);
      await page.getByRole("button", { name: "Add resource", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("saved=resource"));
      await expect(page.getByRole("heading", { name: "Quiet room", exact: true })).toBeVisible();
      expect(db.rows("business_assets")[0].organization_id).toBe(ORG);
      await readableScreenshot(page, "reservation-resources-" + size.name);
      await page.getByRole("link", { name: "Waitlist", exact: true }).click();
      await page.getByLabel("Customer name", { exact: true }).fill("Mina");
      await page.getByLabel("Email", { exact: true }).fill("mina@example.com");
      await page.getByLabel("Party size", { exact: true }).fill("3");
      await page.getByLabel("Preferred start (UTC)", { exact: true }).fill("2026-10-08T14:00");
      await page.getByLabel("Preferred end (UTC)", { exact: true }).fill("2026-10-08T15:00");
      await page.getByLabel("Preferred resources", { exact: true }).selectOption({ label: "Quiet room" });
      await page.getByRole("button", { name: "Add to waitlist", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("saved=waitlist"));
      await expect(page.getByRole("heading", { name: "Mina", exact: true })).toBeVisible();
      const entry = db.rows("business_bookings")[0];
      expect(entry.metadata.preferred_start).toBe("2026-10-08T14:00:00.000Z");
      await page.getByRole("button", { name: "Record offer", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("saved=offer"));
      await expect(page.getByText("Offer recorded", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Record offer", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Open booking", exact: true }))
        .toHaveAttribute("href", "/business-builder/owner/bookings/" + entry.id + "?workspaceId=" + WORKSPACE);
      expect(db.rows("business_bookings")[0].status).toBe("requested");
      expect(db.rows("business_bookings")[0].metadata.waitlist_state).toBe("offered");
      await readableScreenshot(page, "waitlist-offer-" + size.name);
      expect(errors).toEqual([]);
    });
  }

  test("shows unavailable records without claiming an empty list", async ({ page }) => {
    await mountWorkflow(page, { unavailable: true });
    const response = await page.goto(BASE_URL + WAITLIST_PAGE);
    expect(response.status()).toBe(503);
    await expect(page.getByRole("heading", { name: "We could not read your waitlist", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nobody is waiting", exact: true })).toHaveCount(0);
  });

  test("preserves the native draft after an unconfirmed save", async ({ page }) => {
    await mountWorkflow(page, { unconfirmedSave: true });
    await page.goto(BASE_URL + RESOURCE_PAGE);
    await page.getByLabel("Resource name", { exact: true }).fill("Draft room");
    await page.getByLabel("Capacity", { exact: true }).fill("4");
    await page.getByLabel("Notes", { exact: true }).fill("Keep these notes");
    await page.getByRole("button", { name: "Add resource", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Check the list before trying to add it again");
    await expect(page.getByLabel("Resource name", { exact: true })).toHaveValue("Draft room");
    await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("Keep these notes");
    await expect(page).toHaveURL(new RegExp("/api/business/reservation-resources"));
  });
});


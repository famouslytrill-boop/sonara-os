// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { test, expect } = require("@playwright/test");
const express = require("express");
const { createPageFrame } = require("../lib/sonara-page-frame.cjs");
const shell = require("../lib/sonara-shell.cjs");
const register = require("../routes/sonara-operations-expansion-routes.cjs");
const { createFakeSupabase } = require("../tests/helpers/fake-supabase.cjs");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const ORG = "11111111-1111-4111-8111-111111111111";
const WORKSPACE = "33333333-3333-4333-8333-333333333333";
const RESOURCE_PAGE = "/business-builder/owner/reservation-resources";
const WAITLIST_PAGE = "/business-builder/owner/waitlist";

// Run native browser forms and redirects against the actual controller and
// renderer on an isolated HTTP fixture. Its database and manager identity are
// offline fixtures; authentication is proved separately through server.js.
// Static assets are the real runtime's built CSS/scripts, served unchanged.
let fixture;
test.afterEach(async () => {
  if (!fixture) return;
  global.fetch = fixture.originalFetch;
  await new Promise((resolve) => fixture.server.close(resolve));
  fixture = null;
});

async function mountWorkflow({ unavailable = false, unconfirmedSave = false } = {}) {
  const db = createFakeSupabase({ ids: "uuid", tables: { business_assets: [], business_bookings: [], business_locations: [] } });
  const fetch = db.install(async () => { throw new Error("external fixture request refused"); });
  const originalFetch = global.fetch;
  global.fetch = (raw, init = {}) => {
    if (unavailable && init.method === "GET") return Promise.resolve(new Response("{}", { status: 503 }));
    if (unconfirmedSave && init.method === "POST") return Promise.resolve(new Response("[]", { status: 201 }));
    return fetch(raw, init);
  };
  const frame = createPageFrame({ legalPages: () => [], safeListTable: async () => ({ ok: true, rows: [] }) });
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
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
  app.use(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) return res.status(404).send("Fixture route unavailable");
    const response = await originalFetch(BASE_URL + req.originalUrl);
    res.status(response.status).type(response.headers.get("content-type") || "application/octet-stream");
    return res.send(Buffer.from(await response.arrayBuffer()));
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  fixture = { server, originalFetch };
  db.baseURL = "http://127.0.0.1:" + server.address().port;
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
      const db = await mountWorkflow();
      await page.goto(db.baseURL + RESOURCE_PAGE + "?workspaceId=" + WORKSPACE);
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
    const db = await mountWorkflow({ unavailable: true });
    const response = await page.goto(db.baseURL + WAITLIST_PAGE);
    expect(response.status()).toBe(503);
    await expect(page.getByRole("heading", { name: "We could not read your waitlist", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nobody is waiting", exact: true })).toHaveCount(0);
  });

  test("preserves the native draft after an unconfirmed save", async ({ page }) => {
    const db = await mountWorkflow({ unconfirmedSave: true });
    await page.goto(db.baseURL + RESOURCE_PAGE);
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


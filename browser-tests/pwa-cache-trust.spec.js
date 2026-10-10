// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PRIVATE_ASSET_SHAPES = [
  "/api/tenant/report.png",
  "/business-builder/owner/receipt.svg",
  "/creator-studio/projects/private.js",
  "/growth-studio/campaigns/private.css",
  "/api/assets/invoice.png"
];

// Real browser CacheStorage and service-worker lifecycle, not a source regex.
// No customer account, provider credentials or production environment needed.
async function activateWorker(page) {
  await page.goto(BASE_URL + "/pricing");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers unavailable in this browser");
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { timeout: 15000, message: "public page must be controlled by the installed service worker" }
  ).toBe(true);
}

async function cachedUrls(page) {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith("sonara-public-"));
    const all = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) all.push(new URL(request.url).pathname + new URL(request.url).search);
    }
    return { names, urls: all };
  });
}

test.describe("SONARA shared service worker: browser privacy and offline proof", () => {
  test("cache contains public assets but no Business, Creator, Growth or tenant API content", async ({ page }) => {
    await activateWorker(page);
    await page.evaluate(async (paths) => {
      await fetch("/sonara-one.js?v=sonara-browser-cache-proof", { credentials: "omit" });
      await Promise.all(paths.map((path) => fetch(path, { credentials: "same-origin" }).catch(() => null)));
    }, PRIVATE_ASSET_SHAPES);

    await expect.poll(async () => {
      const snapshot = await cachedUrls(page);
      return snapshot.urls.some((url) => url.startsWith("/sonara-one.js?v=sonara-browser-cache-proof"));
    }, { timeout: 10000 }).toBe(true);

    const snapshot = await cachedUrls(page);
    expect(snapshot.names).toHaveLength(1);
    for (const path of PRIVATE_ASSET_SHAPES) {
      expect(snapshot.urls.some((url) => url.startsWith(path)), path + " must never enter CacheStorage").toBe(false);
    }
    expect(snapshot.urls.some((url) => url === "/offline")).toBe(true);
    expect(snapshot.urls.some((url) => url.startsWith("/site.webmanifest"))).toBe(true);
    expect(snapshot.urls.some((url) => url.startsWith("/sonara-application-ui.css"))).toBe(true);
  });

  test("offline public navigation uses the generic fallback; restored network returns to real pages", async ({ page, context }) => {
    const offline = await page.request.get(BASE_URL + "/offline");
    expect(offline.status()).toBe(200);
    expect(offline.headers()["cache-control"]).toMatch(/(?:^|,)\s*public\s*(?:,|$)/i);
    const pricing = await page.request.get(BASE_URL + "/pricing");
    expect(pricing.status()).toBe(200);
    expect(pricing.headers()["cache-control"]).toMatch(/no-store/i);
    await activateWorker(page);
    await context.setOffline(true);
    try {
      const response = await page.goto(BASE_URL + "/growth-studio", { waitUntil: "domcontentloaded" });
      expect(response, "offline navigation should resolve to the public fallback").not.toBeNull();
      expect(response.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: "You are offline." })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    const online = await page.goto(BASE_URL + "/growth-studio", { waitUntil: "domcontentloaded" });
    expect(online.status()).toBe(200);
    await expect(page.locator("body")).toContainText("Growth Studio");
    await expect(page.getByRole("heading", { name: "You are offline." })).toHaveCount(0);
  });
});

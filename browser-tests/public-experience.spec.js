"use strict";

const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PUBLIC_ROUTES = ["/", "/pricing", "/products"];

test.describe("public experience browser contract", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads without a server error`, async ({ page }) => {
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      expect(response, `${route} did not return a response`).not.toBeNull();
      expect(response.status(), `${route} returned ${response.status()}`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
      const title = await page.title();
      expect(title.trim().length).toBeGreaterThan(0);
    });
  }

  test("mobile home does not overflow the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  });

  test("first steady-state Tab lands on the skip link", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE_URL, { waitUntil: "load" });
    await expect(page.locator("#sonara-loader")).toBeHidden({ timeout: 3000 });

    const skip = page.locator(".sonara-skip");
    await expect(skip).toHaveAttribute("href", "#sonara-main");
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
  });

  test("reduced-motion preference reaches the rendered page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const reduced = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(reduced).toBe(true);
  });
});

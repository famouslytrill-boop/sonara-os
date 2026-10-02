"use strict";

const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const PUBLIC_ROUTES = ["/", "/pricing", "/products"];

test.describe("public experience browser contract", () => {
  test("project audio renders a real WAV locally and clears stale outputs", async ({ page }) => {
    const errors = [], uploads = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (req) => { if (req.method() === "POST") uploads.push(req.url()); });
    const { audioRenderForm } = require("../routes/sonara-creator-project-routes.cjs");
    const source = "00000000-0000-4000-8000-000000000001";
    const project = { id: "00000000-0000-4000-8000-000000000002", graph: { version: 1, nodes: [
      { id: source, kind: "source", assetId: source, durationMs: 10 },
      { id: "00000000-0000-4000-8000-000000000003", kind: "clip", sourceId: source, inMs: 0, outMs: 5, startMs: 5, muted: false }
    ] } };
    const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    await page.goto(`${BASE_URL}/tools`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(audioRenderForm(project, esc).replace(/<script[\s\S]*?<\/script>/, ""));
    await page.addScriptTag({ url: `${BASE_URL}/creator-project-audio.js` });
    const wav = Buffer.alloc(204);
    wav.write("RIFF", 0); wav.writeUInt32LE(196, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write("data", 36); wav.writeUInt32LE(160, 40);
    for (let at = 44; at < wav.length; at += 2) wav.writeInt16LE(12000, at);
    await page.locator("input[type=file]").setInputFiles({ name: "owned-recording.wav", mimeType: "audio/wav", buffer: wav });
    await page.getByRole("button", { name: "Render WAV", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Rendered 0.01 seconds on CPU");
    expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Download WAV", { exact: true }).click()]);
    expect(download.suggestedFilename()).toBe(`project-${project.id}.wav`);
    const bytes = require("node:fs").readFileSync(await download.path());
    expect({ length: bytes.length, silent: bytes.readInt16LE(44), sound: bytes.readInt16LE(44 + 221 * 4) }).toEqual({ length: 1808, silent: 0, sound: 12000 });
    await page.locator("[data-project-audio]").screenshot({ path: "artifacts/browser/creator-project-audio-mobile.png" });
    await page.locator("input[type=file]").setInputFiles([]);
    await expect(page.getByText("Download WAV", { exact: true })).toBeHidden();
    await expect(page.locator("audio")).toBeHidden();
    expect(errors).toEqual([]); expect(uploads).toEqual([]);
  });

  test("Creator local image processing exports exact CPU pixels without uploads", async ({ page }) => {
    const errors = [], uploads = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (req) => { if (req.method() === "POST") uploads.push(req.url()); });
    // An isolated component fixture: the paid route is covered by HTTP tests.
    // Use its actual markup and shipped script, not a parallel implementation.
    const { LOCAL_IMAGE_FORM } = require("../routes/creator-generation-routes.cjs");
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
    await page.goto(`${BASE_URL}/tools`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(LOCAL_IMAGE_FORM.replace(/<script[\s\S]*?<\/script>/, ""));
    await page.addScriptTag({ url: `${BASE_URL}/creator-local-image.js` });
    const pixels = await page.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 1;
      canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray([100, 50, 20, 255, 0, 255, 10, 255]), 2, 1), 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page.locator("[data-local-image] input[type=file]").setInputFiles({ name: "original.png", mimeType: "image/png", buffer: Buffer.from(pixels) });
    await expect(page.getByRole("button", { name: "Process image", exact: true })).toBeEnabled();
    await page.getByLabel("Brightness (%)").fill("150");
    await page.getByRole("button", { name: "Process image", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Processed with CPU");
    expect(await page.locator("canvas").evaluate((canvas) => Array.from(canvas.getContext("2d").getImageData(0, 0, 2, 1).data))).toEqual([150, 75, 30, 255, 0, 255, 15, 255]);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Download PNG", { exact: true }).click()]);
    expect(download.suggestedFilename()).toBe("creator-local-image.png");
    await page.locator("[data-local-image]").screenshot({ path: "artifacts/browser/creator-local-image-mobile.png" });
    // A repeat edit starts with original pixels rather than compounding changes.
    await page.getByLabel("Brightness (%)").fill("100");
    await page.getByRole("button", { name: "Process image", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Processed with CPU");
    expect(await page.locator("canvas").evaluate((canvas) => Array.from(canvas.getContext("2d").getImageData(0, 0, 2, 1).data))).toEqual([100, 50, 20, 255, 0, 255, 10, 255]);
    await page.locator("input[type=file]").setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("status")).toContainText("Choose a PNG, JPEG or WebP");
    await expect(page.getByText("Download PNG", { exact: true })).toBeHidden();
    expect(errors).toEqual([]); expect(uploads).toEqual([]);
  });

  test("parent tools compute locally and expose results without signup", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const uploads = [];
    page.on("request", (req) => { if (req.method() === "POST") uploads.push(req.url()); });
    await page.goto(`${BASE_URL}/tools/text-fingerprint`);
    await page.getByLabel("Your text", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "Calculate result" }).click();
    await expect(page.locator("[data-tool-result]")).toContainText("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    await expect(page.locator("[data-tool-download]")).toBeVisible();
    await page.getByLabel("Your text", { exact: true }).fill("changed");
    await expect(page.locator("[data-tool-download]")).toBeHidden();
    await page.goto(`${BASE_URL}/tools/data-formatter`);
    await page.getByLabel("Your JSON", { exact: true }).fill('{"owned":true}');
    await page.getByRole("button", { name: "Calculate result" }).click();
    await expect(page.locator("[data-tool-result]")).toContainText("owned");
    await page.getByLabel("Your JSON", { exact: true }).fill('{"unsafe":9007199254740993}');
    await page.getByRole("button", { name: "Calculate result" }).click();
    await expect(page.locator("[data-tool-status]")).toContainText("too large");
    await expect(page.locator("[data-tool-download]")).toBeHidden();
    await page.goto(`${BASE_URL}/tools/storage-budget`);
    await page.getByLabel("Number of files").fill("10");
    await page.getByLabel("Average file size").fill("1");
    await page.getByLabel("Total copies").fill("2");
    await page.getByRole("button", { name: "Calculate result" }).click();
    await expect(page.locator("[data-tool-result]")).toContainText("20971520");
    expect(errors).toEqual([]);
    expect(uploads).toEqual([]);
  });

  test("public tool forms fit on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/tools/data-formatter`);
    await expect(page.locator("[data-parent-tool]")).toBeVisible();
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  });

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

  // The primary navigation has to be on the screen of an ordinary laptop.
  //
  // It was not. Three separate rules dropped .sonara-desktop-nav -- at 1300px,
  // 1120px and 920px -- so the widest silently governed and the other two were
  // dead, and every laptop from 920px to 1300px got a hamburger instead of the
  // navigation. All three carried the same stated reason, "eight nav items",
  // and the header renders five links signed out and three signed in. The
  // reason had expired; the rule it justified had not.
  //
  // Measured in Chromium on 28 September 2026: the five-link header renders
  // clean at 840px and first clips a link at 830px. So 1280px is not a width
  // the nav has to be hidden at, it is a width it fits at with room to spare.
  //
  // This asserts the fit rather than the breakpoint. A future rule that moves
  // the width is free to; one that hides the navigation on a laptop, or lets it
  // clip, is what fails here.
  test("the primary navigation is on the screen, and whole, on a laptop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE_URL, { waitUntil: "load" });
    // Sized in the real face, not a fallback: link widths are what is measured.
    await page.evaluate(() => document.fonts.ready);

    const header = await page.evaluate(() => {
      const root = document.querySelector(".sonara-site-header");
      const nav = root.querySelector(".sonara-desktop-nav");
      const menu = root.querySelector(".sonara-mobile-menu");
      const links = [...nav.querySelectorAll("a")];
      const shown = (el) => Boolean(el) && getComputedStyle(el).display !== "none";
      const top = (el) => Math.round(el.getBoundingClientRect().top);
      return {
        navShown: shown(nav),
        menuShown: shown(menu),
        linkCount: links.length,
        clipped: links.filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
        rows: new Set(links.map(top)).size,
        navContent: nav.scrollWidth,
        navWidth: Math.round(nav.getBoundingClientRect().width),
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth
      };
    });

    // Every assertion below is satisfied by a nav with no links in it.
    expect(header.linkCount, "the desktop nav rendered no links; this check has gone blind").toBeGreaterThanOrEqual(3);
    expect(header.navShown, "the desktop nav is hidden at 1280px, which is an ordinary laptop").toBe(true);
    expect(header.menuShown, "the mobile menu is showing at 1280px alongside the desktop nav").toBe(false);
    expect(header.clipped, "these nav links are cut off at 1280px").toEqual([]);
    expect(header.rows, "the nav links wrapped onto more than one row at 1280px").toBe(1);
    expect(header.navContent, "the nav's content is wider than the nav at 1280px").toBeLessThanOrEqual(header.navWidth + 1);
    expect(header.docScroll, "the page scrolls sideways at 1280px").toBeLessThanOrEqual(header.docClient + 1);
  });

  // The other half of the same claim. Without this, the check above is
  // satisfied by a nav that is simply never hidden, which would overflow a
  // phone -- so the handover has to be asserted too, not assumed.
  test("the phone gets the menu instead, and still has navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const header = await page.evaluate(() => {
      const root = document.querySelector(".sonara-site-header");
      const nav = root.querySelector(".sonara-desktop-nav");
      const menu = root.querySelector(".sonara-mobile-menu");
      const shown = (el) => Boolean(el) && getComputedStyle(el).display !== "none";
      return {
        navShown: shown(nav),
        menuShown: shown(menu),
        menuLinkCount: menu ? menu.querySelectorAll("a").length : 0,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth
      };
    });

    expect(header.navShown, "the desktop nav is still showing on a phone").toBe(false);
    expect(header.menuShown, "the phone has no menu control").toBe(true);
    expect(header.menuLinkCount, "the phone menu carries no links, so the phone has no navigation at all").toBeGreaterThanOrEqual(3);
    expect(header.docScroll, "the page scrolls sideways on a phone").toBeLessThanOrEqual(header.docClient + 1);
  });

  test("reduced-motion preference reaches the rendered page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const reduced = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(reduced).toBe(true);
  });
});

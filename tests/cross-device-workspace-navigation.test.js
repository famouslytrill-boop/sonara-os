"use strict";

// The fast contract check for the authenticated, compact-touch navigation.
// Browser/device qualification remains a separate gate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createPageFrame } = require("../lib/sonara-page-frame.cjs");

const root = path.join(__dirname, "..");
const shellStyles = fs.readFileSync(path.join(root, "public/sonara-application-ui.css"), "utf8");
const sourceStyles = fs.readFileSync(path.join(root, "ui/sonara/styles/99-zzzzzz-frontend-operations-2026.css"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
const fontSource = fs.readFileSync(path.join(root, "public/sonara-fonts.css"), "utf8");
const clientSource = fs.readFileSync(path.join(root, "public/sonara-one.js"), "utf8");
const marker = "/* SONARA cross-device adaptive workspace navigation — 2026-10-08 */";
const frame = createPageFrame({
  legalPages: () => [],
  safeListTable: async () => ({ ok: true, rows: [] })
});
function render(options = {}) {
  return frame.layout({
    title: "Workspace",
    eyebrow: "SONARA One",
    heading: "Your work",
    body: "Choose the workspace.",
    sections: [],
    actions: [],
    ...options
  });
}

describe("cross-device workspace navigation", () => {
  it("keeps navigation absent for signed-out people", () => {
    const html = render();
    assert.doesNotMatch(html, /class="sonara-workspace-dock"/);
    assert.doesNotMatch(html, /sonara-has-workspace-dock/);
  });

  it("renders four operational destinations for an authenticated workspace", () => {
    const html = render({ authenticated: true });
    const dock = html.match(/<nav class="sonara-workspace-dock"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(dock, "authenticated work pages need a real shortcut nav");
    assert.match(html, /aria-label="Workspace shortcuts"/);
    const matches = [...dock[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.deepEqual(matches.map((m) => [m[1], m[2]]), [
      ["/dashboard", "Home"],
      ["/business-builder/dashboard", "Build"],
      ["/creator-studio/assets", "Create"],
      ["/growth-studio/campaigns", "Grow"]
    ]);
    assert.match(html, /sonara-has-workspace-dock/);
    assert.match(html, /<html lang="en" data-sonara-workspace-dock="true">/);
  });

  it("does not inject a work dock on marketing screens, even when signed in", () => {
    const html = render({ authenticated: true, surface: "marketing" });
    assert.doesNotMatch(html, /class="sonara-workspace-dock"/);
  });

  it("marks only a known canonical shortcut as current", () => {
    const html = render({ authenticated: true, canonical: "/creator-studio/assets" });
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /href="\/creator-studio\/assets" data-i18n="dockCreate" aria-current="page">Create<\/a>/);
    const unknown = render({ authenticated: true, canonical: "" });
    assert.doesNotMatch(unknown, /aria-current="page"/);
  });

  it("localizes all compact links without expanding their screen width", () => {
    const html = render({ authenticated: true });
    for (const key of ["dockHome", "dockBuild", "dockCreate", "dockGrow"]) {
      assert.match(html, new RegExp('data-i18n="' + key + '"'));
      const occurrences = clientSource.match(new RegExp(key + ': "', "g")) || [];
      assert.equal(occurrences.length, 5, key + " must have all five locale values");
    }
  });

  it("distinguishes nested studio location from the exact current page", () => {
    assert.match(clientSource, /const sections = \[/);
    assert.match(clientSource, /current\.startsWith\(prefix \+ "\/"\)/);
    assert.match(clientSource, /setAttribute\("aria-current", "location"\)/);
    assert.match(shellStyles, /a\[aria-current="location"\]/);
  });

  it("opts into cutout-aware web safe areas without blocking zoom", () => {
    const html = render();
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
    assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
    assert.match(shellStyles, /padding-inline-start:\s*env\(safe-area-inset-left\)/);
    assert.match(shellStyles, /padding-inline-end:\s*env\(safe-area-inset-right\)/);
    assert.match(shellStyles, /safe-area-inset-bottom/);
  });

  it("ships canonical CSS unchanged into the served stylesheet", () => {
    const sourceIndex = sourceStyles.indexOf(marker);
    const servedIndex = shellStyles.indexOf(marker);
    assert.ok(sourceIndex !== -1 && servedIndex !== -1, "the canonical enhancement must be served");
    assert.equal(shellStyles.slice(servedIndex), sourceStyles.slice(sourceIndex));
    assert.match(shellStyles.slice(servedIndex), /max-width:\s*599px/);
    assert.match(shellStyles.slice(servedIndex), /pointer:\s*coarse/);
    assert.match(shellStyles.slice(servedIndex), /min-height:\s*48px/);
    assert.match(shellStyles.slice(servedIndex), /:focus-visible/);
    assert.match(shellStyles.slice(servedIndex), /@media print/);
  });

  it("reserves scroll clearance for focus rather than relying on body padding alone", () => {
    assert.match(shellStyles, /html\[data-sonara-workspace-dock="true"\]/);
    assert.match(shellStyles, /scroll-padding-block-end:\s*calc\(96px/);
    assert.match(shellStyles, /@media \(max-height: 480px\)/);
    assert.match(shellStyles, /html\[data-sonara-workspace-dock="true"\] \{ scroll-padding-block-end: 0; \}/);
  });

  it("uses panel width, not device name, for narrow command controls", () => {
    assert.match(shellStyles, /@supports \(container-type: inline-size\)/);
    assert.match(shellStyles, /@container \(max-width: 420px\)/);
    assert.match(shellStyles, /\.sonara-ops-panel,[\s\S]*?container-type: inline-size/);
    assert.match(shellStyles, /\.sonara-ops-commandbar \[data-primary-action\][\s\S]*?margin-inline-start: 0;/);
  });

  it("releases the dock's reserved height while entering text", () => {
    const editing = /:has\(body :is\(input, textarea, select, \[contenteditable="true"\]\):focus\)/;
    assert.match(shellStyles, editing);
    assert.match(shellStyles, /html\[data-sonara-workspace-dock="true"\]:has\([\s\S]*?\)\s*\{\s*scroll-padding-block-end:\s*0;/);
    assert.match(shellStyles, /body\.sonara-has-workspace-dock:has\([\s\S]*?\)\s*\{\s*padding-block-end:\s*0;/);
  });

  it("versions the page shell, fonts, and service-worker cache together", () => {
    const html = render({ authenticated: true });
    const sources = [html, workerSource, fontSource];
    for (const source of sources) {
      assert.match(source, /sonara-ui-20261009-v26-public-cache-boundary/);
      assert.doesNotMatch(source, /sonara-ui-20261007-v23-native-navigation/);
    }
    assert.match(workerSource, /const VERSION = "sonara-ui-20261009-v26-public-cache-boundary";/);
    assert.match(html, /\/sonara-application-ui\.css\?v=sonara-ui-20261009-v26-public-cache-boundary/);
  });

  it("cannot trigger a device permission or network call through the dock", () => {
    const html = render({ authenticated: true });
    const dock = html.match(/<nav class="sonara-workspace-dock"[^>]*>[\s\S]*?<\/nav>/)[0];
    assert.doesNotMatch(dock, /<script|onclick=|getUserMedia|geolocation|DeviceOrientation|fetch\(/i);
  });
});

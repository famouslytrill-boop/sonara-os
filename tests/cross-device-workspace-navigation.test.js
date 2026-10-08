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
      ["/dashboard", "Workspaces"],
      ["/business-builder/dashboard", "Build"],
      ["/creator-studio/assets", "Create"],
      ["/growth-studio/campaigns", "Grow"]
    ]);
    assert.match(html, /sonara-has-workspace-dock/);
  });

  it("does not inject a work dock on marketing screens, even when signed in", () => {
    const html = render({ authenticated: true, surface: "marketing" });
    assert.doesNotMatch(html, /class="sonara-workspace-dock"/);
  });

  it("marks only a known canonical shortcut as current", () => {
    const html = render({ authenticated: true, canonical: "/creator-studio/assets" });
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /href="\/creator-studio\/assets" aria-current="page">Create<\/a>/);
    const unknown = render({ authenticated: true, canonical: "" });
    assert.doesNotMatch(unknown, /aria-current="page"/);
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

  it("cannot trigger a device permission or network call through the dock", () => {
    const html = render({ authenticated: true });
    const dock = html.match(/<nav class="sonara-workspace-dock"[^>]*>[\s\S]*?<\/nav>/)[0];
    assert.doesNotMatch(dock, /<script|onclick=|getUserMedia|geolocation|DeviceOrientation|fetch\(/i);
  });
});

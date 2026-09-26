"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createPageFrame } = require("../lib/sonara-page-frame.cjs");
const { UI_LOCALES, SUPPORTED_LOCALE_CODES, normalizeLocale } = require("../lib/sonara-locale-contract.cjs");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const { getWorkspaceDirectoryGroups, renderWorkspaceDirectory } = require("../lib/sonara-workspace-directory.cjs");
const {
  WORKSPACES,
  renderWorkspaceChoices,
  renderWorkspaceNotice
} = require("../lib/sonara-workspace-hub.cjs");

const root = path.join(__dirname, "..");
const frame = createPageFrame({ legalPages: () => [], safeListTable: async () => ({ ok: false, rows: [] }) });

describe("workspace hub and responsive account navigation", () => {
  it("has one working route for each of the three workspaces", () => {
    const hrefs = WORKSPACES.map(({ href }) => href);
    assert.equal(new Set(hrefs).size, 3, "workspace routes must be unique");
    for (const href of hrefs) {
      assert.ok(ROUTE_REGISTRY.some((entry) => entry.method === "GET" && entry.route === href), `${href} must be registered`);
    }

    const html = renderWorkspaceChoices();
    assert.equal([...html.matchAll(/class="action" href="/g)].length, 3);
    assert.equal([...html.matchAll(/data-i18n="openWorkspace"/g)].length, 3);
    assert.doesNotMatch(html, /<table\b|No records|Demo/i);
  });

  it("shows a setup notice only for setup or workspace-read failures", () => {
    assert.match(renderWorkspaceNotice("workspace_not_ready"), /href="\/account\/setup"/);
    assert.match(renderWorkspaceNotice("workspace_unreadable"), /did not change customer data/);
    assert.match(renderWorkspaceNotice("workspace_unavailable"), /Contact support/);
    assert.equal(renderWorkspaceNotice(""), "");
  });

  it("keeps signed-in navigation and sign-out together without a second sign-out action", () => {
    const logout = '<form method="post" action="/logout"><button>Log out</button></form>';
    const signedIn = frame.layout({
      title: "Your workspaces",
      eyebrow: "Your account",
      heading: "Your workspaces",
      headingI18nKey: "workspaceHomeHeading",
      body: "One account. Choose where you want to work.",
      bodyI18nKey: "workspaceHomeBody",
      sections: [renderWorkspaceChoices()],
      actions: [logout],
      authenticated: true
    });

    assert.match(signedIn, /href="\/dashboard" data-i18n="workspaces"/);
    assert.match(signedIn, /data-i18n="workspaceHomeHeading"/);
    assert.match(signedIn, /data-i18n="workspaceHomeBody"/);
    assert.doesNotMatch(signedIn, /href="\/login"|href="\/signup"/);
    assert.equal([...signedIn.matchAll(/action="\/logout"/g)].length, 2, "responsive menu placements share the same protected logout route");

    const publicPage = frame.layout({ title: "Home", heading: "Home", body: "Public", sections: [], actions: [] });
    assert.match(publicPage, /href="\/login"/);
    assert.match(publicPage, /href="\/signup"/);
    assert.doesNotMatch(publicPage, /action="\/logout"/);
  });

  it("keeps every studio destination in one grouped, registered module directory", () => {
    const groups = getWorkspaceDirectoryGroups();
    const routes = [
      ...groups.workspaces.flatMap((workspace) => workspace.categories.flatMap((category) => category.items.map((item) => item.route))),
      ...groups.shared.map((item) => item.route)
    ];
    assert.equal(new Set(routes).size, routes.length, "a module destination should appear only once in the directory");
    assert.equal(groups.workspaces.length, 3);
    assert.ok(routes.includes("/business-builder/market-intelligence"));
    assert.ok(routes.includes("/creator-studio/generation/voice"));
    assert.ok(routes.includes("/growth-studio/pipeline"));
    assert.ok(routes.includes("/billing"));
    assert.ok(ROUTE_REGISTRY.some((entry) => entry.route === "/workspace-modules" && entry.method === "GET"));
    const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
    assert.match(server, /linkAction\("\/workspace-modules", "Browse all modules"\)/);

    const html = renderWorkspaceDirectory();
    for (const route of routes) assert.ok(html.includes(`href="${route}"`), `${route} has no directory link`);
    assert.equal([...html.matchAll(/<details class="card sonara-module-directory__workspace">/g)].length, 4);
  });

  it("uses one canonical locale list for the saved and device preferences", () => {
    assert.deepEqual(SUPPORTED_LOCALE_CODES, ["en-US", "es", "fr", "de", "pt-BR"]);
    assert.equal(normalizeLocale("en"), "en-US");
    assert.equal(normalizeLocale("pt"), "pt-BR");
    assert.equal(normalizeLocale("__proto__"), "en-US");

    const html = frame.layout({ title: "Settings", heading: "Settings", body: "Settings", sections: [], actions: [] });
    const rendered = [...html.matchAll(/<option value="([^"]+)" lang="[^"]+">/g)].map((match) => match[1]);
    assert.deepEqual(rendered, UI_LOCALES.map(({ code }) => code));

    const browserCatalog = fs.readFileSync(path.join(root, "public", "sonara-one.js"), "utf8");
    const preferenceRoutes = fs.readFileSync(path.join(root, "routes", "sonara-route-registry-routes.cjs"), "utf8");
    const localeMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260926040000_align_user_preference_locales.sql"), "utf8");
    assert.match(browserCatalog, /function canonicalLanguage\(value\)/);
    assert.match(browserCatalog, /return dictionaries\[preferences\.language\.split\("-"\)\[0\]\]/);
    assert.match(preferenceRoutes, /UI_LOCALES\.map/);
    assert.match(preferenceRoutes, /SUPPORTED_LOCALE_CODES\.includes\(language\)/);
    for (const code of SUPPORTED_LOCALE_CODES) assert.ok(localeMigration.includes(`'${code}'`), `database constraint does not include ${code}`);
  });
});

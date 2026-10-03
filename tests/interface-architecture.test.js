"use strict";

const assert = require("node:assert/strict");
const { ROUTE_REGISTRY } = require("../lib/sonara-route-registry.cjs");
const { getWorkspaceDirectoryGroups } = require("../lib/sonara-workspace-directory.cjs");
const {
  COMPONENT_BACKLOG,
  COMPONENT_PRIORITIES,
  COMPONENT_STATUSES,
  DYNAMIC_ROUTE_PATTERNS,
  getComponentBacklogSummary,
  getFullSitemap,
  validateInterfaceArchitecture,
  workspaceCategoryForRoute
} = require("../lib/sonara-interface-architecture.cjs");

describe("SONARA sitemap and component backlog", () => {
  it("includes every canonical route-registry record exactly once", () => {
    const sitemap = getFullSitemap();
    const flattened = sitemap.sections.flatMap((section) =>
      section.categories.flatMap((category) => category.routes)
    );
    assert.equal(sitemap.fixedRouteCount, ROUTE_REGISTRY.length);
    assert.equal(flattened.length, ROUTE_REGISTRY.length);
    assert.equal(new Set(flattened.map((item) => `${item.route}|${item.productOwner || ""}|${item.visibility}`)).size, ROUTE_REGISTRY.length);
  });

  it("keeps workspace grouping aligned to customer jobs instead of screenshot layouts", () => {
    assert.equal(workspaceCategoryForRoute("/business-builder/owner/invoices", "business_builder"), "Commerce and money");
    assert.equal(workspaceCategoryForRoute("/business-builder/owner/schedules/week", "business_builder"), "People and schedules");
    assert.equal(workspaceCategoryForRoute("/creator-studio/owner/marketplace", "creator_studio"), "Marketplace and monetization");
    assert.equal(workspaceCategoryForRoute("/creator-studio/generation/jobs", "creator_studio"), "Generation and devices");
    assert.equal(workspaceCategoryForRoute("/growth-studio/pipeline", "growth_studio"), "Leads and pipeline");
    assert.equal(workspaceCategoryForRoute("/growth-studio/attribution", "growth_studio"), "Analytics and experiments");
  });

  it("keeps the existing workspace directory complete after recategorization", () => {
    const groups = getWorkspaceDirectoryGroups();
    for (const workspace of groups.workspaces) {
      const renderedRoutes = workspace.categories.flatMap((category) => category.items.map((item) => item.route));
      const expected = ROUTE_REGISTRY
        .filter((entry) => entry.method === "GET" && entry.productOwner === workspace.key && !entry.route.includes(":"))
        .map((entry) => entry.route);
      assert.deepEqual([...renderedRoutes].sort(), [...expected].sort(), `${workspace.key} lost a registered destination`);
    }
  });

  it("defines a governed component backlog with complete acceptance criteria", () => {
    assert.ok(COMPONENT_BACKLOG.length >= 50, "component backlog unexpectedly small");
    assert.equal(new Set(COMPONENT_BACKLOG.map((item) => item.id)).size, COMPONENT_BACKLOG.length);
    for (const item of COMPONENT_BACKLOG) {
      assert.ok(COMPONENT_STATUSES.includes(item.status), `${item.id} has invalid status`);
      assert.ok(COMPONENT_PRIORITIES.includes(item.priority), `${item.id} has invalid priority`);
      assert.ok(item.products.length > 0, `${item.id} has no product scope`);
      assert.ok(item.acceptanceCriteria.length >= 2, `${item.id} needs explicit acceptance criteria`);
      assert.ok(item.sourcePatterns.length > 0, `${item.id} needs a traceable research pattern`);
    }
  });

  it("treats parameterized publishing/detail paths as patterns, not menu claims", () => {
    const patterns = DYNAMIC_ROUTE_PATTERNS.map((item) => item.pattern);
    assert.equal(new Set(patterns).size, patterns.length);
    assert.ok(DYNAMIC_ROUTE_PATTERNS.every((item) => item.navigational === false));
    assert.ok(patterns.includes("/store/:slug"));
    assert.ok(patterns.includes("/book/:slug"));
    assert.ok(patterns.includes("/events/:slug"));
    assert.ok(patterns.includes("/marketplace/:id"));
    assert.ok(patterns.includes("/shared/:token"));
  });

  it("passes its own non-loss and duplicate checks", () => {
    const result = validateInterfaceArchitecture();
    const summary = getComponentBacklogSummary();
    assert.equal(result.ok, true, result.issues.join("\n"));
    assert.equal(result.issues.length, 0);
    assert.equal(summary.total, COMPONENT_BACKLOG.length);
    assert.equal(summary.byStatus.existing + summary.byStatus.extend + summary.byStatus.planned, COMPONENT_BACKLOG.length);
  });
});

// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { escapeHtml } = require("./sonara-shell.cjs");
const { plainRouteTitle, ROUTE_REGISTRY } = require("./sonara-route-registry.cjs");

const WORKSPACES = Object.freeze([
  Object.freeze({ key: "business_builder", name: "Business Builder", prefix: "/business-builder" }),
  Object.freeze({ key: "creator_studio", name: "Creator Studio", prefix: "/creator-studio" }),
  Object.freeze({ key: "growth_studio", name: "Growth Studio", prefix: "/growth-studio" })
]);

const SHARED_ROUTES = Object.freeze([
  "/billing",
  "/notifications",
  "/prompt-library",
  "/creator-studio/launch-readiness"
]);

function categoryFor(route, workspace) {
  if (route === `${workspace.prefix}/dashboard` || route === `${workspace.prefix}/start`) return "Workspace";
  if (route === `${workspace.prefix}/tools` || route.startsWith(`${workspace.prefix}/tools/`)) return "Free tools";
  if (route.startsWith(`${workspace.prefix}/owner/`)) return "Owner operations";
  if (workspace.key === "creator_studio" && /assets|rights|releases|generation|music|voice|sound|artists|album|video|scroll|studio|content/.test(route)) return "Create and protect";
  if (workspace.key === "growth_studio" && /campaign|lead|pipeline|follow|touchpoint|conversion|analytics|attribution|content/.test(route)) return "Campaigns and customers";
  if (workspace.key === "business_builder" && /customer|employee|location|inventory|vendor|route|vehicle|order|payment|booking|record/.test(route)) return "Business operations";
  if (/tutorial|catalog|market-intelligence|product-lifecycle|prompt|help|checklist|launch-readiness/.test(route)) return "Plan and learn";
  if (/request|deliverable|billing|support|automation/.test(route)) return "Delivery and support";
  return "More workspace tools";
}

function getWorkspaceDirectoryGroups(routeRegistry = ROUTE_REGISTRY) {
  const workspaces = WORKSPACES.map((workspace) => {
    const records = routeRegistry
      .filter((entry) => entry.method === "GET" && entry.productOwner === workspace.key && !entry.route.includes(":"))
      .sort((a, b) => a.route.localeCompare(b.route));
    const categories = new Map();
    for (const record of records) {
      const category = categoryFor(record.route, workspace);
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(record);
    }
    return Object.freeze({
      ...workspace,
      count: records.length,
      categories: [...categories.entries()].map(([name, items]) => Object.freeze({ name, items }))
    });
  });

  const shared = SHARED_ROUTES
    .map((route) => routeRegistry.find((entry) => entry.method === "GET" && entry.route === route))
    .filter(Boolean);
  return Object.freeze({ workspaces, shared });
}

function renderLinks(records) {
  return `<ul class="sonara-module-directory__links">${records.map((record) =>
    `<li><a href="${escapeHtml(record.route)}">${escapeHtml(plainRouteTitle(record))}<span aria-hidden="true">→</span></a></li>`
  ).join("")}</ul>`;
}

function renderWorkspaceDirectory() {
  const groups = getWorkspaceDirectoryGroups();
  const workspaces = groups.workspaces.map((workspace) => `<details class="card sonara-module-directory__workspace">
    <summary><span>${escapeHtml(workspace.name)}</span><small>${workspace.count} destinations</small></summary>
    <div class="sonara-module-directory__categories">
      ${workspace.categories.map((category) => `<section class="sonara-module-directory__category">
        <h3>${escapeHtml(category.name)}</h3>
        ${renderLinks(category.items)}
      </section>`).join("")}
    </div>
  </details>`).join("");

  return `<section class="sonara-module-directory" aria-label="Workspace modules">
    ${workspaces}
    <details class="card sonara-module-directory__workspace">
      <summary><span>Shared account tools</span><small>${groups.shared.length} destinations</small></summary>
      ${renderLinks(groups.shared)}
    </details>
  </section>`;
}

module.exports = { SHARED_ROUTES, WORKSPACES, getWorkspaceDirectoryGroups, renderWorkspaceDirectory };

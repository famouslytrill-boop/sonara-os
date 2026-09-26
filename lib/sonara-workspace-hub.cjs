// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { escapeHtml } = require("./sonara-shell.cjs");

const WORKSPACES = Object.freeze([
  Object.freeze({
    key: "businessBuilder",
    name: "Business Builder",
    description: "Set up offers and run daily operations.",
    href: "/business-builder/dashboard"
  }),
  Object.freeze({
    key: "creatorStudio",
    name: "Creator Studio",
    description: "Organize assets, rights, and release plans.",
    href: "/creator-studio/dashboard"
  }),
  Object.freeze({
    key: "growthStudio",
    name: "Growth Studio",
    description: "Plan campaigns and follow up with leads.",
    href: "/growth-studio/dashboard"
  })
]);

function renderWorkspaceChoices() {
  return `<section class="sonara-workspace-choices" aria-label="Your workspaces">
    ${WORKSPACES.map((workspace) => `<article class="card sonara-workspace-choice">
      <div>
        <h2><span data-i18n="${escapeHtml(workspace.key)}">${escapeHtml(workspace.name)}</span></h2>
        <p><span data-i18n="${escapeHtml(workspace.key)}Description">${escapeHtml(workspace.description)}</span></p>
      </div>
      <a class="action" href="${escapeHtml(workspace.href)}"><span data-i18n="openWorkspace">Open workspace</span><span aria-hidden="true">→</span></a>
    </article>`).join("")}
  </section>`;
}

function renderWorkspaceNotice(code = "") {
  if (code === "workspace_not_ready") {
    return `<article class="card sonara-workspace-notice" role="status">
      <h2><span data-i18n="workspaceSetupTitle">Set up your workspace</span></h2>
      <p><span data-i18n="workspaceSetupDescription">Create or connect an organization before saving work to your account.</span></p>
      <a class="action" href="/account/setup"><span data-i18n="workspaceSetupAction">Continue setup</span></a>
    </article>`;
  }

  if (["workspace_unreadable", "workspace_unavailable"].includes(code)) {
    return `<article class="card sonara-workspace-notice" role="status">
      <h2><span data-i18n="workspaceCheckTitle">Workspace connection needs a check</span></h2>
      <p><span data-i18n="workspaceCheckDescription">We could not confirm the saved workspace connection. This check did not change customer data.</span></p>
      <div class="card-actions">
        <a class="action" href="/account/setup"><span data-i18n="workspaceCheckAction">Check setup</span></a>
        <a class="action" href="/contact"><span data-i18n="contactSupport">Contact support</span></a>
      </div>
    </article>`;
  }

  return "";
}

module.exports = {
  WORKSPACES,
  renderWorkspaceChoices,
  renderWorkspaceNotice
};

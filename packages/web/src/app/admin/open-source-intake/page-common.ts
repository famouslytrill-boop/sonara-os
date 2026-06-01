import {
  buildExternalProjectRecommendation,
  getBlockedOpenSourceProjects,
  getLicenseReviewProjects,
  getOpenSourceIntakeSummary,
  getOpenSourceProjectRegistry,
  getReferenceOnlyProjects,
  getSecurityReviewProjects,
  openSourceIntakeFeatureFlags,
  type OpenSourceProjectRecord
} from "@signal-os/open-source-intake";
import { createElement, createMetric } from "../../../dom.ts";
import {
  renderAdminShell,
  renderAdminStatusBadge,
  renderEmptyState,
  renderMetricCard
} from "../../../ui/admin-components.ts";
import { renderRiskBadge } from "../../../ui/shared-components.ts";

export function renderOpenSourceIntakePage() {
  const summary = getOpenSourceIntakeSummary();
  const metrics = createElement("div", { className: "planning-grid" });
  for (const metric of [
    {
      title: "Intake candidates",
      value: String(summary.total),
      description: "Owner-provided projects are recorded as review candidates only.",
      status: "review" as const
    },
    {
      title: "Blocked tools",
      value: String(summary.blocked),
      description: "Scraping and unofficial messaging automation are blocked by policy.",
      status: "blocked" as const
    },
    {
      title: "License review",
      value: String(summary.licenseReview),
      description: "GPL, AGPL, unknown, and unreviewed licenses require owner/legal review.",
      status: "review" as const
    },
    {
      title: "Beta gated",
      value: String(summary.betaGated),
      description: "Voice, visual, and media candidates remain gated and not production-ready.",
      status: "beta" as const
    }
  ]) {
    metrics.append(renderMetricCard(metric));
  }

  const filterPanel = renderFilterPanel();
  const registryGrid = createElement("div", { className: "planning-grid" });
  for (const project of getOpenSourceProjectRegistry()) {
    registryGrid.append(renderProjectCard(project));
  }

  return renderAdminShell({
    activeRoute: "/admin/open-source-intake",
    title: "Open-Source Intake Registry",
    description:
      "Review external GitHub and open-source candidates before anything is copied, installed, vendored, self-hosted, or exposed to users.",
    warning:
      "No external code is copied here. No candidate is marked integrated unless a reviewed adapter or isolated service exists.",
    children: [
      renderFlagSummary(),
      metrics,
      filterPanel,
      createElement("h2", { textContent: "Project registry" }),
      registryGrid
    ]
  });
}

export function renderOpenSourceIntakeReviewsPage() {
  const legal = getLicenseReviewProjects();
  const security = getSecurityReviewProjects();
  return renderAdminShell({
    activeRoute: "/admin/open-source-intake",
    title: "Open-Source Reviews",
    description:
      "Projects requiring legal or security review before source reuse, adapters, self-hosting, or public exposure.",
    warning:
      "GPL/AGPL projects, unknown projects, automation tools, VPN tools, browser agents, and media generators require explicit review.",
    children: [
      createElement("h2", { textContent: "Legal review required" }),
      renderProjectList(legal, "No legal review items"),
      createElement("h2", { textContent: "Security review required" }),
      renderProjectList(security, "No security review items")
    ]
  });
}

export function renderOpenSourceIntakeBlockedPage() {
  const blocked = getBlockedOpenSourceProjects();
  return renderAdminShell({
    activeRoute: "/admin/open-source-intake",
    title: "Blocked External Tools",
    description:
      "Projects blocked from production use by license, provider-terms, scraping, messaging, or safety policy.",
    warning:
      "Blocked records do not have install buttons, adapter claims, or production enablement controls.",
    children: [renderProjectList(blocked, "No blocked tools")]
  });
}

export function renderOpenSourceRiskPage() {
  const blocked = getBlockedOpenSourceProjects();
  const referenceOnly = getReferenceOnlyProjects();
  return renderAdminShell({
    activeRoute: "/security-center",
    title: "Open-Source Risk",
    description:
      "Security Center view of external project intake, blocked tools, review gates, and reference-only boundaries.",
    warning:
      "External projects cannot bypass license review, security review, Owner Confirmation Lock, or beta gates.",
    children: [
      renderFlagSummary(),
      createElement("h2", { textContent: "Blocked by default" }),
      renderProjectList(blocked, "No blocked tools"),
      createElement("h2", { textContent: "Reference and concept only" }),
      renderProjectList(referenceOnly, "No reference-only projects")
    ]
  });
}

function renderFlagSummary() {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Safety defaults" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "External repositories are intake candidates. Auto-install, GPL/AGPL copying, scraping tools, and unofficial messaging automation stay disabled."
    })
  );
  for (const [key, value] of Object.entries(openSourceIntakeFeatureFlags)) {
    card.append(createMetric(key, String(value)));
  }
  return card;
}

function renderFilterPanel() {
  const form = createElement("form", { className: "planning-card shell-card" });
  form.setAttribute("aria-label", "Open-source intake filters");
  const searchLabel = createElement("label", { textContent: "Search projects" });
  const search = createElement("input", { type: "search" });
  search.setAttribute("name", "query");
  search.setAttribute("placeholder", "Repo, category, product fit");
  search.setAttribute("aria-describedby", "open-source-filter-help");
  searchLabel.append(search);

  const statusLabel = createElement("label", { textContent: "Integration status" });
  const status = createElement("select");
  status.setAttribute("name", "status");
  for (const optionLabel of ["All", "Not reviewed", "Blocked", "Reference only", "Coming later"]) {
    const option = createElement("option", { textContent: optionLabel });
    option.setAttribute("value", optionLabel.toLowerCase().replaceAll(" ", "_"));
    status.append(option);
  }
  statusLabel.append(status);

  const help = createElement("p", {
    className: "recommendation",
    textContent:
      "Static setup-mode controls. Production filtering should query reviewed registry records only."
  });
  help.setAttribute("id", "open-source-filter-help");
  form.append(
    createElement("h2", { textContent: "Search and filter" }),
    help,
    searchLabel,
    statusLabel
  );
  return form;
}

function renderProjectList(projects: readonly OpenSourceProjectRecord[], emptyTitle: string) {
  if (projects.length === 0) {
    return renderEmptyState({
      title: emptyTitle,
      description: "No projects match this review state."
    });
  }
  const grid = createElement("div", { className: "planning-grid" });
  for (const project of projects) {
    grid.append(renderProjectCard(project));
  }
  return grid;
}

function renderProjectCard(project: OpenSourceProjectRecord) {
  const recommendation = buildExternalProjectRecommendation(project);
  const card = createElement("article", { className: "planning-card shell-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: `${project.repoOwner}/${project.repoName}` }),
    renderAdminStatusBadge(project.integrationStatus)
  );
  const badges = createElement("div", { className: "badge-row" });
  badges.append(
    renderRiskBadge(`License: ${project.licenseRisk}`, riskTone(project.licenseRisk)),
    renderRiskBadge(`Security: ${project.securityRisk}`, riskTone(project.securityRisk)),
    renderAdminStatusBadge(project.useMode)
  );
  card.append(
    titleRow,
    createElement("a", {
      className: "secondary-action",
      href: project.normalizedUrl,
      textContent: "Open source page"
    }),
    badges,
    createMetric("Category", project.category),
    createMetric("Product fit", project.productFit.join(", ") || "No production fit"),
    createMetric("Decision", recommendation.decision.replaceAll("_", " ")),
    createElement("p", {
      className: "warning-copy",
      textContent: "No install action. No integration claim. Review is required before use."
    }),
    renderRules(project.rules)
  );
  return card;
}

function riskTone(risk: "low" | "medium" | "high" | "critical" | "unknown") {
  return risk === "unknown" ? "medium" : risk;
}

function renderRules(rules: readonly string[]) {
  const list = createElement("ul", { className: "security-list" });
  for (const rule of rules.slice(0, 4)) {
    list.append(createElement("li", { textContent: rule }));
  }
  return list;
}

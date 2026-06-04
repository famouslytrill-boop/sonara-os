import {
  canonicalAppRoutes,
  canonicalPublicRoutes,
  createDeploymentSyncReport,
  type DeploymentCheckResult,
  type DeploymentSyncFinding,
  type DeploymentSyncReport
} from "@signal-os/deployment-sync";
import { createElement, createMetric } from "../../../dom.ts";
import {
  renderAdminShell,
  renderAdminStatusBadge,
  renderMetricCard
} from "../../../ui/admin-components.ts";
import { renderRiskBadge } from "../../../ui/shared-components.ts";

type DeploymentSyncView =
  | "overview"
  | "domain"
  | "github"
  | "vercel"
  | "supabase"
  | "stripe"
  | "docker-rancher"
  | "security";

export function renderDeploymentSyncPage() {
  const report = createDeploymentSyncReport();
  const metrics = createElement("div", { className: "planning-grid" });
  for (const metric of [
    {
      title: "Canonical domain",
      value: report.canonicalDomain,
      description: "Primary public domain for SONARA Industries.",
      status: "review" as const
    },
    {
      title: "Blockers",
      value: String(report.summary.blockers),
      description: "Critical or blocked findings must be resolved before launch approval.",
      status: report.summary.blockers > 0 ? ("blocked" as const) : ("review" as const)
    },
    {
      title: "Needs review",
      value: String(report.summary.needsReview),
      description: "Manual verification items across cloud, auth, paywall, and security.",
      status: "review" as const
    },
    {
      title: "Rancher",
      value: report.statuses.rancher.status.replaceAll("_", " "),
      description: "Rancher remains optional for MVP unless explicitly configured.",
      status: "setup" as const
    }
  ]) {
    metrics.append(renderMetricCard(metric));
  }

  return renderDeploymentSyncShell(
    "Deployment Sync",
    "Domain, cloud, paywall, auth, security, and deployment status across SONARA Industries.",
    report,
    [
      metrics,
      renderRouteMap(),
      createElement("h2", { textContent: "Provider status" }),
      renderProviderGrid(report),
      createElement("h2", { textContent: "Launch blockers and review items" }),
      renderFindingList(report.findings)
    ]
  );
}

export function renderDeploymentSyncDomainPage() {
  const report = createDeploymentSyncReport();
  return renderDeploymentSyncShell(
    "Domain and SSL",
    "Canonical domain map, DNS checklist, SSL checklist, and app/public route boundaries.",
    report,
    [renderRouteMap(), renderCheckResult(report.statuses.domain)]
  );
}

export function renderDeploymentSyncGitHubPage() {
  return renderSingleProviderPage(
    "GitHub Sync",
    "GitHub repository, CI, branch protection, and review readiness.",
    "github"
  );
}

export function renderDeploymentSyncVercelPage() {
  return renderSingleProviderPage(
    "Vercel Sync",
    "Vercel project, domain, env, build, protection, redirects, and security header readiness.",
    "vercel"
  );
}

export function renderDeploymentSyncSupabasePage() {
  return renderSingleProviderPage(
    "Supabase Sync",
    "Supabase env, migrations, RLS, auth redirects, storage, and backup readiness.",
    "supabase"
  );
}

export function renderDeploymentSyncStripePage() {
  return renderSingleProviderPage(
    "Stripe and Paywall Sync",
    "Stripe prices, checkout, webhooks, portal, billing dashboard, owner payout, and paywall readiness.",
    "stripe"
  );
}

export function renderDeploymentSyncDockerRancherPage() {
  const report = createDeploymentSyncReport();
  return renderDeploymentSyncShell(
    "Docker and Rancher",
    "Container and Rancher checks. Rancher is optional and skipped for MVP unless configured.",
    report,
    [renderCheckResult(report.statuses.docker), renderCheckResult(report.statuses.rancher)]
  );
}

export function renderDeploymentSecurityPage() {
  const report = createDeploymentSyncReport();
  return renderDeploymentSyncShell(
    "Deployment Security",
    "Security headers, source leak scan, secret exposure, owner approval, and sensitive automation checks.",
    report,
    [
      renderCheckResult(report.statuses.security),
      renderCheckResult(report.statuses.auth),
      renderCheckResult(report.statuses.environment)
    ]
  );
}

function renderSingleProviderPage(
  title: string,
  description: string,
  key: Exclude<DeploymentSyncView, "overview" | "domain" | "docker-rancher" | "security">
) {
  const report = createDeploymentSyncReport();
  return renderDeploymentSyncShell(title, description, report, [
    renderCheckResult(report.statuses[key])
  ]);
}

function renderDeploymentSyncShell(
  title: string,
  description: string,
  report: DeploymentSyncReport,
  children: readonly HTMLElement[]
) {
  return renderAdminShell({
    activeRoute: "/admin/deployment-sync",
    title,
    description,
    warning:
      "Setup-mode verification only. This page does not prove cloud connection, DNS, SSL, Stripe live mode, Supabase project ownership, or Rancher cluster access.",
    children: [renderSummaryBanner(report), renderSectionNav(), ...children]
  });
}

function renderSummaryBanner(report: DeploymentSyncReport) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Last verification snapshot" }),
    createMetric("Generated", report.generatedAt),
    createMetric("Public base", report.publicBaseUrl),
    createMetric("App base path", report.appBasePath),
    createMetric("Configured", report.summary.configured),
    createMetric("Needs review", report.summary.needsReview),
    createMetric("Skipped for MVP", report.summary.skippedForMvp)
  );
  return card;
}

function renderSectionNav() {
  const nav = createElement("nav", { className: "badge-row" });
  nav.setAttribute("aria-label", "Deployment sync sections");
  for (const [href, label] of [
    ["/admin/deployment-sync/domain", "Domain"],
    ["/admin/deployment-sync/github", "GitHub"],
    ["/admin/deployment-sync/vercel", "Vercel"],
    ["/admin/deployment-sync/supabase", "Supabase"],
    ["/admin/deployment-sync/stripe", "Stripe"],
    ["/admin/deployment-sync/docker-rancher", "Docker/Rancher"],
    ["/security-center/deployment-security", "Security"]
  ]) {
    nav.append(createElement("a", { className: "secondary-action", href, textContent: label }));
  }
  return nav;
}

function renderRouteMap() {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Canonical routes" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "Public routes use the primary domain. App routes use the same domain with the /app path."
    }),
    renderRouteList("Public routes", canonicalPublicRoutes),
    renderRouteList("App routes", canonicalAppRoutes)
  );
  return card;
}

function renderRouteList(title: string, routes: readonly string[]) {
  const section = createElement("div", { className: "record-section" });
  const list = createElement("ul", { className: "security-list" });
  for (const route of routes) {
    list.append(
      createElement("li", {
        textContent: `https://sonaraindustries.com${route === "/" ? "" : route}`
      })
    );
  }
  section.append(createElement("h3", { textContent: title }), list);
  return section;
}

function renderProviderGrid(report: DeploymentSyncReport) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const result of Object.values(report.statuses)) {
    grid.append(renderProviderCard(result));
  }
  return grid;
}

function renderProviderCard(result: DeploymentCheckResult) {
  const card = createElement("article", { className: "planning-card shell-card" });
  const title = result.provider.charAt(0).toUpperCase() + result.provider.slice(1);
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: title }),
    renderAdminStatusBadge(result.status)
  );
  card.append(
    titleRow,
    renderRiskBadge(`Risk: ${result.riskLevel}`, riskTone(result.riskLevel)),
    createMetric("Findings", result.findings.length),
    createElement("p", {
      className: "recommendation",
      textContent: result.findings[0]?.message ?? "No findings."
    })
  );
  return card;
}

function renderCheckResult(result: DeploymentCheckResult) {
  const section = createElement("section", { className: "record-section" });
  section.append(
    createElement("h2", {
      textContent: `${result.provider.charAt(0).toUpperCase()}${result.provider.slice(1)} checks`
    }),
    renderFindingList(result.findings)
  );
  return section;
}

function renderFindingList(findings: readonly DeploymentSyncFinding[]) {
  const wrapper = createElement("div", { className: "planning-grid" });
  for (const finding of findings) {
    const card = createElement("article", { className: "planning-card shell-card" });
    const titleRow = createElement("div", { className: "shell-card__title-row" });
    titleRow.append(
      createElement("h3", { textContent: finding.findingKey }),
      renderAdminStatusBadge(finding.status)
    );
    card.append(
      titleRow,
      renderRiskBadge(`Risk: ${finding.riskLevel}`, riskTone(finding.riskLevel)),
      createElement("p", { className: "recommendation", textContent: finding.message }),
      createMetric("Provider", finding.provider)
    );
    wrapper.append(card);
  }
  return wrapper;
}

function riskTone(risk: "low" | "medium" | "high" | "critical") {
  return risk;
}

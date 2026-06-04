import { evaluateAiRunCost } from "@signal-os/ai-cost-control";
import { evaluateAgentAction } from "@signal-os/agent-orchestration-guard";
import { evaluateApiProvider, getBlockedApiProviders } from "@signal-os/api-provider-registry";
import { sonaraBrandExperience } from "@signal-os/brand-experience-system";
import { createGitHubUpdateWatchReport } from "@signal-os/github-update-watcher";
import {
  createMarketPatternChecklist,
  marketPatternCategories
} from "@signal-os/market-pattern-lab";
import { notificationSoundPreference } from "@signal-os/notification-sound-system";
import { revenueModelItems, summarizeRevenueModel } from "@signal-os/profitability-dashboard";
import { createElement, createMetric } from "../../dom.ts";
import {
  renderAdminShell,
  renderAdminStatusBadge,
  renderMetricCard
} from "../../ui/admin-components.ts";

export function renderGitHubUpdateWatcherPage() {
  const report = createGitHubUpdateWatchReport();
  const cards = createElement("div", { className: "planning-grid" });
  for (const repository of report.repositories) {
    cards.append(
      renderMetricCard({
        title: `${repository.repoOwner}/${repository.repoName}`,
        value: repository.allowedUse.replaceAll("_", " "),
        description:
          "Report only. No auto-install, auto-update, or auto-merge occurs from this watcher.",
        status: repository.requiresSecurityReview ? "review" : "setup"
      })
    );
  }
  return renderAdminShell({
    activeRoute: "/admin/github-update-watcher",
    title: "GitHub Update Watcher",
    description: "Weekly report-only watcher for selected research and admin-tool repositories.",
    warning:
      "This dashboard does not prove live GitHub API connection. Adoption requires owner approval.",
    children: [
      renderMetricCard({
        title: "Watched repos",
        value: String(report.repositories.length),
        description: "Configured as report-only intake candidates.",
        status: "review"
      }),
      cards
    ]
  });
}

export function renderAiCostControlPage() {
  const low = evaluateAiRunCost(1);
  const expensive = evaluateAiRunCost(10);
  const blocked = evaluateAiRunCost(75);
  return renderAdminShell({
    activeRoute: "/admin/ai-cost-control",
    title: "AI Cost Control",
    description: "Setup-mode budget guardrails for model and agent runs.",
    warning:
      "Expensive AI runs require owner approval. Provider keys and cost details are never exposed.",
    children: [
      renderMetricCard({
        title: "Low-cost draft run",
        value: low.allowed ? "Allowed" : "Review",
        description: low.reason,
        status: "ready"
      }),
      renderMetricCard({
        title: "Expensive run",
        value: expensive.ownerApprovalRequired ? "Owner approval" : "Allowed",
        description: expensive.reason,
        status: "review"
      }),
      renderMetricCard({
        title: "High-cost run",
        value: blocked.allowed ? "Allowed" : "Blocked",
        description: blocked.reason,
        status: "blocked"
      })
    ]
  });
}

export function renderProductionReadinessPage() {
  const items = [
    "Build, typecheck, lint, tests, and smoke must pass.",
    "Stripe webhook signature verification must be verified before paid launch.",
    "Admin routes must require owner/admin role in production.",
    "Secrets must remain server-side and redacted.",
    "Domain, SSL, Supabase, and paywall checks must be verified in the deployed environment."
  ];
  return renderAdminShell({
    activeRoute: "/admin/production-readiness",
    title: "Production Readiness",
    description: "Final go-live verification surface for the SONARA Industries launch path.",
    warning:
      "This page is a setup-mode checklist. It does not claim production cloud systems are connected.",
    children: [renderList("Critical readiness checks", items)]
  });
}

export function renderSecuritySettingsPage() {
  const agentDeploy = evaluateAgentAction("production_deploy");
  const stripe = evaluateApiProvider("stripe");
  const blockedProviders = getBlockedApiProviders();
  return renderAdminShell({
    activeRoute: "/admin/security-settings",
    title: "Security Settings",
    description: "Owner/admin setup-mode view for risky settings and provider boundaries.",
    warning:
      "Security setting changes require owner confirmation. Disabling safety gates is not available here.",
    children: [
      renderMetricCard({
        title: "Agent production deploy",
        value: agentDeploy.approvalRequired ? "Owner approval" : "Allowed",
        description: agentDeploy.reason,
        status: "review"
      }),
      renderMetricCard({
        title: "Stripe provider",
        value: stripe.status.replaceAll("_", " "),
        description: stripe.rules.join(" "),
        status: "review"
      }),
      renderList(
        "Blocked providers",
        blockedProviders.map((provider) => `${provider.label}: ${provider.rules.join(" ")}`)
      )
    ]
  });
}

export function renderMarketPatternLabPage() {
  return renderAdminShell({
    activeRoute: "/admin/market-pattern-lab",
    title: "Market Pattern Lab",
    description:
      "Research public app and market patterns as inspiration only, then convert them into original SONARA implementation notes.",
    warning:
      "Do not copy competitor code, protected copy, logos, private areas, or paywalled material.",
    children: [
      renderList(
        "Research categories",
        marketPatternCategories.map((category) => category.replaceAll("_", " "))
      ),
      renderList("Research rules", createMarketPatternChecklist())
    ]
  });
}

export function renderNotificationSettingsPage() {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Sound preferences" }),
    renderAdminStatusBadge("setup"),
    createMetric("Muted by default", String(notificationSoundPreference.mutedByDefault)),
    createMetric("User controlled", String(notificationSoundPreference.userControlled)),
    createMetric("No autoplay", String(notificationSoundPreference.autoplayBlocked)),
    createMetric("Sound types", notificationSoundPreference.enabledKeys.join(", "))
  );
  return renderAdminShell({
    activeRoute: "/admin/notification-settings",
    title: "Notification Settings",
    description: "Accessible sound notification policy for admin and owner review events.",
    warning:
      "Sounds are optional, user-controlled, and should respect reduced-motion and reduced-sound preferences.",
    children: [card]
  });
}

export function renderProfitabilityDashboardPage() {
  const summary = summarizeRevenueModel();
  const cards = createElement("div", { className: "planning-grid" });
  for (const item of revenueModelItems) {
    cards.append(
      renderMetricCard({
        title: item.label,
        value: item.monthlyPriceRange,
        description: item.rules.join(" "),
        status: item.status === "ready_for_checkout_mapping" ? "review" : "setup"
      })
    );
  }
  return renderAdminShell({
    activeRoute: "/admin/profitability-dashboard",
    title: "Profitability Dashboard",
    description:
      "Revenue model setup surface for subscriptions and setup services without fake revenue totals.",
    warning:
      "Do not claim guaranteed income, customers, growth, or live revenue until real Stripe records exist.",
    children: [
      renderMetricCard({
        title: "Revenue model items",
        value: String(summary.items),
        description: `${sonaraBrandExperience.finalMessage} No guarantees are made.`,
        status: summary.noGuarantees ? "ready" : "blocked"
      }),
      cards
    ]
  });
}

function renderList(title: string, items: readonly string[]) {
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ul", { className: "security-list" });
  for (const item of items) {
    list.append(createElement("li", { textContent: item }));
  }
  card.append(createElement("h2", { textContent: title }), list);
  return card;
}

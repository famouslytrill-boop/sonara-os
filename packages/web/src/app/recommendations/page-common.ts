import {
  blockedRecommendationBehaviors,
  createNextBestActions,
  createRankingAuditLedger,
  getBlockedSignalWeights,
  type RecommendationProductArea,
  type RecommendationRanking
} from "@signal-os/recommendation-transparency";
import { createElement, createMetric } from "../../dom.ts";
import { renderAdminShell, renderMetricCard } from "../../ui/admin-components.ts";
import {
  renderAppShell,
  renderDashboardHeader,
  renderRiskBadge,
  renderStatusBadge
} from "../../ui/shared-components.ts";

export function renderProductRecommendationsPage(productArea: RecommendationProductArea) {
  const rankings = createNextBestActions(productArea);
  const page = renderAppShell("recommendation-dashboard");
  page.append(
    renderDashboardHeader({
      kicker: "Smart Recommendations",
      title: `${productArea} Recommendations`,
      description:
        "Explainable setup suggestions. Risky or customer-facing actions are drafts only and route to Owner Confirmation Lock.",
      status: "Setup-mode"
    }),
    renderRecommendationSummary(rankings),
    renderRecommendationGrid(rankings)
  );
  return page;
}

export function renderRecommendationAuditPage() {
  const rankings = createNextBestActions("Owner Command Center");
  const auditEvents = createRankingAuditLedger(rankings);
  const cards = createElement("div", { className: "planning-grid" });
  for (const event of auditEvents) {
    cards.append(
      renderMetricCard({
        title: event.actionKey.replaceAll("_", " "),
        value: event.approvalRequirement.replaceAll("_", " "),
        description: event.summary,
        status: event.approvalRequirement === "blocked" ? "blocked" : "review"
      })
    );
  }
  return renderAdminShell({
    activeRoute: "/admin/recommendation-audit",
    title: "Recommendation Audit",
    description:
      "Review the setup-mode ranking ledger and approval requirements for suggested actions.",
    warning:
      "Recommendations do not auto-execute. Customer-facing or high-risk actions must use Owner Confirmation Lock.",
    children: [cards]
  });
}

export function renderRecommendationSafetyPage() {
  const blockedSignals = getBlockedSignalWeights();
  const cards = createElement("div", { className: "planning-grid" });
  for (const behavior of blockedRecommendationBehaviors) {
    cards.append(
      renderMetricCard({
        title: behavior.replaceAll("_", " "),
        value: "Blocked",
        description:
          "This behavior is excluded from ranking and cannot be used to create customer-facing pressure.",
        status: "blocked"
      })
    );
  }
  const signalList = createElement("ul", { className: "security-list" });
  for (const signal of blockedSignals) {
    signalList.append(createElement("li", { textContent: `${signal.label}: ${signal.reason}` }));
  }
  return renderAdminShell({
    activeRoute: "/security-center",
    title: "Recommendation Safety",
    description:
      "Security review surface for ranking guardrails, blocked behaviors, and sensitive-signal exclusions.",
    warning:
      "Sensitive attributes, fake urgency, fake scarcity, fake reviews, and automatic campaign sends stay blocked.",
    children: [cards, createElement("h2", { textContent: "Blocked signals" }), signalList]
  });
}

function renderRecommendationSummary(rankings: readonly RecommendationRanking[]) {
  const summary = createElement("div", { className: "planning-grid" });
  summary.append(
    renderMetricCard({
      title: "Suggested actions",
      value: String(rankings.length),
      description: "Setup-mode suggestions ranked from safe local signals.",
      status: "review"
    }),
    renderMetricCard({
      title: "Owner review",
      value: String(
        rankings.filter((ranking) => ranking.safety.approvalRequirement === "owner_review_required")
          .length
      ),
      description: "Customer-facing or high-risk suggestions require owner review.",
      status: "review"
    }),
    renderMetricCard({
      title: "Auto execution",
      value: "Disabled",
      description: "Recommendations prepare work; they do not execute risky actions.",
      status: "ready"
    })
  );
  return summary;
}

function renderRecommendationGrid(rankings: readonly RecommendationRanking[]) {
  const grid = createElement("div", { className: "planning-grid" });
  for (const ranking of rankings) {
    grid.append(renderRecommendationCard(ranking));
  }
  return grid;
}

function renderRecommendationCard(ranking: RecommendationRanking) {
  const card = createElement("article", { className: "planning-card shell-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: ranking.explanation.title }),
    renderRiskBadge(ranking.safety.riskLevel, ranking.safety.riskLevel)
  );
  card.append(
    titleRow,
    renderStatusBadge(ranking.safety.approvalRequirement.replaceAll("_", " "), "review"),
    createElement("p", {
      className: "recommendation",
      textContent: ranking.explanation.whySuggested
    }),
    createMetric("Score", String(ranking.score)),
    createMetric("Product area", ranking.explanation.productArea),
    createMetric("Expected value", ranking.explanation.expectedBusinessValue),
    createMetric("Data used", ranking.explanation.dataUsed.join(", ")),
    createMetric("Data not used", ranking.explanation.dataNotUsed.join(", ")),
    createMetric("Next action", ranking.explanation.nextAction)
  );
  return card;
}

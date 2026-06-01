import { createElement, createMetric } from "../../../dom.ts";
import {
  getCriticalGoLiveBlockers,
  goLiveCategoryLabels,
  goLiveChecklistItems,
  goLiveStatusLabels,
  summarizeGoLiveChecklist,
  type GoLiveCategory,
  type GoLiveChecklistItem,
  type GoLiveStatus
} from "../../../lib/go-live/index.ts";
import { renderStatusBadge, type BadgeTone } from "../../../ui/shared-components.ts";

const launchOrder = Object.freeze([
  "Finish local validation and source leak scan.",
  "Verify production environment variables and hosting configuration.",
  "Verify database migrations, RLS, auth, and admin protection.",
  "Verify Stripe, webhooks, pricing, and support ownership.",
  "Review public pages, legal pages, onboarding, and mobile layout.",
  "Approve rollback, backup, monitoring, and post-launch operations before release."
]);

export function renderAdminGoLiveChecklistPage() {
  const summary = summarizeGoLiveChecklist();
  const criticalBlockers = getCriticalGoLiveBlockers();
  const page = createElement("section", { className: "work-screen sonara-shell" });

  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Production readiness" }),
    createElement("h1", { textContent: "Go-live Checklist" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Track production launch requirements for domain, SSL, env vars, database, auth, billing, security, backups, monitoring, public pages, and mobile readiness."
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Critical items block launch until marked ready. This page does not expose secrets or replace manual production verification."
    })
  );

  const summaryGrid = createElement("div", { className: "security-summary" });
  summaryGrid.append(
    createMetric("Launch Status", summary.launchStatus === "go" ? "Go" : "No-go"),
    createMetric("Critical Open", summary.criticalOpen),
    createMetric("Blocked", summary.blocked),
    createMetric("Needs Review", summary.needsReview)
  );

  const blockerGrid = createElement("div", { className: "planning-grid" });
  for (const item of criticalBlockers) {
    blockerGrid.append(renderChecklistItem(item));
  }

  const groupedChecklist = createElement("div", { className: "planning-grid" });
  for (const category of Object.keys(goLiveCategoryLabels) as GoLiveCategory[]) {
    groupedChecklist.append(renderCategoryCard(category));
  }

  page.append(
    header,
    summaryGrid,
    createElement("h2", { textContent: "Critical Blockers" }),
    blockerGrid,
    createElement("h2", { textContent: "Launch Order" }),
    renderOrderedList(launchOrder),
    createElement("h2", { textContent: "Category Checklist" }),
    groupedChecklist
  );

  return page;
}

function renderCategoryCard(category: GoLiveCategory) {
  const items = goLiveChecklistItems.filter((item) => item.category === category);
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(createElement("h2", { textContent: goLiveCategoryLabels[category] }));
  for (const item of items) {
    card.append(renderChecklistItem(item));
  }
  return card;
}

function renderChecklistItem(item: GoLiveChecklistItem) {
  const wrapper = createElement("div", { className: "setup-checklist__item" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h3", { textContent: item.title }),
    renderStatusBadge(goLiveStatusLabels[item.status], statusTone(item.status))
  );
  if (item.critical) {
    titleRow.append(renderStatusBadge("Critical", item.status === "ready" ? "ready" : "blocked"));
  }
  wrapper.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: item.description }),
    createMetric("Verification", item.verification),
    createMetric("Next action", item.remediation)
  );
  return wrapper;
}

function renderOrderedList(items: readonly string[]) {
  const list = createElement("ol", { className: "security-list" });
  for (const item of items) {
    list.append(createElement("li", { textContent: item }));
  }
  return list;
}

function statusTone(status: GoLiveStatus): BadgeTone {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "needs_review") {
    return "review";
  }
  return "setup";
}

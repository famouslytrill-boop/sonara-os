import {
  evaluatePostLaunchAction,
  postLaunchOperationsQueues,
  postLaunchPolicyRules,
  summarizePostLaunchOperations,
  type OperationsQueue,
  type OperationsRisk,
  type PostLaunchApprovalLevel
} from "../../../lib/post-launch-operations/index.ts";
import { createElement, createMetric } from "../../../dom.ts";

const approvalLevelLabels: Record<PostLaunchApprovalLevel, string> = {
  auto_allowed: "Auto allowed",
  approval_required: "Owner approval required",
  blocked: "Always blocked"
};

export function renderPostLaunchOperationsPage() {
  const summary = summarizePostLaunchOperations();
  const page = createElement("section", { className: "work-screen sonara-shell" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Admin" }),
    createElement("h1", { textContent: "Post-launch Operations" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Run routine queues with minimum manual effort while escalating customer-facing, payment, legal, security, and owner-role decisions."
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "This dashboard is setup-mode only. It does not send customer messages, change payment links, issue refunds, delete records, or disable security gates."
    })
  );

  const metrics = createElement("div", { className: "metric-grid" });
  metrics.append(
    createMetric("Queues", summary.totalQueues),
    createMetric("Owner review", summary.needsOwnerReview),
    createMetric("Blocked queues", summary.blockedQueues),
    createMetric("Auto allowed", summary.autoAllowedActions)
  );

  const queueGrid = createElement("div", { className: "planning-grid" });
  for (const queue of postLaunchOperationsQueues) {
    queueGrid.append(renderQueueCard(queue));
  }

  const policyGrid = createElement("div", { className: "planning-grid" });
  for (const approvalLevel of ["auto_allowed", "approval_required", "blocked"] as const) {
    const rules = postLaunchPolicyRules.filter((rule) => rule.approvalLevel === approvalLevel);
    const card = createElement("article", { className: "planning-card shell-card" });
    const list = createElement("ul", { className: "safety-list" });
    for (const rule of rules) {
      const item = createElement("li");
      item.append(
        createElement("strong", { textContent: rule.label }),
        createElement("span", { textContent: ` - ${rule.reason}` })
      );
      list.append(item);
    }
    card.append(
      createElement("h2", { textContent: approvalLevelLabels[approvalLevel] }),
      createMetric("Rules", rules.length),
      list
    );
    policyGrid.append(card);
  }

  const reviewCard = createElement("article", { className: "planning-card shell-card" });
  const reviewList = createElement("ul", { className: "safety-list" });
  for (const item of [
    "Review customer-facing drafts before sending.",
    "Check billing, webhook, security, and reliability alerts.",
    "Approve or reject payment, pricing, legal, and generated-content changes.",
    "Confirm blocked actions remain blocked and unresolved risks are logged."
  ]) {
    reviewList.append(createElement("li", { textContent: item }));
  }
  reviewCard.append(createElement("h2", { textContent: "Owner daily review" }), reviewList);

  page.append(
    header,
    metrics,
    createElement("h2", { textContent: "Operations queues" }),
    queueGrid,
    createElement("h2", { textContent: "Automation policy" }),
    policyGrid,
    reviewCard
  );
  return page;
}

function renderQueueCard(queue: OperationsQueue) {
  const rule = evaluatePostLaunchAction(queue.actionKind);
  const card = createElement("article", { className: "planning-card shell-card" });
  const status = createElement("p", {
    className: `status-badge status-badge--${riskClass(queue.risk)}`,
    textContent: queue.status.replaceAll("_", " ")
  });
  card.append(
    status,
    createElement("h2", { textContent: queue.title }),
    createElement("p", { className: "screen-copy", textContent: queue.description }),
    createMetric("Open items", queue.count),
    createMetric("Policy", approvalLevelLabels[rule.approvalLevel]),
    createElement("p", { className: "screen-copy", textContent: queue.nextAction })
  );
  return card;
}

function riskClass(risk: OperationsRisk) {
  return risk === "critical" || risk === "high" ? "blocked" : "ready";
}

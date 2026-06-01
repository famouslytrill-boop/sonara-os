import { createElement, createMetric } from "../../../dom.ts";
import { approvalEventModel } from "../../../lib/security/trust-shield-mvp.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";
import { createSecuritySubPage } from "../page-common.ts";

export function renderApprovalGatesPage() {
  const page = createSecuritySubPage({
    kicker: "Trust Shield",
    title: "Approval Gates",
    description:
      "Owner-reviewed gates for payment, security, privacy, provider, and publishing changes."
  });

  const grid = createElement("div", { className: "planning-grid" });
  for (const event of approvalEventModel) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: event.approval_type }),
      createElement("p", { className: "recommendation", textContent: event.summary }),
      createMetric("Status", event.status),
      createMetric("Risk", event.risk),
      createMetric("Review", event.requiredReview)
    );
    grid.append(card);
  }

  page.append(
    renderSafetyGate({
      title: "Critical Approval Boundary",
      description:
        "Critical risks cannot proceed through launch until owner or admin review is complete.",
      risk: "critical",
      status: "blocked"
    }),
    grid
  );
  return page;
}

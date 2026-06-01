import {
  createAutopilotWorkflowEngine,
  safeAutomationPolicyRules,
  type ApprovalLevel,
  type WorkflowRecord
} from "@signal-os/autopilot";
import { createElement, createMetric } from "../../../dom.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";

export function renderAutomationReviewPage() {
  const engine = createAutopilotWorkflowEngine();
  const state = engine.seedDefaults();
  const page = createElement("section", { className: "work-screen sonara-shell security-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Trust Shield" }),
    createElement("h1", { textContent: "Automation Review" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Review routine workflow safety before automated actions are allowed to run."
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Blocked and review-required actions are displayed for review only. This route does not approve or execute sensitive actions."
    })
  );

  const summary = createElement("div", { className: "security-summary" });
  summary.append(
    createMetric("Approval required", state.approvalRequired.length),
    createMetric("Blocked", state.blocked.length),
    createMetric("Policy rules", safeAutomationPolicyRules.length)
  );

  const reviewGrid = createElement("div", { className: "planning-grid" });
  for (const record of [...state.approvalRequired, ...state.blocked]) {
    reviewGrid.append(renderReviewCard(record));
  }

  const gateGrid = createElement("div", { className: "planning-grid" });
  for (const level of ["owner_review", "blocked"] satisfies ApprovalLevel[]) {
    const rules = safeAutomationPolicyRules.filter((rule) => rule.approvalLevel === level);
    gateGrid.append(
      renderSafetyGate({
        title: approvalLevelLabel(level),
        description: `${rules.length} automation actions are classified as ${approvalLevelLabel(level).toLowerCase()}.`,
        risk: level === "blocked" ? "critical" : "high",
        status: level === "blocked" ? "blocked" : "review_required",
        href: "/admin/automation-rules"
      })
    );
  }

  page.append(
    header,
    summary,
    createElement("h2", { textContent: "Review Queue" }),
    reviewGrid,
    createElement("h2", { textContent: "Policy Gates" }),
    gateGrid
  );
  return page;
}

function renderReviewCard(record: WorkflowRecord) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h3", { textContent: record.title }),
    createElement("p", { className: "recommendation", textContent: record.description }),
    createMetric("Approval", approvalLevelLabel(record.approval_level)),
    createMetric("Risk", record.risk),
    createMetric("Status", record.status),
    createElement("p", { className: "warning-copy", textContent: record.policy_reason })
  );
  return card;
}

function approvalLevelLabel(level: ApprovalLevel) {
  const labels: Record<ApprovalLevel, string> = {
    auto_safe: "Auto-safe",
    owner_review: "Owner review",
    admin_review: "Admin review",
    blocked: "Blocked"
  };
  return labels[level];
}

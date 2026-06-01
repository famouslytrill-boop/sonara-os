import {
  safeAutomationPolicyRules,
  type ApprovalLevel,
  type AutomationPolicyRule
} from "@signal-os/autopilot";
import { createElement, createMetric } from "../../../dom.ts";

const approvalLevels = Object.freeze([
  "auto_safe",
  "owner_review",
  "admin_review",
  "blocked"
] satisfies readonly ApprovalLevel[]);

export function renderAutomationRulesPage() {
  const page = createElement("section", { className: "work-screen sonara-shell" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Admin" }),
    createElement("h1", { textContent: "Automation Rules" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Review the policy that decides which routine actions can queue, which require human approval, and which are blocked."
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Rules are model-only in this MVP. No live customer messaging, payment changes, publishing, deletion, or external sync runs from this page."
    })
  );

  const grid = createElement("div", { className: "planning-grid" });
  for (const level of approvalLevels) {
    grid.append(
      renderRuleGroup(
        level,
        safeAutomationPolicyRules.filter((rule) => rule.approvalLevel === level)
      )
    );
  }

  page.append(header, grid);
  return page;
}

function renderRuleGroup(level: ApprovalLevel, rules: readonly AutomationPolicyRule[]) {
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
    createElement("h2", { textContent: approvalLevelLabel(level) }),
    createMetric("Rules", rules.length),
    list
  );
  return card;
}

function approvalLevelLabel(level: ApprovalLevel) {
  const labels: Record<ApprovalLevel, string> = {
    auto_safe: "Auto-safe",
    owner_review: "Owner review required",
    admin_review: "Admin review required",
    blocked: "Blocked"
  };
  return labels[level];
}

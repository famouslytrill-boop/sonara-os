import { createElement, createMetric } from "../../dom.ts";
import {
  getRiskLabelText,
  isCriticalRiskBlocked,
  type RiskLabel,
  type SecurityItemStatus
} from "../../lib/security/trust-shield-mvp.ts";

export type SafetyGateProps = Readonly<{
  title: string;
  description: string;
  risk: RiskLabel;
  status: SecurityItemStatus;
  href?: string;
}>;

export function renderSafetyGate(props: SafetyGateProps) {
  const blocked = isCriticalRiskBlocked(props.risk, props.status);
  const article = createElement("article", {
    className: `planning-card safety-gate safety-gate--${props.risk}${
      blocked ? " safety-gate--blocked" : ""
    }`
  });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: props.title }),
    createElement("span", {
      className: `risk-pill risk-pill--${props.risk}`,
      textContent: blocked ? "Blocked" : getRiskLabelText(props.risk)
    })
  );
  article.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: props.description }),
    createMetric("Risk", getRiskLabelText(props.risk)),
    createMetric("Status", formatStatus(props.status))
  );
  if (blocked) {
    article.append(
      createElement("p", {
        className: "critical-copy",
        textContent: "Critical risks stay blocked until an owner or admin completes review."
      })
    );
  }
  if (props.href) {
    article.append(
      createElement("a", {
        className: "secondary-action",
        href: props.href,
        textContent: "Review"
      })
    );
  }
  return article;
}

function formatStatus(status: SecurityItemStatus): string {
  if (status === "review_required") {
    return "Review required";
  }
  if (status === "placeholder") {
    return "Setup placeholder";
  }
  if (status === "blocked") {
    return "Blocked";
  }
  return "Ready";
}

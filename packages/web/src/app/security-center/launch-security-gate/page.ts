import { createElement, createMetric } from "../../../dom.ts";
import {
  launchSecurityGateHardeningChecks,
  sensitiveAuditActionModels,
  sensitiveRateLimitPolicies,
  summarizeLaunchSecurityHardening
} from "../../../lib/security/index.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";
import { createSecurityList, createSecuritySubPage } from "../page-common.ts";

export function renderLaunchSecurityGatePage() {
  const summary = summarizeLaunchSecurityHardening();
  const page = createSecuritySubPage({
    kicker: "Launch Security Gate",
    title: "Launch Security Gate",
    description:
      "Review static headers, secret handling, API contracts, webhook checks, file safety, and audit readiness before live workflows are enabled."
  });

  const metrics = createElement("div", { className: "security-summary" });
  metrics.append(
    createMetric("Checks", summary.total),
    createMetric("Ready", summary.ready),
    createMetric("Blocked", summary.blocked),
    createMetric("Review Required", summary.reviewRequired)
  );

  const checklist = createElement("div", { className: "planning-grid" });
  for (const check of launchSecurityGateHardeningChecks) {
    checklist.append(
      renderSafetyGate({
        title: check.title,
        description: `${check.description} ${check.evidence}`,
        risk: check.risk,
        status: check.status
      })
    );
  }

  const rateLimitItems = sensitiveRateLimitPolicies.map(
    (policy) =>
      `${policy.label}: ${policy.maxRequests} requests per ${policy.windowSeconds} seconds, ${policy.enforcement.replace("_", " ")}.`
  );
  const auditItems = sensitiveAuditActionModels.map(
    (model) =>
      `${model.label}: ${model.risk} risk, ${
        model.requiresHumanReview ? "human review required" : "audit metadata required"
      }.`
  );

  page.append(
    metrics,
    createElement("h2", { textContent: "Hardening Checks" }),
    checklist,
    createElement("h2", { textContent: "Sensitive Rate Limit Stubs" }),
    createSecurityList(rateLimitItems),
    createElement("h2", { textContent: "Audit-Ready Sensitive Actions" }),
    createSecurityList(auditItems),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Setup mode only: this page does not process secrets, payment data, webhook events, or file uploads."
    })
  );

  return page;
}

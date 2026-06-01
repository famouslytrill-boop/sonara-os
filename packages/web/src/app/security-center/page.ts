import { createElement, createMetric } from "../../dom.ts";
import {
  launchSecurityChecklist,
  summarizeSecurityChecklist
} from "../../lib/security/trust-shield-mvp.ts";
import { renderSafetyGate } from "../../ui/security/safety-gate.ts";

const securityAreas = Object.freeze([
  Object.freeze({
    title: "Launch Security Gate",
    description: "Review headers, env, API, webhook, upload, and audit readiness before launch.",
    href: "/security-center/launch-security-gate",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Audit Logs",
    description: "Review the audit event model before real organization events are stored.",
    href: "/security-center/audit-logs",
    status: "Beta"
  }),
  Object.freeze({
    title: "Approval Gates",
    description: "Review owner approval boundaries for risky changes.",
    href: "/security-center/approval-gates",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Automation Review",
    description:
      "Review routine workflow queues, approval requirements, and blocked automation actions.",
    href: "/security-center/automation-review",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Human Approval Gates",
    description:
      "Confirm owner approval requirements for money, legal, customer, security, data, proof, review, and AI media actions.",
    href: "/security-center/human-approval-gates",
    status: "Live"
  }),
  Object.freeze({
    title: "Sensitive Actions",
    description:
      "Review the categories that default to owner approval or are blocked from routine automation.",
    href: "/security-center/sensitive-actions",
    status: "Live"
  }),
  Object.freeze({
    title: "Source Leak Prevention",
    description: "Keep secrets, private records, and service-role values out of public surfaces.",
    href: "/security-center/source-leak-prevention",
    status: "Admin Only"
  }),
  Object.freeze({
    title: "Phishing Defense",
    description: "Review payment destinations and external links before public display.",
    href: "/security-center/phishing-defense",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Provider Safety",
    description: "Keep external model calls behind approved gateway and safety boundaries.",
    href: "/security-center/external-model-safety",
    status: "Admin Only"
  }),
  Object.freeze({
    title: "Open-Source Risk",
    description:
      "Review external project license, security, product-fit, blocked-tool, and beta-gate decisions.",
    href: "/security-center/open-source-risk",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Deployment Security",
    description:
      "Review domain, cloud, env, auth, paywall, and secret-exposure checks before public deployment.",
    href: "/security-center/deployment-security",
    status: "Requires Review"
  }),
  Object.freeze({
    title: "Voice Safety",
    description: "Review consent, disclosure, and impersonation boundaries for beta voice work.",
    href: "/security-center/voice-safety",
    status: "Admin Only"
  }),
  Object.freeze({
    title: "Visual Safety",
    description: "Review rights, fake-proof prevention, and public generation boundaries.",
    href: "/security-center/visual-safety",
    status: "Admin Only"
  }),
  Object.freeze({
    title: "Video Source Safety",
    description: "Review source, consent, and private-video boundaries before processing.",
    href: "/security-center/video-source-safety",
    status: "Admin Only"
  })
]);

export function renderSecurityCenterPage() {
  const summary = summarizeSecurityChecklist();
  const page = createElement("section", { className: "work-screen sonara-shell security-page" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Trust Shield" }),
    createElement("h1", { textContent: "Security Center" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Review launch safety, approval gates, audit metadata, and provider boundaries before live workflows are enabled."
    }),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Setup preview only. No private audit events, customer records, payment data, or provider secrets are displayed here."
    })
  );

  const metrics = createElement("div", { className: "security-summary" });
  metrics.append(
    createMetric("Checks", summary.total),
    createMetric("Blocked", summary.blocked),
    createMetric("Review Required", summary.reviewRequired)
  );

  const checklist = createElement("div", { className: "planning-grid" });
  for (const check of launchSecurityChecklist) {
    checklist.append(
      renderSafetyGate({
        title: check.title,
        description: check.description,
        risk: check.risk,
        status: check.status,
        href: check.route
      })
    );
  }

  const areaGrid = createElement("div", { className: "planning-grid" });
  for (const area of securityAreas) {
    areaGrid.append(renderSecurityAreaCard(area));
  }

  page.append(
    header,
    metrics,
    createElement("h2", { textContent: "Launch Security Checklist" }),
    checklist,
    createElement("h2", { textContent: "Security Areas" }),
    areaGrid
  );
  return page;
}

function renderSecurityAreaCard(area: {
  title: string;
  description: string;
  href: string;
  status: string;
}) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: area.title }),
    createElement("p", { className: "recommendation", textContent: area.description }),
    createMetric("Status", area.status),
    createElement("a", {
      className: "secondary-action",
      href: area.href,
      textContent: "Open"
    })
  );
  return card;
}

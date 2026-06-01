import { createElement, createMetric } from "../../../dom.ts";
import { createEmailReadinessSnapshot } from "../../../lib/support/email-readiness.ts";
import { renderAdminShell, renderAdminStatusBadge } from "../../../ui/admin-components.ts";

export function renderAdminEmailReadinessPage() {
  const snapshot = createEmailReadinessSnapshot();
  const grid = createElement("div", { className: "planning-grid" });

  for (const item of snapshot.items) {
    const card = createElement("article", { className: "planning-card shell-card" });
    const titleRow = createElement("div", { className: "shell-card__title-row" });
    titleRow.append(
      createElement("h2", { textContent: item.label }),
      renderAdminStatusBadge(item.configured ? "ready" : "setup")
    );
    card.append(
      titleRow,
      createElement("p", { className: "recommendation", textContent: item.purpose }),
      createMetric("Configured", item.configured ? "yes" : "no"),
      createMetric("Visibility", item.serverOnly ? "server-only" : "public-safe label")
    );
    grid.append(card);
  }

  return renderAdminShell({
    activeRoute: "/admin/support",
    title: "Email Readiness",
    description:
      "Support and contact delivery checks for inbound routing, outbound provider setup, and safe fallback behavior.",
    warning:
      "This page does not prove Cloudflare Email Routing or outbound delivery. DNS/provider verification and a real test email remain human-required.",
    children: [
      renderSummary(snapshot.outboundConfigured, snapshot.storageConfigured),
      grid,
      renderManualSteps()
    ]
  });
}

function renderSummary(outboundConfigured: boolean, storageConfigured: boolean) {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Support delivery mode" }),
    createMetric("Outbound email", outboundConfigured ? "configured" : "not configured"),
    createMetric("Support storage", storageConfigured ? "configured" : "not configured"),
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Forms must validate and fail visibly if email or storage providers are unavailable. Do not log private message content in production."
    })
  );
  return card;
}

function renderManualSteps() {
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  const list = createElement("ul", { className: "security-list" });
  for (const step of [
    "Verify DNS/MX/SPF/DKIM/DMARC for inbound mail.",
    "Confirm the support inbox receives routed messages.",
    "Configure RESEND_API_KEY and RESEND_FROM_EMAIL only in the hosting provider.",
    "Send a real provider test email after secrets are configured.",
    "Keep passwords, card numbers, bank details, API keys, and private customer data out of support forms."
  ]) {
    list.append(createElement("li", { textContent: step }));
  }
  card.append(createElement("h2", { textContent: "Human-required checks" }), list);
  return card;
}

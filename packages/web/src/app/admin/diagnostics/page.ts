import { createElement, createMetric } from "../../../dom.ts";
import {
  createStripeBillingHealthSnapshot,
  getStripeTestModeChecklist
} from "../../../lib/billing-health/index.ts";
import { createDiagnosticsSnapshot, formatEnvStatus } from "../../../lib/debugging/index.ts";
import { renderStatusBadge } from "../../../ui/shared-components.ts";

export function renderAdminDiagnosticsPage() {
  const diagnostics = createDiagnosticsSnapshot();
  const stripeBillingHealth = createStripeBillingHealthSnapshot();
  const page = createElement("section", { className: "work-screen sonara-shell" });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Admin diagnostics" }),
    createElement("h1", { textContent: "Diagnostics" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Review app health and setup status without exposing secrets, raw provider keys, or private records."
    })
  );

  const summary = createElement("div", { className: "security-summary" });
  summary.append(
    createMetric("Version", diagnostics.appVersion),
    createMetric("Environment", diagnostics.environment),
    createMetric("Health", formatEnvStatus(diagnostics.health)),
    createMetric("Unsafe Flags", diagnostics.featureFlags.unsafeDisabled ? "Disabled" : "Review")
  );

  const grid = createElement("div", { className: "planning-grid" });
  grid.append(
    renderStatusCard("Health Check", diagnostics.health),
    renderStatusCard("Database", diagnostics.database),
    renderStatusCard("Stripe", diagnostics.stripe),
    renderStripeBillingHealthPanel(stripeBillingHealth),
    renderStatusCard("AI Providers", diagnostics.aiProviders),
    renderFeatureFlagCard(diagnostics.featureFlags.summary)
  );

  page.append(
    header,
    summary,
    grid,
    createElement("p", {
      className: "warning-copy",
      textContent:
        "Diagnostics are status-only. Secrets, tokens, webhook payloads, and connection strings are never shown here."
    })
  );
  return page;
}

function renderStripeBillingHealthPanel(
  health: ReturnType<typeof createStripeBillingHealthSnapshot>
) {
  const card = createElement("article", { className: "planning-card shell-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: "Stripe Test-mode Billing Health" }),
    renderStatusBadge(
      health.readyForTestCheckout ? "Ready" : "Setup required",
      health.readyForTestCheckout ? "ready" : "setup"
    )
  );

  const checklist = createElement("ul", { className: "security-list" });
  for (const item of getStripeTestModeChecklist()) {
    checklist.append(createElement("li", { textContent: item }));
  }

  card.append(
    titleRow,
    createElement("p", {
      className: "recommendation",
      textContent:
        "Redacted setup status for test-mode Checkout, subscriptions, webhooks, and customer portal testing."
    })
  );
  for (const field of health.fields) {
    card.append(createMetric(field.label, field.configured ? "Yes, redacted" : "No"));
  }
  card.append(
    createElement("p", { className: "warning-copy", textContent: health.modeWarning }),
    createElement("p", { className: "warning-copy", textContent: health.payoutWarning }),
    createElement("h3", { textContent: "Test-mode checklist" }),
    checklist
  );
  return card;
}

function renderStatusCard(title: string, status: { configured: boolean; message: string }) {
  const card = createElement("article", { className: "planning-card shell-card" });
  const titleRow = createElement("div", { className: "shell-card__title-row" });
  titleRow.append(
    createElement("h2", { textContent: title }),
    renderStatusBadge(
      status.configured ? "Configured" : "Setup required",
      status.configured ? "ready" : "setup"
    )
  );
  card.append(
    titleRow,
    createElement("p", { className: "recommendation", textContent: status.message }),
    createMetric("Status", status.configured ? "Configured" : "Setup required")
  );
  return card;
}

function renderFeatureFlagCard(summary: string) {
  const card = createElement("article", { className: "planning-card shell-card" });
  card.append(
    createElement("h2", { textContent: "Feature Flags" }),
    createElement("p", { className: "recommendation", textContent: summary })
  );
  return card;
}

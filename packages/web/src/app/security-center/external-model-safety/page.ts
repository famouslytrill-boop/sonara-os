import { createElement, createMetric } from "../../../dom.ts";
import { getAIProviderRegistry } from "../../../lib/ai-models/index.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";
import { createSecurityList, createSecuritySubPage } from "../page-common.ts";

export function renderExternalModelSafetyPage() {
  const page = createSecuritySubPage({
    kicker: "Trust Shield",
    title: "External Model Safety",
    description:
      "Provider safety placeholder for keeping external AI calls behind approved gateway, policy, and review boundaries."
  });

  page.append(
    renderSafetyGate({
      title: "Provider Safety",
      description:
        "External provider behavior stays blocked until gateway routing, policy checks, and review logging are wired.",
      risk: "critical",
      status: "blocked"
    }),
    createElement("h2", { textContent: "Required Boundaries" }),
    createSecurityList([
      "Provider calls must use Provider Gateway",
      "System prompts and secrets must not be exposed to users or providers unnecessarily",
      "Unsafe automation and policy bypass behavior stays disabled",
      "High-risk provider changes require human review before release",
      "Full private repo dumps require approval before external routing"
    ]),
    createElement("h2", { textContent: "Provider Safety Status" }),
    renderProviderSafetyGrid(),
    createElement("a", {
      className: "secondary-action security-back-link",
      href: "/admin/ai-providers",
      textContent: "Open AI Provider Registry"
    })
  );
  return page;
}

function renderProviderSafetyGrid() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const provider of getAIProviderRegistry()) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: provider.publicName }),
      createMetric("Default", provider.defaultEnabled ? "Enabled" : "Disabled"),
      createMetric("Approval", provider.approvalStatus),
      createMetric("Privacy risk", provider.privacyRisk),
      createMetric(
        "Sensitive external routing",
        provider.sensitiveDataRoutingEnabled ? "On" : "Off"
      )
    );
    grid.append(card);
  }
  return grid;
}

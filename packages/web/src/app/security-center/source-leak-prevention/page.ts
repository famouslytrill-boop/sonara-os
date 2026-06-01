import { createElement, createMetric } from "../../../dom.ts";
import { sourceLeakCheckDefinitions } from "../../../lib/security/source-leak-prevention.ts";
import { renderSafetyGate } from "../../../ui/security/safety-gate.ts";
import { createSecurityList, createSecuritySubPage } from "../page-common.ts";

export function renderSourceLeakPreventionPage() {
  const page = createSecuritySubPage({
    kicker: "Trust Shield",
    title: "Source Leak Prevention",
    description:
      "Setup checklist for keeping source, secrets, service-role keys, and private customer records out of public output."
  });

  page.append(
    renderSafetyGate({
      title: "Source Leak Prevention",
      description:
        "Critical findings from artifact scans block release until reviewed and removed.",
      risk: "critical",
      status: "blocked"
    }),
    createElement("h2", { textContent: "Artifact Scan Coverage" }),
    renderScanCoverage(),
    createElement("h2", { textContent: "Blocked Outputs" }),
    createSecurityList([
      "Service-role keys and provider secrets",
      "Private customer records and intake submissions",
      "Payment credentials, tokens, or webhook secrets",
      "Internal prompts, policies, and unreviewed debug case files"
    ])
  );
  return page;
}

function renderScanCoverage() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const check of sourceLeakCheckDefinitions) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: check.title }),
      createElement("p", { className: "recommendation", textContent: check.description }),
      createMetric("Severity", check.severity),
      createMetric("Release gate", check.severity === "critical" ? "Blocks release" : "Review")
    );
    grid.append(card);
  }
  return grid;
}

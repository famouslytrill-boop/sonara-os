import { createElement, createMetric } from "../../../dom.ts";
import {
  defaultGrowthTactics,
  growthChecklistTemplates,
  phoneOutreachComplianceWarning
} from "../../../lib/growth-studio/index.ts";

export function renderGrowthTacticsPage() {
  const page = createElement("section", {
    className: "work-screen sonara-shell record-page growth-studio-theme"
  });
  const header = createElement("header", { className: "shell-header" });
  header.append(
    createElement("p", { className: "shell-kicker", textContent: "Growth Studio" }),
    createElement("h1", { textContent: "Growth Tactics" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Draft tactics, checklists, and experiments without fake analytics, spam automation, or guaranteed growth claims."
    })
  );
  const tacticGrid = createElement("div", { className: "planning-grid" });
  for (const tactic of defaultGrowthTactics) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: tactic.title }),
      createElement("p", { className: "recommendation", textContent: tactic.description }),
      createMetric("Category", tactic.category.replaceAll("_", " ")),
      createMetric("Impact", tactic.expected_impact),
      createMetric("Effort", tactic.effort_level),
      createMetric("Risk", tactic.risk_level),
      createMetric("Status", tactic.status)
    );
    tacticGrid.append(card);
  }

  const checklistGrid = createElement("div", { className: "planning-grid" });
  for (const checklist of growthChecklistTemplates) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h3", { textContent: checklist.title }),
      createMetric("Items", checklist.items.length)
    );
    checklistGrid.append(card);
  }

  page.append(
    header,
    createElement("p", { className: "warning-copy", textContent: phoneOutreachComplianceWarning }),
    createElement("h2", { textContent: "Tactic drafts" }),
    tacticGrid,
    createElement("h2", { textContent: "Checklist templates" }),
    checklistGrid
  );
  return page;
}

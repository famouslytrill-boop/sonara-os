import { createElement, createMetric } from "../../dom.ts";
import { scaleState } from "../../scaleState.ts";

export function renderOpportunitiesPage() {
  const page = createElement("section", { className: "work-screen" });
  const revenue = createElement("div", { className: "planning-grid" });
  const licensing = createElement("div", { className: "planning-grid" });

  for (const opportunity of scaleState.revenueOpportunities) {
    revenue.append(
      renderOpportunityCard(opportunity.label, opportunity.value, opportunity.nextMove)
    );
  }

  for (const opportunity of scaleState.licensingOpportunities) {
    licensing.append(
      renderOpportunityCard(opportunity.label, opportunity.value, opportunity.nextMove)
    );
  }

  page.append(
    createElement("h1", { textContent: "Catalog Intelligence" }),
    createMetric("Catalog Leverage Score", `${scaleState.catalogLeverageScore}/100`),
    createElement("h2", { textContent: "Revenue Signals" }),
    revenue,
    createElement("h2", { textContent: "Licensing Signals" }),
    licensing
  );

  return page;
}

function renderOpportunityCard(label: string, value: string, nextMove: string) {
  const card = createElement("article", { className: "planning-card" });
  card.append(
    createElement("h3", { textContent: label }),
    createMetric("Signal", value),
    createElement("p", { className: "recommendation", textContent: nextMove })
  );
  return card;
}

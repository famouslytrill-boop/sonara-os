import { createElement, createMetric } from "../../dom.ts";
import { growthState } from "../../growthState.ts";

export function renderCreatorCrmPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const contact of growthState.creatorContacts) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: contact.name }),
      createMetric("Role", contact.role),
      createMetric("Pipeline", contact.stage),
      createElement("p", { className: "recommendation", textContent: contact.nextStep })
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Creator CRM" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Track collaborators and prospects without external CRM integration."
    }),
    grid
  );

  return page;
}

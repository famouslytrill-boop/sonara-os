import { createElement } from "../dom.ts";
import { getDataOwnershipSections } from "../lib/data-ownership/messaging.ts";

export function renderDataOwnershipSection(product: "business_builder" | "growth_studio") {
  const section = createElement("section", { className: "record-section" });
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of getDataOwnershipSections(product)) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: item.title }),
      createElement("p", { className: "recommendation", textContent: item.body })
    );
    grid.append(card);
  }
  section.append(createElement("h2", { textContent: "Data ownership" }), grid);
  return section;
}

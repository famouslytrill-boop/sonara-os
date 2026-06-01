import { createElement, createMetric } from "../../dom.ts";
import { growthState } from "../../growthState.ts";

export function renderLicensingPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const item of growthState.licensingTracker) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: item.opportunity }),
      createMetric("Use Case", item.useCase),
      createMetric("Status", item.status)
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Licensing Engine" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Track sync and licensing signals across the active pipeline."
    }),
    grid
  );

  return page;
}

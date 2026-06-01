import { createElement, createMetric } from "../../dom.ts";
import { scaleState } from "../../scaleState.ts";

export function renderTimelinePage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const plan of scaleState.timelinePlans) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: plan.format }),
      createMetric("Release Window", plan.window),
      createElement("p", { className: "recommendation", textContent: plan.checkpoint })
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Release Engine" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Schedule singles, EPs, albums, and staggered drops with campaign precision."
    }),
    grid
  );

  return page;
}

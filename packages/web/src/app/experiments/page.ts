import { createElement, createMetric } from "../../dom.ts";
import { growthState } from "../../growthState.ts";

export function renderExperimentsPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const experiment of growthState.experiments) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: experiment.surface }),
      createMetric("Variant A", experiment.variantA),
      createMetric("Variant B", experiment.variantB),
      createMetric("Success Metric", experiment.successMetric)
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Experiment Lab" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Compare hook, cover, and release-timing experiments before launch."
    }),
    grid
  );

  return page;
}

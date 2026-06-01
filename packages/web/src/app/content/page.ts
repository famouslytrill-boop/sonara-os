import { createElement, createMetric } from "../../dom.ts";
import { scaleState } from "../../scaleState.ts";

export function renderContentPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const plan of scaleState.contentPlans) {
    const card = createElement("article", { className: "planning-card planning-card--wide" });
    card.append(
      createElement("h2", { textContent: "Short-Form Signal Plan" }),
      createMetric("Hook", plan.hook),
      createMetric("Caption", plan.caption),
      createMetric("Visualizer Prompt", plan.visualizerPrompt),
      createMetric("Posting Cadence", plan.cadence)
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Content Machine" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Shape hooks, captions, visual prompts, and cadence for release lift."
    }),
    grid
  );

  return page;
}

import { createElement, createMetric } from "../../dom.ts";
import { growthState } from "../../growthState.ts";

export function renderAudiencePage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const segment of growthState.audienceSignals) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: segment.segment }),
      createMetric("Signal Size", segment.size),
      createElement("p", { className: "recommendation", textContent: segment.signal })
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Market Radar" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Map demand density across core, casual, and high-value listener groups."
    }),
    grid
  );

  return page;
}

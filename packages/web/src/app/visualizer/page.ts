import { createElement, createMetric } from "../../dom.ts";
import { scaleState } from "../../scaleState.ts";

export function renderVisualizerPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const board of scaleState.visualizerBoards) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: board.format }),
      createMetric("Direction", board.direction),
      createMetric("Motion Cue", board.motionCue)
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Visualizer Studio" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Storyboard loop, promo, and cover-motion concepts without rendering media."
    }),
    grid
  );

  return page;
}

import { createElement, createMetric } from "../dom.ts";
import type { StrategyPage } from "../strategyState.ts";

export function renderStrategyPage(pageState: StrategyPage) {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const cardState of pageState.cards) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: cardState.title }),
      createMetric("Signal", cardState.signal),
      createElement("p", { className: "recommendation", textContent: cardState.nextStep })
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: pageState.title }),
    createElement("p", { className: "screen-copy", textContent: pageState.summary }),
    grid
  );

  return page;
}

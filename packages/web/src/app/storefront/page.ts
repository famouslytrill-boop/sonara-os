import { createElement, createMetric } from "../../dom.ts";
import { scaleState } from "../../scaleState.ts";

export function renderStorefrontPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const offer of scaleState.storefrontOffers) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: offer.product }),
      createMetric("Pricing Signal", offer.priceSignal),
      createElement("p", { className: "recommendation", textContent: offer.packagingNote })
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Productization Engine" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Frame creative assets as premium storefront inventory."
    }),
    grid
  );

  return page;
}

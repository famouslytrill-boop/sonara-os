import { createElement, createMetric } from "../dom.ts";
import { SessionContext } from "../sessionContext.ts";
import { mutationVariants } from "../mutationVariants.ts";

export function renderMutationPage() {
  SessionContext.setCurrentStep("mutation");
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "variant-grid" });

  for (const variant of mutationVariants) {
    const card = createElement("article", { className: "variant-card" });
    const selectButton = createElement("button", {
      className: "ghost-action",
      textContent: "Select Variant"
    });

    selectButton.addEventListener("click", () => {
      SessionContext.setSelectedVariant(variant.name);
      selectButton.textContent = "Selected";
    });

    card.append(
      createElement("h2", { textContent: variant.name }),
      createMetric("Replay Score", variant.replayScore),
      createMetric("Audience Fit", variant.audienceFit),
      createMetric("Risk", variant.risk),
      createElement("p", { className: "recommendation", textContent: variant.recommendation }),
      selectButton
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Mutation Lab" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Compare mock variants before preparing an export bundle."
    }),
    grid,
    createElement("a", {
      className: "primary-action",
      href: "/export",
      textContent: "Continue to Export"
    })
  );

  return page;
}

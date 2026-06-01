import { createElement, createMetric } from "../dom.ts";
import { createMockMutationVariants } from "../mockWorkflow.ts";
import { SessionContext } from "../sessionContext.ts";
import { renderWorkflowGuardCard } from "../ui/workflow-guard-card.tsx";
import { getMissingRequirement, getRecoveryRoute } from "../workflows/workflow-guards.ts";

export function renderMutationPage() {
  SessionContext.setCurrentStep("mutation");
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "variant-grid" });

  const missingRequirement = getMissingRequirement("mutation", {
    composeComplete: Boolean(state.masterPrompt)
  });
  if (missingRequirement) {
    page.append(
      createElement("h1", { textContent: "Mutation Lab" }),
      renderWorkflowGuardCard({
        message: missingRequirement,
        href: state.analysis ? getRecoveryRoute("mutation") : "/analyze"
      })
    );
    return page;
  }

  const variants = state.variants.length > 0 ? state.variants : createMockMutationVariants();
  SessionContext.setState({ variants });

  for (const variant of variants) {
    const card = createElement("article", { className: "variant-card" });
    const selectButton = createElement("button", {
      className: "ghost-action",
      textContent: "Lock Mutation"
    });

    selectButton.addEventListener("click", () => {
      SessionContext.setSelectedVariant(variant.name);
      selectButton.textContent = "Locked";
    });

    card.append(
      createElement("h2", { textContent: variant.name }),
      createMetric("Critic Engine", variant.replayScore),
      createMetric("Market Radar", variant.marketScore),
      createMetric("Risk Index", variant.risk),
      createElement("p", { className: "recommendation", textContent: variant.recommendation }),
      selectButton
    );
    grid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Mutation Lab" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Score mutation paths before Export Forge assembly."
    }),
    grid,
    createElement("a", {
      className: "primary-action",
      href: "/export",
      textContent: "Open Export Forge"
    })
  );

  return page;
}

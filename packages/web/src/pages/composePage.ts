import { createElement, createMetric } from "../dom.ts";
import { createMockComposerSheet } from "../mockWorkflow.ts";
import { SessionContext } from "../sessionContext.ts";
import { renderWorkflowGuardCard } from "../ui/workflow-guard-card.tsx";
import { getMissingRequirement, getRecoveryRoute } from "../workflows/workflow-guards.ts";

export function renderComposePage() {
  SessionContext.setCurrentStep("compose");
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  const missingRequirement = getMissingRequirement("compose", {
    analysisComplete: Boolean(state.analysis)
  });
  if (missingRequirement) {
    page.append(
      createElement("h1", { textContent: "Compose System" }),
      renderWorkflowGuardCard({
        message: missingRequirement,
        href: state.uploadedFileName ? getRecoveryRoute("compose") : "/create"
      })
    );
    return page;
  }

  const generated =
    state.composerSheet && state.masterPrompt
      ? {
          composerSheet: state.composerSheet,
          masterPrompt: state.masterPrompt
        }
      : createMockComposerSheet(state);
  SessionContext.setState(generated);

  page.append(
    createElement("h1", { textContent: "Compose System" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Composer sheet and prompt synthesized from session intelligence."
    }),
    createMetric("Structure", generated.composerSheet.structure),
    createMetric("Arrangement", generated.composerSheet.arrangement),
    createMetric("Mix Direction", generated.composerSheet.mixDirection),
    createElement("p", { className: "prompt-card", textContent: generated.masterPrompt }),
    createElement("a", {
      className: "primary-action",
      href: "/mutation",
      textContent: "Open Mutation Lab"
    })
  );

  return page;
}

import { createElement, createMetric } from "../dom.ts";
import { createMockAnalysis } from "../mockWorkflow.ts";
import { SessionContext } from "../sessionContext.ts";
import { renderWorkflowGuardCard } from "../ui/workflow-guard-card.tsx";
import { getMissingRequirement, getRecoveryRoute } from "../workflows/workflow-guards.ts";

export function renderAnalyzePage() {
  SessionContext.setCurrentStep("analyze");
  let state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  const missingRequirement = getMissingRequirement("analyze", {
    uploadedFileName: state.uploadedFileName ?? undefined
  });
  if (missingRequirement) {
    page.append(
      createElement("h1", { textContent: "Analyze Intelligence" }),
      renderWorkflowGuardCard({
        message: missingRequirement,
        href: getRecoveryRoute("analyze")
      })
    );
    return page;
  }

  const uploadedFileName = state.uploadedFileName;
  if (!uploadedFileName) {
    return page;
  }

  if (!state.analysis) {
    const analysis = createMockAnalysis(uploadedFileName);
    SessionContext.setState({
      ...analysis,
      analysis
    });
    state = SessionContext.getState();
  }

  page.append(
    createElement("h1", { textContent: "Analyze Intelligence" }),
    createElement("p", {
      className: "screen-copy",
      textContent: `Session intelligence for ${uploadedFileName}.`
    }),
    createMetric("BPM", state.bpm),
    createMetric("Key", state.keySignature),
    createMetric("Emotion", state.emotion),
    createMetric("Market Radar", `${state.genreFit}%`),
    createMetric("Hook Index", `${state.hookPotential}%`),
    createElement("a", {
      className: "secondary-action",
      href: "/compose",
      textContent: "Open Compose System"
    })
  );

  return page;
}

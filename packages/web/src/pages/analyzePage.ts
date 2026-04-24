import { createElement, createMetric } from "../dom.ts";
import { SessionContext } from "../sessionContext.ts";

export function renderAnalyzePage() {
  SessionContext.setCurrentStep("analyze");
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  page.append(
    createElement("h1", { textContent: "Analyze" }),
    createElement("p", {
      className: "screen-copy",
      textContent: state.uploadedFileName
        ? `Mock intelligence for ${state.uploadedFileName}.`
        : "Mock intelligence is ready for the current session."
    }),
    createMetric("BPM", state.bpm),
    createMetric("Key", state.keySignature),
    createMetric("Emotion", state.emotion),
    createMetric("Genre Fit", `${state.genreFit}%`),
    createMetric("Hook Potential", `${state.hookPotential}%`),
    createElement("a", {
      className: "secondary-action",
      href: "/mutation",
      textContent: "Open Mutation Lab"
    })
  );

  return page;
}

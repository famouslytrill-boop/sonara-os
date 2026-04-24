import { createElement, createMetric } from "../dom.ts";
import { SessionContext } from "../sessionContext.ts";

export function renderExportPage() {
  SessionContext.setCurrentStep("export");
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  page.append(
    createElement("h1", { textContent: "Export" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Mock export bundle is ready for review with provenance enforced."
    }),
    createMetric("Source", state.uploadedFileName ?? "No file uploaded"),
    createMetric("Selected Variant", state.selectedVariant ?? "No variant selected"),
    createMetric("Provenance", "Attached")
  );

  return page;
}

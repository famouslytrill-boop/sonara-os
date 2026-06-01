import { createElement, createMetric } from "../dom.ts";
import { createMockExportBundle } from "../mockWorkflow.ts";
import { SessionContext } from "../sessionContext.ts";
import { SignalSound } from "../sound/signal-sound-engine.ts";
import { renderWorkflowGuardCard } from "../ui/workflow-guard-card.tsx";
import { getMissingRequirement, getRecoveryRoute } from "../workflows/workflow-guards.ts";

export function renderExportPage() {
  SessionContext.setCurrentStep("export");
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  const missingRequirement = getMissingRequirement("export", {
    mutationComplete: Boolean(state.selectedVariant)
  });
  if (missingRequirement) {
    page.append(
      createElement("h1", { textContent: "Export Forge" }),
      renderWorkflowGuardCard({
        message: missingRequirement,
        href: state.masterPrompt ? getRecoveryRoute("export") : "/compose"
      })
    );
    return page;
  }

  const createdExportResult = !state.exportResult;
  const bundle = state.exportResult ?? createMockExportBundle(state);
  SessionContext.setState({ exportResult: bundle });
  if (createdExportResult) {
    SignalSound.play("export_complete");
  }

  page.append(
    createElement("h1", { textContent: "Export Forge" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Release Engine bundle ready with provenance attached."
    }),
    createMetric("Signal Source", state.uploadedFileName ?? "No source file"),
    createMetric("Locked Mutation", state.selectedVariant ?? "No mutation locked"),
    createMetric("Provenance Passport", "Attached"),
    renderDownloadLink("signal-os-export.json", "application/json", bundle.json, "Export JSON"),
    renderDownloadLink("signal-os-export.txt", "text/plain", bundle.text, "Export TXT")
  );

  return page;
}

function renderDownloadLink(fileName: string, contentType: string, content: string, label: string) {
  const link = createElement("a", {
    className: "secondary-action",
    href: `data:${contentType};charset=utf-8,${encodeURIComponent(content)}`,
    textContent: label
  });
  link.setAttribute("download", fileName);
  return link;
}

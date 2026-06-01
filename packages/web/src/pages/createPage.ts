import { createElement } from "../dom.ts";
import { SessionContext } from "../sessionContext.ts";
import { renderSignalOrb } from "../signalOrb.ts";
import { completeUploadSimulation, uploadProgressStates } from "../uploadSimulation.ts";

export function renderCreatePage(onRoute: (path: string) => void) {
  SessionContext.setCurrentStep("create");

  const page = createElement("section", { className: "work-screen" });
  const title = createElement("h1", { textContent: "Signal Initialization" });
  const summary = createElement("p", {
    className: "screen-copy",
    textContent: "Decode the source file into the active Signal OS session."
  });
  const input = createElement("input", { className: "file-input", type: "file" });
  const button = createElement("button", {
    className: "primary-action",
    textContent: "Run Signal Initialization"
  });
  const progress = createElement("div", { className: "progress-readout", textContent: "0%" });
  const status = createElement("p", {
    className: "status-copy",
    textContent: "Source file required."
  });

  button.addEventListener("click", () => {
    const fileName = input.files?.[0]?.name;
    if (!fileName) {
      status.textContent = "Select a source file.";
      return;
    }

    button.setAttribute("disabled", "true");
    status.textContent = `Initializing ${fileName}`;

    uploadProgressStates.forEach((value, index) => {
      window.setTimeout(() => {
        progress.textContent = `${value}%`;
        if (value === 100) {
          SessionContext.setState(completeUploadSimulation(fileName));
          status.textContent = `Signal initialized for ${fileName}`;
          onRoute("/analyze");
        }
      }, index * 220);
    });
  });

  page.append(renderSignalOrb(), title, summary, input, button, progress, status);
  return page;
}

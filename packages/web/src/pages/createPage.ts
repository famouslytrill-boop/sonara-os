import { createElement } from "../dom.ts";
import { SessionContext } from "../sessionContext.ts";
import { completeUploadSimulation, uploadProgressStates } from "../uploadSimulation.ts";

export function renderCreatePage(onRoute: (path: string) => void) {
  SessionContext.setCurrentStep("create");

  const page = createElement("section", { className: "work-screen" });
  const title = createElement("h1", { textContent: "Create" });
  const summary = createElement("p", {
    className: "screen-copy",
    textContent: "Upload a track draft and decode mock session intelligence."
  });
  const input = createElement("input", { className: "file-input", type: "file" });
  const button = createElement("button", {
    className: "primary-action",
    textContent: "Decode Audio"
  });
  const progress = createElement("div", { className: "progress-readout", textContent: "0%" });
  const status = createElement("p", {
    className: "status-copy",
    textContent: "Waiting for an audio file."
  });

  button.addEventListener("click", () => {
    const fileName = input.files?.[0]?.name;
    if (!fileName) {
      status.textContent = "Select a file before decoding.";
      return;
    }

    button.setAttribute("disabled", "true");
    status.textContent = `Decoding ${fileName}`;

    uploadProgressStates.forEach((value, index) => {
      window.setTimeout(() => {
        progress.textContent = `${value}%`;
        if (value === 100) {
          SessionContext.setState(completeUploadSimulation(fileName));
          status.textContent = `Decoded ${fileName}`;
          onRoute("/analyze");
        }
      }, index * 220);
    });
  });

  page.append(title, summary, input, button, progress, status);
  return page;
}

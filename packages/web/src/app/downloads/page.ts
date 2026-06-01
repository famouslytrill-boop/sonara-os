import { createElement, createMetric } from "../../dom.ts";
import { createMockExportBundle } from "../../mockWorkflow.ts";
import { SessionContext } from "../../sessionContext.ts";

export function renderDownloadsPage() {
  const state = SessionContext.getState();
  const page = createElement("section", { className: "work-screen" });

  if (!state.selectedVariant) {
    page.append(
      createElement("h1", { textContent: "Download Center" }),
      createElement("p", {
        className: "warning-copy",
        textContent: "Export Forge output is required before artifacts can be listed."
      }),
      createElement("a", {
        className: "primary-action",
        href: "/export",
        textContent: "Open Export Forge"
      })
    );
    return page;
  }

  const bundle = state.exportResult ?? createMockExportBundle(state);
  SessionContext.setState({ exportResult: bundle });
  page.append(
    createElement("h1", { textContent: "Download Center" }),
    createElement("p", {
      className: "screen-copy",
      textContent: "Generated artifacts remain local to this browser session."
    }),
    createMetric("Locked Mutation", state.selectedVariant),
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

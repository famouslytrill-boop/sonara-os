import { createElement, createMetric } from "../../dom.ts";
import { createLaunchAuditReport } from "../../launchAudit.ts";
import { createLaunchReadinessChecklist } from "../../launchReadiness.ts";
import { renderAudioReadinessPanel } from "../../ui/media/audio-readiness-panel.tsx";
import { renderVideoReadinessPanel } from "../../ui/media/video-readiness-panel.tsx";

export function renderAdminPage() {
  const page = createElement("section", { className: "work-screen" });
  const grid = createElement("div", { className: "planning-grid" });
  const auditGrid = createElement("div", { className: "planning-grid" });

  for (const item of createLaunchReadinessChecklist()) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: item.label }),
      createMetric("Status", item.value)
    );
    grid.append(card);
  }

  for (const item of createLaunchAuditReport()) {
    const card = createElement("article", { className: "planning-card" });
    card.append(
      createElement("h2", { textContent: item.label }),
      createMetric("Audit", item.status),
      createElement("p", { className: "recommendation", textContent: item.detail })
    );
    auditGrid.append(card);
  }

  page.append(
    createElement("h1", { textContent: "Launch Readiness" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Operational checks for route health, media readiness, export safety, and provenance boundaries."
    }),
    grid,
    createElement("h2", { textContent: "Launch Audit" }),
    auditGrid,
    renderAudioReadinessPanel(),
    renderVideoReadinessPanel()
  );
  return page;
}

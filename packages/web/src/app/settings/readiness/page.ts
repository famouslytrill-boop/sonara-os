import { createElement, createMetric } from "../../../dom.ts";
import { createLiveReadinessSnapshot } from "../../../lib/readiness/live-readiness.ts";
import { renderStatusBadge } from "../../../ui/shared-components.ts";

export function renderSettingsReadinessPage() {
  const snapshot = createLiveReadinessSnapshot();
  const page = createElement("section", { className: "work-screen sonara-shell" });
  const grid = createElement("div", { className: "planning-grid" });

  for (const check of snapshot.checks) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("div", { className: "shell-card__title-row" }),
      createElement("p", { className: "recommendation", textContent: check.detail }),
      createMetric("Scope", check.serverOnly ? "server-only" : "public/setup"),
      createMetric("Status", check.status.replaceAll("_", " "))
    );
    const titleRow = card.children[0] as HTMLElement;
    titleRow.append(
      createElement("h2", { textContent: check.label }),
      renderStatusBadge(
        check.status.replaceAll("_", " "),
        check.status === "configured" ? "ready" : "review"
      )
    );
    grid.append(card);
  }

  page.append(
    createElement("p", { className: "shell-kicker", textContent: "Live readiness" }),
    createElement("h1", { textContent: "Settings Readiness" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "This setup surface reports missing environment, auth, organization, RLS, email, and provider work without exposing secrets or private records."
    }),
    createMetric("Generated", snapshot.generatedAt),
    createMetric("Production safe", snapshot.productionSafe ? "yes" : "no"),
    grid
  );
  return page;
}

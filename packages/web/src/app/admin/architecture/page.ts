import { createElement, createMetric } from "../../../dom.ts";
import { cloudArchitectureNodes } from "../../../lib/architecture/cloud-architecture.ts";
import { renderAdminShell } from "../../../ui/admin-components.ts";

export function renderAdminArchitecturePage() {
  const grid = createElement("div", { className: "planning-grid" });
  for (const item of cloudArchitectureNodes) {
    const card = createElement("article", { className: "planning-card shell-card" });
    card.append(
      createElement("h2", { textContent: item.label }),
      createElement("p", { className: "recommendation", textContent: item.detail }),
      createMetric("Layer", item.layer),
      createMetric("Status", item.status.replaceAll("_", " "))
    );
    grid.append(card);
  }
  return renderAdminShell({
    activeRoute: "/admin/architecture",
    title: "Cloud Architecture",
    description:
      "Internal launch architecture map for frontend, backend, providers, agents, products, and admin controls.",
    warning:
      "Missing integrations are marked as provider-gated. No secrets, keys, private prompts, or tenant records are shown.",
    children: [grid]
  });
}

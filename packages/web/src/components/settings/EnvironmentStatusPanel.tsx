import { createElement, createMetric } from "../../dom.ts";
import { createEnvironmentStatusSnapshot } from "../../lib/env-status.ts";

export function renderEnvironmentStatusPanel() {
  const snapshot = createEnvironmentStatusSnapshot();
  const card = createElement("article", {
    className: "planning-card planning-card--wide shell-card"
  });
  card.append(
    createElement("h2", { textContent: "Environment status" }),
    createMetric("Production safe", snapshot.productionSafe ? "yes" : "no")
  );
  for (const item of snapshot.items) {
    card.append(
      createMetric(
        item.label,
        `${item.configured ? "configured" : "missing"} / ${item.publicSafe ? "public-safe" : "server-only"}`
      )
    );
  }
  card.append(
    createElement("p", {
      className: "warning-copy",
      textContent:
        "This panel never displays env values. It only reports configured/missing status."
    })
  );
  return card;
}

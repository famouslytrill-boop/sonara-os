import { createElement, createMetric } from "../../dom.ts";
import type { FeatureSpecCard } from "../../lib/requirements/index.ts";

export function renderFeatureSpecCard(spec: FeatureSpecCard): HTMLElement {
  const card = createElement("article", { className: "shell-card planning-card" });
  const tests = createElement("ul");
  for (const test of spec.tests) {
    tests.append(createElement("li", { textContent: test }));
  }
  card.append(
    createElement("h2", { textContent: spec.title }),
    createElement("p", { className: "recommendation", textContent: spec.problem }),
    createMetric("User", spec.audience),
    createMetric("Route", spec.route),
    createMetric("Data", spec.dataNeeded),
    createMetric("Permissions", spec.permissionsRequired),
    createMetric("Blocked", spec.blockedBehavior),
    createMetric("Done", spec.doneDefinition),
    createMetric("Owner review", spec.ownerReviewRequired ? "Required" : "Not required"),
    createElement("h3", { textContent: "Tests" }),
    tests
  );
  return card;
}

import { createElement } from "../../dom.ts";
import { getFeatureIntakeRequiredQuestions } from "../../lib/requirements/index.ts";

export function renderFeatureIntakeClarifier(): HTMLElement {
  const section = createElement("section", { className: "work-screen sonara-shell" });
  const list = createElement("ol");
  for (const question of getFeatureIntakeRequiredQuestions()) {
    list.append(createElement("li", { textContent: question }));
  }
  section.append(
    createElement("p", { className: "shell-kicker", textContent: "Requirements Gate" }),
    createElement("h1", { textContent: "Feature Intake Clarifier" }),
    createElement("p", {
      className: "screen-copy",
      textContent:
        "Clarify feature requests before development so vague ASAP work cannot bypass route, data, permission, safety, and test requirements."
    }),
    list
  );
  return section;
}

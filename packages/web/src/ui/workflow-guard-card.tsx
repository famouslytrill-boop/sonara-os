import { createElement } from "../dom.ts";

export function renderWorkflowGuardCard({ message, href }: { message: string; href: string }) {
  const section = createElement("section", { className: "warning-copy workflow-guard-card" });
  section.append(
    createElement("h2", { textContent: "Workflow Requirement" }),
    createElement("p", { textContent: message }),
    createElement("a", {
      className: "secondary-action",
      href,
      textContent: "Return to Required Step"
    })
  );
  return section;
}

export const WorkflowGuardCard = renderWorkflowGuardCard;

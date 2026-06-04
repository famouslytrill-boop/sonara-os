import { createElement } from "../../dom.ts";
import { ownerBootstrapSteps } from "../../lib/auth/owner-bootstrap-policy.ts";

export function renderOwnerBootstrapNotice() {
  const card = createElement("article", { className: "planning-card shell-card" });
  const list = createElement("ol", { className: "security-list" });
  for (const step of ownerBootstrapSteps) {
    list.append(createElement("li", { textContent: step }));
  }
  card.append(
    createElement("h2", { textContent: "Owner bootstrap required" }),
    createElement("p", {
      className: "recommendation",
      textContent:
        "The first owner is created manually in Supabase so no public route can grant admin access."
    }),
    list
  );
  return card;
}

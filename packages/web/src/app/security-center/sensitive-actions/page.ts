import {
  renderOwnerReviewShell,
  renderSensitiveCategoryGrid
} from "../../admin/owner-review/page-common.ts";
import { createElement } from "../../../dom.ts";

export function renderSensitiveActionsPage() {
  return renderOwnerReviewShell({
    title: "Sensitive Actions Registry",
    description:
      "Registry of action categories that require owner confirmation or are blocked from routine automation.",
    children: [
      createElement("h2", { textContent: "Registered sensitive actions" }),
      renderSensitiveCategoryGrid()
    ]
  });
}

import {
  renderOwnerReviewShell,
  renderPolicyFlagSummary,
  renderSensitiveCategoryGrid
} from "../../admin/owner-review/page-common.ts";
import { createElement } from "../../../dom.ts";

export function renderHumanApprovalGatesPage() {
  return renderOwnerReviewShell({
    title: "Human Approval Gates",
    description:
      "Central approval rules for sensitive automation. High-risk actions must call the Human Approval Gate before execution.",
    children: [
      renderPolicyFlagSummary(),
      createElement("h2", { textContent: "Sensitive categories" }),
      renderSensitiveCategoryGrid()
    ]
  });
}

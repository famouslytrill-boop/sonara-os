import {
  filterRecordsByStatus,
  renderOwnerReviewShell,
  renderOwnerReviewSummary,
  renderRecordGrid
} from "../page-common.ts";
import { createElement } from "../../../../dom.ts";

export function renderOwnerReviewApprovedPage() {
  return renderOwnerReviewShell({
    title: "Approved Actions",
    description:
      "Approved actions may execute only after confirmation is recorded and audit history is retained.",
    children: [
      renderOwnerReviewSummary(),
      createElement("h2", { textContent: "Approved in setup preview" }),
      renderRecordGrid(filterRecordsByStatus("approved"))
    ]
  });
}

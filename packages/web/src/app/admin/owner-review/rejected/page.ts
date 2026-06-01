import {
  filterRecordsByStatus,
  renderOwnerReviewShell,
  renderOwnerReviewSummary,
  renderRecordGrid
} from "../page-common.ts";
import { createElement } from "../../../../dom.ts";

export function renderOwnerReviewRejectedPage() {
  return renderOwnerReviewShell({
    title: "Rejected Actions",
    description:
      "Rejected actions cannot execute. They must be revised and resubmitted for a new owner review.",
    children: [
      renderOwnerReviewSummary(),
      createElement("h2", { textContent: "Rejected in setup preview" }),
      renderRecordGrid(filterRecordsByStatus("rejected"))
    ]
  });
}

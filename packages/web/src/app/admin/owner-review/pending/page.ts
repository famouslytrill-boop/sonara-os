import {
  createOwnerReviewDemoState,
  renderOwnerReviewShell,
  renderOwnerReviewSummary,
  renderRecordGrid
} from "../page-common.ts";
import { createElement } from "../../../../dom.ts";

export function renderOwnerReviewPendingPage() {
  const state = createOwnerReviewDemoState();
  const pendingRecords = state.queue
    .map((item) => state.records.find((record) => record.id === item.action_id))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  return renderOwnerReviewShell({
    title: "Pending Owner Approvals",
    description:
      "Pending actions are draft-only until the owner approves them. Unknown sensitive actions also land here by default.",
    children: [
      renderOwnerReviewSummary(),
      createElement("h2", { textContent: "Needs owner confirmation" }),
      renderRecordGrid(pendingRecords)
    ]
  });
}

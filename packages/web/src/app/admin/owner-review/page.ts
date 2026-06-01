import {
  createOwnerReviewDemoState,
  renderAuditHistory,
  renderOwnerReviewShell,
  renderOwnerReviewSummary,
  renderRecordGrid,
  renderSensitiveCategoryGrid
} from "./page-common.ts";
import { createElement } from "../../../dom.ts";

export function renderOwnerReviewPage() {
  const state = createOwnerReviewDemoState();
  const pendingRecords = state.queue
    .map((item) => state.records.find((record) => record.id === item.action_id))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  return renderOwnerReviewShell({
    title: "Owner Review Queue",
    description:
      "Review high-risk actions before they affect money, pricing, payout settings, legal copy, customers, security, data, proof, reviews, or AI media.",
    children: [
      renderOwnerReviewSummary(),
      createElement("h2", { textContent: "Pending approvals" }),
      renderRecordGrid(pendingRecords),
      createElement("h2", { textContent: "Required approval categories" }),
      renderSensitiveCategoryGrid(),
      renderAuditHistory()
    ]
  });
}

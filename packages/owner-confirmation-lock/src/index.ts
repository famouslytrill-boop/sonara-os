export * from "./types.ts";
export * from "./sensitive-action-registry.ts";
export * from "./action-risk-classifier.ts";
export * from "./owner-confirmation-policy.ts";
export * from "./approval-audit-ledger.ts";
export { createOwnerReviewQueueItem as createOwnerReviewQueueItemFromRecord } from "./owner-review-queue.ts";
export * from "./blocked-action-handler.ts";
export * from "./human-approval-gate.ts";
export * from "./confirmation-token.ts";

export const OwnerConfirmationLock = Object.freeze({
  internalName: "OwnerConfirmationLock",
  publicName: "Owner Confirmation Lock",
  status: "enabled",
  purpose:
    "Draft, queue, and prepare routine work while blocking or escalating high-risk actions until owner confirmation."
});

export const syncStatuses = ["local_only", "pending_review", "ready_to_sync", "conflict"] as const;

export function requiresConflictReview(status: (typeof syncStatuses)[number]) {
  return status === "conflict" || status === "pending_review";
}

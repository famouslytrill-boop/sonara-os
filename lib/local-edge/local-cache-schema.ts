export type LocalCacheRecord = {
  id: string;
  organizationId: string;
  type: "draft" | "offline_edit" | "temporary_processing";
  syncStatus: "local_only" | "pending_review" | "ready_to_sync" | "conflict";
  updatedAt: string;
};

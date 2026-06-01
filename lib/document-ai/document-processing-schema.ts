export type DocumentProcessingJob = {
  id: string;
  organizationId: string;
  fileName: string;
  status: "queued" | "processing" | "needs_review" | "approved" | "blocked" | "failed";
  provider: "placeholder" | "external_reviewed_provider";
};

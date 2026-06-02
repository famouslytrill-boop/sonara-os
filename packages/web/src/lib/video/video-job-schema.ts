export type VideoJobStatus = "draft" | "queued" | "rendering" | "review_required" | "exported";

export type VideoJobDraft = Readonly<{
  organizationId: string;
  templateId: string;
  status: VideoJobStatus;
  rightsReviewRequired: boolean;
  quotaReserved: boolean;
}>;

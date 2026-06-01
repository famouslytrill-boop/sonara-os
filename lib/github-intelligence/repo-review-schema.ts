export type RepoReview = {
  repoUrl: string;
  reviewerUserId: string;
  licenseReviewed: boolean;
  securityReviewed: boolean;
  privacyReviewed: boolean;
  ownerApproved: boolean;
  notes?: string;
};

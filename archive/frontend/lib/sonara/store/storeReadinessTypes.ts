export type StoreProductReadinessStatus =
  | "draft"
  | "ready"
  | "blocked"
  | "needs_payment_setup"
  | "needs_license_review";

export type StoreProductReadinessInput = {
  title?: string;
  description?: string;
  price?: number;
  stripePriceId?: string;
  licenseTerms?: string;
  previewImage?: string;
  includedFiles?: string[];
  refundSupportNote?: string;
  rightsClassification?: string;
  exportBundleExists?: boolean;
  hasBlockedSoundAssets?: boolean;
  attributionSheetExists?: boolean;
  requiresAttribution?: boolean;
};

export type StoreProductReadinessResult = {
  status: StoreProductReadinessStatus;
  missing: string[];
  canPublish: boolean;
};

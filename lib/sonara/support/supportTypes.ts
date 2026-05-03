export type SupportCategory =
  | "account"
  | "billing"
  | "exports"
  | "sound_rights"
  | "app_bug"
  | "feature_request"
  | "google_play_mobile"
  | "store_product"
  | "sound_discovery_license_review"
  | "writing_lyrics";

export type SupportRequestDraft = {
  category: SupportCategory;
  email?: string;
  summary: string;
  details?: string;
};

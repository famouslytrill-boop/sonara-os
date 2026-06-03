export type ProviderPrivacyLevel = "public" | "internal" | "private" | "sensitive";
export type TaskType = "support_draft" | "search" | "summarize" | "creator_draft" | "admin_review";
export interface AIProvider {
  id: string;
  officialApi: boolean;
  commercialUseAllowed: boolean;
  usesCookieScraping?: boolean;
  usesBrowserTokenExtraction?: boolean;
  usesAccountPool?: boolean;
  storesCustomerFiles?: boolean;
  customerFileApproval?: boolean;
  allowedTasks: TaskType[];
  privacyLevel: ProviderPrivacyLevel;
}
export interface ProviderHealthStatus {
  providerId: string;
  status: "healthy" | "degraded" | "blocked";
  latencyMs?: number;
  errorRate?: number;
}
export interface ProviderCostEstimate {
  providerId: string;
  estimatedCents: number;
}
export interface ProviderLatencyEstimate {
  providerId: string;
  estimatedMs: number;
}
export interface FallbackProviderPolicy {
  primary: string;
  fallback: string;
  allowed: boolean;
}
export type BlockedProviderReason =
  | "unofficial_proxy"
  | "non_commercial"
  | "cookie_scraping"
  | "browser_token_extraction"
  | "account_pool"
  | "customer_file_storage_without_approval";

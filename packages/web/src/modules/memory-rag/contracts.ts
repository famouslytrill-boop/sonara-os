export type MemoryType =
  | "user_preference"
  | "business_preference"
  | "customer_context"
  | "project_context"
  | "temporary_context"
  | "blocked_sensitive_context";
export interface MemoryRecord {
  organization_id: string;
  type: MemoryType;
  value: string;
  consent: boolean;
  expiresAt?: string;
  dataVaultLabel: string;
  sensitive?: boolean;
}
export interface MemoryDecision {
  allowed: boolean;
  reason: string;
}

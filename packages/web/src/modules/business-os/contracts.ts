export type ModuleStatus = "disabled" | "sandbox" | "review" | "enabled";
export type PermissionScope = "owner" | "admin" | "member" | "support";
export type TrustReviewStatus = "pending" | "reviewed" | "blocked";
export type MoneyPathStage =
  | "lead"
  | "appointment"
  | "quote"
  | "invoice_payment_link"
  | "follow_up"
  | "review"
  | "referral"
  | "repeat_customer";
export interface CustomerRecordLink {
  organization_id: string;
  customer_record_id: string;
}
export interface AuditEventRef {
  organization_id: string;
  event_id: string;
  action: string;
}
export interface BusinessModule {
  id: string;
  name: string;
  status: ModuleStatus;
  connectsToCustomerRecords: boolean;
  requiredScopes: PermissionScope[];
  emitsAuditEvents: boolean;
}
export interface SensitiveBusinessAction {
  organization_id?: string;
  actorScope?: PermissionScope;
  action: string;
}

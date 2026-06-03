export type AnalyticsEventCategory =
  | "lead_created"
  | "booking_created"
  | "quote_sent"
  | "payment_link_created"
  | "payment_status_updated"
  | "review_requested"
  | "campaign_launched"
  | "file_uploaded"
  | "creator_asset_uploaded"
  | "search_performed"
  | "admin_action"
  | "security_event"
  | "launch_checklist_completed"
  | "webhook_failed"
  | "integration_degraded";
export interface AnalyticsEvent {
  organization_id: string;
  category: AnalyticsEventCategory;
  metadata?: Record<string, string>;
  privateBody?: string;
  paymentCredential?: string;
}

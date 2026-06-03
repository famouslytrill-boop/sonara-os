export type SearchCategory =
  | "customers"
  | "leads"
  | "quotes"
  | "payments"
  | "bookings"
  | "reviews"
  | "files"
  | "events"
  | "campaigns"
  | "creator_assets"
  | "audit_logs_admin_only";
export interface SearchContext {
  organization_id: string;
  permissions: string[];
  admin: boolean;
}
export interface SearchRecord {
  id: string;
  organization_id: string;
  category: SearchCategory;
  fields: Record<string, string>;
  privateFields?: string[];
  requiredPermission?: string;
}
export interface SavedSearch {
  organization_id: string;
  name: string;
  category: SearchCategory;
  permission: string;
}

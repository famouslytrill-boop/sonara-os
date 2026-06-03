export type DatabaseProvider =
  | "supabase"
  | "prisma"
  | "meilisearch"
  | "pgvector"
  | "duckdb_local"
  | "clickhouse_stub"
  | "deferred";
export type MigrationStatus = "append_only" | "needs_review" | "blocked";
export type RLSReviewStatus = "deny_by_default" | "needs_review" | "blocked";
export interface OrganizationScopedRecord {
  id: string;
  organization_id?: string;
  created_by?: string;
  updated_by?: string;
}
export interface DataAccessPolicy {
  requireOrganizationId: boolean;
  denyByDefault: boolean;
  requireAuditEvent: boolean;
}
export interface AuditEvent {
  organization_id: string;
  actor_id: string;
  action: string;
  target_type: string;
}
export interface TenantBoundaryCheck {
  allowed: boolean;
  reason: string;
}

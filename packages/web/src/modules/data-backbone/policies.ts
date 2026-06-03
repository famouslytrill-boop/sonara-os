import type { DataAccessPolicy } from "./contracts.ts";
export const defaultDataAccessPolicy: DataAccessPolicy = {
  requireOrganizationId: true,
  denyByDefault: true,
  requireAuditEvent: true
};
export const databaseDecision = {
  primaryDatabase: "supabase",
  orm: "prisma",
  appSearch: "meilisearch",
  vectorSearch: "pgvector",
  deferred: ["clickhouse", "redis", "cockroachdb", "tidb", "surrealdb", "directus"]
} as const;

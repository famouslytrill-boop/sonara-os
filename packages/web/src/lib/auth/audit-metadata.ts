import type { AuditMetadata } from "./types.ts";

export function createAuditMetadata({
  organizationId,
  userId,
  now = new Date().toISOString()
}: {
  organizationId: string;
  userId: string;
  now?: string;
}): AuditMetadata {
  return Object.freeze({
    organization_id: organizationId,
    created_by: userId,
    created_at: now,
    updated_at: now
  });
}

export function hasAuditMetadata(value: Partial<AuditMetadata>): value is AuditMetadata {
  return Boolean(
    value.organization_id?.trim() &&
    value.created_by?.trim() &&
    value.created_at?.trim() &&
    value.updated_at?.trim()
  );
}

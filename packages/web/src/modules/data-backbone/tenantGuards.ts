import type { OrganizationScopedRecord, TenantBoundaryCheck } from "./contracts.ts";
export function requireOrganizationScope(record: OrganizationScopedRecord): TenantBoundaryCheck {
  return record.organization_id
    ? { allowed: true, reason: "organization_id_present" }
    : { allowed: false, reason: "missing_organization_id" };
}
export function canReadTenantRecord(
  userOrganizationId: string | undefined,
  record: OrganizationScopedRecord,
  roles: string[] = []
): TenantBoundaryCheck {
  if (!record.organization_id) return { allowed: false, reason: "missing_organization_id" };
  if (roles.includes("platform_owner")) return { allowed: true, reason: "platform_owner" };
  return userOrganizationId === record.organization_id
    ? { allowed: true, reason: "same_organization" }
    : { allowed: false, reason: "cross_tenant_blocked" };
}

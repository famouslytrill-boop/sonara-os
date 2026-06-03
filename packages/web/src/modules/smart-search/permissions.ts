import type { SearchContext, SearchRecord } from "./contracts.ts";
export function canViewSearchRecord(record: SearchRecord, context: SearchContext): boolean {
  if (record.organization_id !== context.organization_id) return false;
  if (record.category === "audit_logs_admin_only" && !context.admin) return false;
  if (record.requiredPermission && !context.permissions.includes(record.requiredPermission))
    return false;
  return true;
}
export function filterPermissionedResults(
  records: SearchRecord[],
  context: SearchContext
): SearchRecord[] {
  return records.filter((record) => canViewSearchRecord(record, context));
}

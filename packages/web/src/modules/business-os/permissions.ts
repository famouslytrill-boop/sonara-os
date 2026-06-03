import type { SensitiveBusinessAction } from "./contracts.ts";
export function evaluateBusinessPermission(action: SensitiveBusinessAction) {
  const allowed =
    Boolean(action.organization_id) &&
    (action.actorScope === "owner" || action.actorScope === "admin");
  return {
    allowed,
    reason: allowed ? "allowed_with_audit" : "blocked_by_rbac_or_missing_organization"
  };
}

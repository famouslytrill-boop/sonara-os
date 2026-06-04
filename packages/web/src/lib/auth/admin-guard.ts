import type { OrganizationContext } from "./types.ts";

export function canAccessOwnerAdmin(context: OrganizationContext): boolean {
  const role = context.membership?.role;
  return context.state === "ready" && (role === "owner" || role === "admin");
}

export function requireOwnerAdmin(context: OrganizationContext) {
  return Object.freeze({
    allowed: canAccessOwnerAdmin(context),
    reason: canAccessOwnerAdmin(context) ? "allowed" : "owner-or-admin-required"
  });
}

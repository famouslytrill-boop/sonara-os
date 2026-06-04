import type { OrganizationContext } from "./types.ts";

export function hasActiveOrganizationMembership(context: OrganizationContext): boolean {
  return context.membership?.status === "active" && context.state === "ready";
}

export function getOrganizationMembershipGate(context: OrganizationContext) {
  if (!context.user) {
    return Object.freeze({ status: "signed_out", message: "Sign in before accessing app data." });
  }
  if (!hasActiveOrganizationMembership(context)) {
    return Object.freeze({
      status: "owner_bootstrap_required",
      message: "Create an active organization membership before tenant records are shown."
    });
  }
  return Object.freeze({ status: "ready", message: "Organization membership is active." });
}

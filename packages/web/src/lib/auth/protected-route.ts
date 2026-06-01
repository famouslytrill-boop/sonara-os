import type { RouteAuthBoundary } from "../../routes/route-manifest.ts";
import { canAccessAdminArea, roleHasPermission } from "./permissions.ts";
import { getActiveMembership, isOrganizationContextReady } from "./organization-context.ts";
import type { OrganizationContext, Permission } from "./types.ts";

export type ProtectedRouteDecision = Readonly<{
  allowed: boolean;
  reason: "public" | "missing-auth" | "missing-organization" | "missing-permission";
  message: string;
}>;

export function canAccessProtectedRoute({
  auth,
  context,
  permission
}: {
  auth: RouteAuthBoundary;
  context: OrganizationContext;
  permission?: Permission;
}): ProtectedRouteDecision {
  if (auth === "public") {
    return allow("Public route.");
  }
  if (!context.user) {
    return deny(
      "missing-auth",
      "Sign-in wiring is required before this route can show private data."
    );
  }
  if (!isOrganizationContextReady(context)) {
    return deny(
      "missing-organization",
      "An organization membership is required before this route can show private data."
    );
  }

  const membership = getActiveMembership(context);
  if (!membership) {
    return deny("missing-organization", "Active organization membership is required.");
  }
  if (auth === "admin-ready" && !canAccessAdminArea(membership.role)) {
    return deny(
      "missing-permission",
      "This route requires an admin, developer, owner, or support role."
    );
  }
  if (permission && !roleHasPermission(membership.role, permission)) {
    return deny("missing-permission", `This route requires ${permission}.`);
  }
  return allow("Protected route access allowed.");
}

function allow(message: string): ProtectedRouteDecision {
  return Object.freeze({ allowed: true, reason: "public", message });
}

function deny(
  reason: Exclude<ProtectedRouteDecision["reason"], "public">,
  message: string
): ProtectedRouteDecision {
  return Object.freeze({ allowed: false, reason, message });
}

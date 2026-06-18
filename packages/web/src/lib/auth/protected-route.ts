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
      "Log in to use this area."
    );
  }
  if (auth === "auth-ready" && !permission) {
    return allow("Logged-in route access allowed.");
  }
  if (auth === "admin-ready" && context.globalRoles?.some(canAccessAdminArea)) {
    return allow("Owner/admin route access allowed.");
  }
  if (!isOrganizationContextReady(context)) {
    return deny(
      "missing-organization",
      "Choose or create an organization before opening this area."
    );
  }

  const membership = getActiveMembership(context);
  if (!membership) {
    return deny("missing-organization", "Active organization membership is required.");
  }
  if (auth === "admin-ready" && !canAccessAdminArea(membership.role)) {
    return deny(
      "missing-permission",
      "This route requires an owner or admin role."
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

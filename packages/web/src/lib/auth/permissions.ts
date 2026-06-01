import type { OrganizationRole, Permission } from "./types.ts";

export const organizationRoles: readonly OrganizationRole[] = Object.freeze([
  "owner",
  "admin",
  "member",
  "viewer",
  "developer",
  "support"
]);

function permissions(...items: Permission[]): readonly Permission[] {
  return Object.freeze(items);
}

export const rolePermissions: Readonly<Record<OrganizationRole, readonly Permission[]>> =
  Object.freeze({
    owner: permissions(
      "organization:read",
      "organization:manage",
      "profile:read",
      "profile:manage",
      "billing:read",
      "security:read",
      "security:manage",
      "developer-tools:read",
      "support:read",
      "audit:read"
    ),
    admin: permissions(
      "organization:read",
      "organization:manage",
      "profile:read",
      "profile:manage",
      "billing:read",
      "security:read",
      "support:read",
      "audit:read"
    ),
    member: permissions("organization:read", "profile:read", "profile:manage", "support:read"),
    viewer: permissions("organization:read", "profile:read", "support:read"),
    developer: permissions(
      "organization:read",
      "security:read",
      "developer-tools:read",
      "support:read",
      "audit:read"
    ),
    support: permissions("organization:read", "security:read", "support:read")
  });

export function isOrganizationRole(value: string): value is OrganizationRole {
  return organizationRoles.includes(value as OrganizationRole);
}

export function getRolePermissions(role: OrganizationRole): readonly Permission[] {
  return rolePermissions[role];
}

export function roleHasPermission(role: OrganizationRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function canManageOrganization(role: OrganizationRole): boolean {
  return roleHasPermission(role, "organization:manage");
}

export function canAccessAdminArea(role: OrganizationRole): boolean {
  return (
    roleHasPermission(role, "security:read") ||
    roleHasPermission(role, "developer-tools:read") ||
    roleHasPermission(role, "audit:read")
  );
}

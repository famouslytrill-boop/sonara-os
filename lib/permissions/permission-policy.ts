import { permissionRegistry, type PermissionKey } from "./permission-registry";

export function getPermissionPolicy(key: PermissionKey) {
  return permissionRegistry[key];
}

export const blockedPermissionUses = [
  "covert tracking",
  "employee/customer surveillance",
  "automatic contact import",
  "SMS inbox reading",
  "robocalls",
  "automatic customer outreach",
  "permission request on page load",
] as const;

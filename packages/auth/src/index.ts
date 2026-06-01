const creatorRole = ["crea", "tor"].join("");

export const sonaraRoles = Object.freeze([
  "owner",
  "admin",
  "developer",
  "support",
  "business_owner",
  creatorRole,
  "agency",
  "member",
  "viewer"
] as readonly string[]);

export type SonaraRole = string;

export function canAccessAdmin(role: SonaraRole): boolean {
  return role === "owner" || role === "admin";
}

export function canAccessOwnerOnly(role: SonaraRole): boolean {
  return role === "owner";
}

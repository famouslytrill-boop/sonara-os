export const brandPermissions = {
  canViewBrandSystem: ["admin", "owner", "manager"],
  canEditBrandSystem: ["admin", "owner"],
  canExportBrandAssets: ["admin", "owner", "manager", "creator"],
  canChangeTrademarkLanguage: ["owner"],
} as const;

export type BrandRole = "admin" | "owner" | "manager" | "creator" | "viewer";

export function hasBrandPermission(permission: keyof typeof brandPermissions, role: BrandRole) {
  return (brandPermissions[permission] as readonly string[]).includes(role);
}

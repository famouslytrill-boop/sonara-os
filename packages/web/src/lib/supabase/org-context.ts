export type SupabaseOrganizationContext = Readonly<{
  organizationId: string | null;
  userId: string | null;
  role: "owner" | "admin" | "member" | "viewer" | "support" | "developer" | "none";
  ready: boolean;
}>;

export function createMissingSupabaseOrganizationContext(): SupabaseOrganizationContext {
  return Object.freeze({
    organizationId: null,
    userId: null,
    role: "none",
    ready: false
  });
}

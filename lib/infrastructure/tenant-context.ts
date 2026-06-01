export type TenantContext = {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
};

export function assertTenantMember(context: TenantContext | null | undefined): TenantContext {
  if (!context?.organizationId || !context.userId) {
    throw new Error("Tenant context is required.");
  }
  return context;
}

export type OrganizationKind = "business" | "creator-studio" | "agency" | "internal";
export type OrganizationStatus = "active" | "setup" | "suspended" | "archived";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer" | "developer" | "support";

export type MembershipStatus = "active" | "invited" | "suspended" | "removed";

export type UserProfile = Readonly<{
  id: string;
  email?: string;
  displayName: string;
  created_at: string;
  updated_at: string;
}>;

export type Organization = Readonly<{
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}>;

export type OrganizationMembership = Readonly<{
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  status: MembershipStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}>;

export type AuditMetadata = Readonly<{
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}>;

export type Permission =
  | "organization:read"
  | "organization:manage"
  | "profile:read"
  | "profile:manage"
  | "billing:read"
  | "security:read"
  | "security:manage"
  | "developer-tools:read"
  | "support:read"
  | "audit:read";

export type AuthSetupState = "setup-required" | "signed-out" | "ready";

export type OrganizationContext = Readonly<{
  state: AuthSetupState;
  user?: UserProfile;
  organization?: Organization;
  membership?: OrganizationMembership;
  memberships: readonly OrganizationMembership[];
}>;

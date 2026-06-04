export { createAuditMetadata, hasAuditMetadata } from "./audit-metadata.ts";
export { genericAuthErrorMessage, normalizeAuthErrorMessage } from "./auth-errors.ts";
export { createAuthReadinessSnapshot } from "./auth-readiness.ts";
export { authRedirectRoutes, createAuthRedirectUrl } from "./auth-redirects.ts";
export { canAccessOwnerAdmin, requireOwnerAdmin } from "./admin-guard.ts";
export {
  createOrganizationContext,
  createOrganizationSetupContext,
  createSignedOutOrganizationContext,
  getActiveMembership,
  isOrganizationContextReady
} from "./organization-context.ts";
export {
  canAccessAdminArea,
  canManageOrganization,
  getRolePermissions,
  isOrganizationRole,
  organizationRoles,
  roleHasPermission,
  rolePermissions
} from "./permissions.ts";
export { oauthProviderRegistry } from "./oauth-provider-registry.ts";
export {
  getOrganizationMembershipGate,
  hasActiveOrganizationMembership
} from "./org-membership.ts";
export { ownerBootstrapPolicy, ownerBootstrapSteps } from "./owner-bootstrap-policy.ts";
export { evaluatePasswordPolicy, passwordPolicy } from "./password-policy.ts";
export { canAccessProtectedRoute } from "./protected-route.ts";
export type {
  AuditMetadata,
  AuthSetupState,
  MembershipStatus,
  Organization,
  OrganizationContext,
  OrganizationKind,
  OrganizationMembership,
  OrganizationRole,
  OrganizationStatus,
  Permission,
  UserProfile
} from "./types.ts";

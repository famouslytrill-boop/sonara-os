import type {
  Organization,
  OrganizationContext,
  OrganizationMembership,
  UserProfile
} from "./types.ts";

export function createOrganizationSetupContext(): OrganizationContext {
  return Object.freeze({
    state: "setup-required",
    memberships: Object.freeze([])
  });
}

export function createSignedOutOrganizationContext(): OrganizationContext {
  return Object.freeze({
    state: "signed-out",
    memberships: Object.freeze([])
  });
}

export function createOrganizationContext({
  user,
  organization,
  memberships
}: {
  user: UserProfile;
  organization: Organization;
  memberships: readonly OrganizationMembership[];
}): OrganizationContext {
  const membership = memberships.find(
    (item) => item.organization_id === organization.id && item.user_id === user.id
  );
  return Object.freeze({
    state: membership?.status === "active" ? "ready" : "setup-required",
    user,
    organization,
    membership,
    memberships: Object.freeze([...memberships])
  });
}

export function getActiveMembership(
  context: OrganizationContext
): OrganizationMembership | undefined {
  return context.membership?.status === "active" ? context.membership : undefined;
}

export function isOrganizationContextReady(context: OrganizationContext): boolean {
  return Boolean(
    context.state === "ready" && context.user && context.organization && context.membership
  );
}

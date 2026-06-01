import { describe, expect, it } from "vitest";
import {
  canAccessProtectedRoute,
  canManageOrganization,
  createAuditMetadata,
  createOrganizationContext,
  createOrganizationSetupContext,
  hasAuditMetadata,
  roleHasPermission
} from "./lib/auth/index.ts";

const now = "2026-05-18T00:00:00.000Z";

describe("auth and organization scaffolding", () => {
  it("defines role permissions for organization and admin access", () => {
    expect(canManageOrganization("owner")).toBe(true);
    expect(canManageOrganization("viewer")).toBe(false);
    expect(roleHasPermission("developer", "developer-tools:read")).toBe(true);
    expect(roleHasPermission("support", "billing:read")).toBe(false);
  });

  it("guards protected routes when no session or organization exists", () => {
    const context = createOrganizationSetupContext();

    expect(canAccessProtectedRoute({ auth: "public", context }).allowed).toBe(true);

    const privateDecision = canAccessProtectedRoute({ auth: "auth-ready", context });
    expect(privateDecision.allowed).toBe(false);
    expect(privateDecision.reason).toBe("missing-auth");
  });

  it("allows admin-ready routes for an active developer membership", () => {
    const context = createOrganizationContext({
      user: {
        id: "user-1",
        displayName: "Developer",
        created_at: now,
        updated_at: now
      },
      organization: {
        id: "org-1",
        name: "SONARA",
        slug: "sonara",
        kind: "internal",
        status: "active",
        created_at: now,
        updated_at: now
      },
      memberships: [
        {
          id: "membership-1",
          organization_id: "org-1",
          user_id: "user-1",
          role: "developer",
          status: "active",
          created_at: now,
          updated_at: now
        }
      ]
    });

    expect(canAccessProtectedRoute({ auth: "admin-ready", context }).allowed).toBe(true);
  });

  it("uses audit metadata conventions for organization-scoped records", () => {
    const metadata = createAuditMetadata({
      organizationId: "org-1",
      userId: "user-1",
      now
    });

    expect(metadata).toEqual({
      organization_id: "org-1",
      created_by: "user-1",
      created_at: now,
      updated_at: now
    });
    expect(hasAuditMetadata(metadata)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  canAccessProtectedRoute,
  canManageOrganization,
  createAuditMetadata,
  createAuthReadinessSnapshot,
  createOrganizationContext,
  createOrganizationSetupContext,
  evaluatePasswordPolicy,
  genericAuthErrorMessage,
  hasAuditMetadata,
  normalizeAuthErrorMessage,
  requireOwnerAdmin,
  roleHasPermission
} from "./lib/auth/index.ts";
import { getRouteDefinition, isKnownRoute } from "./routes/route-manifest.ts";

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

  it("models auth readiness without exposing provider secrets", () => {
    const readiness = createAuthReadinessSnapshot({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public"
    });

    expect(readiness.magicLinkReady).toBe(true);
    expect(readiness.passwordResetReady).toBe(true);
    expect(JSON.stringify(readiness)).not.toContain("anon-public");
  });

  it("keeps auth errors generic and password policy strict", () => {
    expect(normalizeAuthErrorMessage(new Error("user not found"))).toBe(genericAuthErrorMessage);
    expect(evaluatePasswordPolicy("weak").ok).toBe(false);
    expect(evaluatePasswordPolicy("StrongPass123!").ok).toBe(true);
  });

  it("requires owner/admin role for owner admin guard", () => {
    const context = createOrganizationContext({
      user: {
        id: "user-1",
        displayName: "Member",
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
          role: "member",
          status: "active",
          created_at: now,
          updated_at: now
        }
      ]
    });

    expect(requireOwnerAdmin(context)).toMatchObject({
      allowed: false,
      reason: "owner-or-admin-required"
    });
  });

  it("registers auth setup and account security routes", () => {
    for (const route of [
      "/login",
      "/signup",
      "/auth/callback",
      "/forgot-password",
      "/reset-password",
      "/app/settings/security",
      "/app/admin/owner-bootstrap"
    ]) {
      expect(isKnownRoute(route)).toBe(true);
    }
    expect(getRouteDefinition("/app/settings/security")).toMatchObject({ auth: "auth-ready" });
  });
});

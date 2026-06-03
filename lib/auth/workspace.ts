import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getOperationalEnvReadiness } from "../env";
import { getSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";

export type WorkspaceBootstrapResult =
  | { status: "signed_out"; user: null; organizationId: null; role: null; adminEmailConfigured: boolean }
  | { status: "supabase_not_configured"; user: null; organizationId: null; role: null; adminEmailConfigured: boolean }
  | { status: "service_role_not_configured"; user: User; organizationId: null; role: null; adminEmailConfigured: boolean }
  | { status: "ready"; user: User; organizationId: string; role: string; adminEmailConfigured: boolean }
  | { status: "error"; user: User | null; organizationId: null; role: null; adminEmailConfigured: boolean; message: string };

function getAdminEmails() {
  return new Set(
    (process.env.SONARA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAdminEmail(email: string | undefined) {
  if (!email) return false;
  return getAdminEmails().has(email.toLowerCase());
}

function getDisplayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const candidate = metadata.full_name ?? metadata.name ?? metadata.display_name;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : user.email?.split("@")[0] ?? "SONARA user";
}

function getWorkspaceName(user: User) {
  const displayName = getDisplayName(user);
  return `${displayName}'s SONARA workspace`;
}

function getWorkspaceSlug(user: User) {
  return `sonara-${user.id.slice(0, 8)}`;
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null, reason: "supabase_not_configured" as const };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, reason: user ? "authenticated" as const : "signed_out" as const };
}

export async function ensureUserWorkspace(): Promise<WorkspaceBootstrapResult> {
  const readiness = getOperationalEnvReadiness();
  const adminEmailConfigured = readiness.adminBootstrap;
  const { user, reason } = await getAuthenticatedUser();

  if (!user && reason === "supabase_not_configured") {
    return { status: "supabase_not_configured", user: null, organizationId: null, role: null, adminEmailConfigured };
  }

  if (!user) {
    return { status: "signed_out", user: null, organizationId: null, role: null, adminEmailConfigured };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { status: "service_role_not_configured", user, organizationId: null, role: null, adminEmailConfigured };
  }

  const role = isAdminEmail(user.email) ? "owner" : "owner";
  const displayName = getDisplayName(user);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: displayName,
      display_name: displayName,
      metadata: {
        auth_provider: "supabase",
        platform_admin_email_match: isAdminEmail(user.email),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { status: "error", user, organizationId: null, role: null, adminEmailConfigured, message: "profile_upsert_failed" };
  }

  const { data: memberships, error: membershipReadError } = await admin
    .from("organization_memberships")
    .select("id, organization_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(10);

  if (membershipReadError) {
    return { status: "error", user, organizationId: null, role: null, adminEmailConfigured, message: "membership_read_failed" };
  }

  const firstMembership = memberships?.[0];

  if (firstMembership?.organization_id) {
    if (isAdminEmail(user.email) && firstMembership.role !== "owner") {
      await admin.from("organization_memberships").update({ role: "owner", updated_at: new Date().toISOString() }).eq("id", firstMembership.id);
    }

    return {
      status: "ready",
      user,
      organizationId: firstMembership.organization_id,
      role: isAdminEmail(user.email) ? "owner" : firstMembership.role,
      adminEmailConfigured,
    };
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: getWorkspaceName(user),
      slug: getWorkspaceSlug(user),
      owner_id: user.id,
      metadata: {
        bootstrap: "first_login",
      },
    })
    .select("id")
    .single();

  if (organizationError || !organization?.id) {
    return { status: "error", user, organizationId: null, role: null, adminEmailConfigured, message: "organization_create_failed" };
  }

  const { error: insertMembershipError } = await admin.from("organization_memberships").upsert(
    {
      organization_id: organization.id,
      user_id: user.id,
      role,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" },
  );

  if (insertMembershipError) {
    return { status: "error", user, organizationId: null, role: null, adminEmailConfigured, message: "membership_create_failed" };
  }

  return { status: "ready", user, organizationId: organization.id, role, adminEmailConfigured };
}

export function isOwnerOrAdminRole(role: string | null) {
  return role === "owner" || role === "admin";
}

export async function requireOwnerOrAdmin() {
  const workspace = await ensureUserWorkspace();

  if (workspace.status === "signed_out") {
    redirect("/login?next=/app");
  }

  if (workspace.status !== "ready" || !isOwnerOrAdminRole(workspace.role)) {
    redirect("/app/dashboard?setup=admin_required");
  }

  return workspace;
}

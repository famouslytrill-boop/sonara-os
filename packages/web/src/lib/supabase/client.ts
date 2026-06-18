import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getDeploymentConfig } from "../../config/deployment.ts";
import {
  createAuthenticatedOrganizationContext,
  createSignedOutOrganizationContext
} from "../auth/organization-context.ts";
import type { OrganizationContext, OrganizationRole } from "../auth/types.ts";

type BrowserAuthGlobal = typeof globalThis & {
  __SONARA_AUTH__?: {
    signOut?: () => Promise<void> | void;
  };
};

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  const auth = getDeploymentConfig().publicAuth;
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
    return null;
  }
  client ??= createClient(auth.supabaseUrl, auth.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}

export function installBrowserAuthGlobal() {
  const authClient = getSupabaseBrowserClient();
  (globalThis as BrowserAuthGlobal).__SONARA_AUTH__ = {
    signOut: async () => {
      await authClient?.auth.signOut();
    }
  };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const authClient = getSupabaseBrowserClient();
  if (!authClient) {
    return fail("Supabase auth is not configured.");
  }
  const { error } = await authClient.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) {
    return fail("Email or password is incorrect.");
  }
  return { ok: true as const };
}

export async function signUpWithEmailPassword({
  email,
  password,
  displayName
}: {
  email: string;
  password: string;
  displayName: string;
}) {
  const authClient = getSupabaseBrowserClient();
  if (!authClient) {
    return fail("Supabase auth is not configured.");
  }
  const { error } = await authClient.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName.trim()
      }
    }
  });
  if (error) {
    return fail("Account signup could not be completed. Check the email and password.");
  }
  return { ok: true as const };
}

export async function loadBrowserOrganizationContext(): Promise<OrganizationContext> {
  const authClient = getSupabaseBrowserClient();
  if (!authClient) {
    return createSignedOutOrganizationContext();
  }

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return createSignedOutOrganizationContext();
  }

  const globalRoles = await loadGlobalRoles(authClient);
  return createAuthenticatedOrganizationContext({
    user: toUserProfile(data.user),
    globalRoles
  });
}

async function loadGlobalRoles(authClient: SupabaseClient): Promise<readonly OrganizationRole[]> {
  const { data } = await authClient
    .from("user_roles")
    .select("role")
    .is("organization_id", null)
    .in("role", ["owner", "admin"]);
  if (!Array.isArray(data)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    data
      .map((record) => record.role)
      .filter((role): role is OrganizationRole => role === "owner" || role === "admin")
  );
}

function toUserProfile(user: User) {
  return Object.freeze({
    id: user.id,
    email: user.email,
    displayName:
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : user.email ?? "SONARA user",
    created_at: user.created_at,
    updated_at: new Date().toISOString()
  });
}

function fail(message: string) {
  return Object.freeze({
    ok: false as const,
    message
  });
}

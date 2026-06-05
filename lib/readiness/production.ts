import "server-only";

import { getOperationalEnvReadiness } from "../env";
import type { WorkspaceBootstrapResult } from "../auth/workspace";

export type ReadinessCard = {
  title: string;
  status: "configured" | "missing" | "signed_in" | "signed_out" | "ready" | "action_required";
  body: string;
  href: string;
};

function statusFor(condition: boolean): "configured" | "missing" {
  return condition ? "configured" : "missing";
}

export function buildProductionReadinessCards(workspace: WorkspaceBootstrapResult): ReadinessCard[] {
  const env = getOperationalEnvReadiness();
  const signedIn = Boolean(workspace.user);
  const workspaceReady = workspace.status === "ready";

  return [
    {
      title: "Auth session",
      status: signedIn ? "signed_in" : "signed_out",
      body: signedIn ? "Supabase returned an authenticated user for this request." : "No authenticated session is present.",
      href: signedIn ? "/logout" : "/login",
    },
    {
      title: "Supabase public client",
      status: statusFor(env.supabasePublic),
      body: env.supabasePublic
        ? "Public Supabase URL and anon key are configured."
        : "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.",
      href: "/docs",
    },
    {
      title: "Backend database bootstrap",
      status: statusFor(env.supabaseAdmin),
      body: env.supabaseAdmin
        ? "Backend database admin credential is configured for trusted server-only bootstrap and webhook operations."
        : "Configure the backend-only database admin credential in Vercel before automatic workspace creation can run.",
      href: "/app/settings/security",
    },
    {
      title: "Workspace and membership",
      status: workspaceReady ? "ready" : "action_required",
      body: workspaceReady
        ? `Active organization membership exists with role ${workspace.role}.`
        : `Workspace bootstrap is not complete: ${workspace.status}.`,
      href: "/app/business-builder/workspaces",
    },
    {
      title: "Admin bootstrap",
      status: workspace.adminEmailConfigured ? "configured" : "missing",
      body: workspace.adminEmailConfigured
        ? "SONARA_ADMIN_EMAILS is configured server-side. Matching users can be granted owner role during bootstrap."
        : "Add SONARA_ADMIN_EMAILS in Vercel to identify first owner/admin accounts.",
      href: "/app/admin",
    },
    {
      title: "Stripe checkout",
      status: statusFor(env.stripeCheckout),
      body: env.stripeCheckout
        ? "Stripe secret key is present server-side. Price IDs and test checkout still need manual validation."
        : "Configure STRIPE_SECRET_KEY and required price IDs before enabling paid checkout.",
      href: "/app/payment-options",
    },
    {
      title: "Stripe webhook",
      status: statusFor(env.stripeWebhook),
      body: env.stripeWebhook
        ? "Webhook signing secret is configured. Verify the endpoint in Stripe test mode before live mode."
        : "Configure STRIPE_WEBHOOK_SECRET and the Stripe dashboard endpoint.",
      href: "/api-webhooks",
    },
    {
      title: "Resend email",
      status: statusFor(env.resend),
      body: env.resend
        ? "Resend API key and sender are configured server-side. Send a production test email before launch."
        : "Configure RESEND_API_KEY and RESEND_FROM_EMAIL after domain verification.",
      href: "/support",
    },
    {
      title: "Language preference",
      status: workspaceReady ? "ready" : "action_required",
      body: workspaceReady
        ? "Language preference is stored in user_preferences after the latest migration is applied."
        : "Sign in and complete workspace bootstrap before account-level preferences persist.",
      href: "/app/settings",
    },
    {
      title: "Unit system",
      status: workspaceReady ? "ready" : "action_required",
      body: workspaceReady
        ? "Metric or imperial unit preference is stored per user, not only in browser storage."
        : "Guest fallback may use localStorage, but signed-in preferences require Supabase.",
      href: "/app/settings",
    },
  ];
}

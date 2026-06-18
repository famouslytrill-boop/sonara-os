export type ArchitectureNodeStatus = "ready" | "requires_env" | "future_flagged" | "disabled";

export type ArchitectureNode = Readonly<{
  id: string;
  label: string;
  layer: "frontend" | "backend" | "provider" | "product" | "admin";
  status: ArchitectureNodeStatus;
  detail: string;
}>;

export const cloudArchitectureNodes: readonly ArchitectureNode[] = Object.freeze([
  node("frontend", "Frontend", "frontend", "ready", "Static TypeScript shell deployed through Vercel-ready artifacts."),
  node("api", "Backend/API routes", "backend", "requires_env", "Live server routes are required for checkout, webhooks, auth callbacks, and durable writes."),
  node("supabase-auth", "Supabase Auth", "provider", "requires_env", "Requires Supabase public URL, anon key, redirect URLs, and owner bootstrap."),
  node("supabase-db", "Supabase Database", "provider", "requires_env", "Source of truth for organizations, RLS, audit records, and product data."),
  node("supabase-storage", "Supabase Storage", "provider", "requires_env", "Private-by-default buckets for uploads and generated assets."),
  node("stripe-checkout", "Stripe Checkout", "provider", "requires_env", "Hosted checkout must run server-side and validate price_ IDs."),
  node("stripe-webhooks", "Stripe Webhooks", "provider", "requires_env", "Signed webhook verification is required before subscription state changes."),
  node("email", "Email provider", "provider", "requires_env", "Outbound provider setup required; inbound DNS routing remains human-verified."),
  node("vercel", "Vercel deployment", "provider", "requires_env", "Domain, SSL, env vars, and production deploy require provider verification."),
  node("agents", "Agent Control Plane", "backend", "ready", "Typed planning foundation; no autonomous production execution."),
  node("model-routing", "Model Routing", "backend", "ready", "Cost-aware routing policy with no provider API calls."),
  node("vector-memory", "Vector Memory", "backend", "requires_env", "Supabase pgvector preferred; local vector engines disabled by default."),
  node("business-builder", "Business Builder", "product", "ready", "Launch-facing service business workflow foundation."),
  node("creator-studio", "Creator Studio", "product", "ready", "Creator workflow and asset planning foundation."),
  node("growth-studio", "Growth Studio", "product", "ready", "Campaign, tactics, and consent-safe outreach planning foundation."),
  node("admin", "Admin Command Center", "admin", "ready", "Setup-mode status cards with owner/admin gating required in production.")
]);

function node(
  id: string,
  label: string,
  layer: ArchitectureNode["layer"],
  status: ArchitectureNodeStatus,
  detail: string
): ArchitectureNode {
  return Object.freeze({ id, label, layer, status, detail });
}
